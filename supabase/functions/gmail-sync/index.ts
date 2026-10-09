/**
 * Gmail ingestion. The second route into the buyer database, alongside the
 * browser-side Takeout reader — same classifier, different transport.
 *
 * Reads a mailbox through domain-wide delegation, classifies each thread, and
 * writes buyers, companies and the classification trail. Read-only scope: this
 * function cannot send, delete or modify mail.
 *
 * POST { mailbox: "sales@cotonex.com", mode?: "backfill" | "incremental",
 *        maxThreads?: number, dryRun?: boolean }
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { getAccessToken, loadServiceAccount } from "../_shared/google-auth.ts";
import { backfillQuery, shouldSkip, toParsedThread } from "../../../src/lib/ingestion/gmail.ts";
import type { GmailMessage, GmailThread } from "../../../src/lib/ingestion/gmail.ts";
import { classifyThread, makeContext } from "../../../src/lib/ingestion/classify.ts";
import { lookupByEmail } from "../../../src/lib/enrichment/index.ts";

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

/* Gmail allows 250 quota units/second/user. A threads.get is 10 units, so
   stay well under while still making progress. */
const CONCURRENCY = 8;
const PAGE_SIZE = 100;

type Body = {
  mailbox?: string;
  mode?: "backfill" | "incremental";
  maxThreads?: number;
  dryRun?: boolean;
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

async function gmailFetch<T>(path: string, token: string): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`${GMAIL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) return (await response.json()) as T;

    /* 429 and 5xx are transient; back off rather than failing the whole run. */
    if (response.status === 429 || response.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 400));
      continue;
    }

    const detail = await response.text();
    throw new Error(`Gmail ${response.status} on ${path}: ${detail.slice(0, 300)}`);
  }
  throw new Error(`Gmail kept rate-limiting ${path} after 5 attempts`);
}

/** Runs tasks with a fixed concurrency rather than all at once. */
async function pooled<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index]);
    }
  });

  await Promise.all(workers);
  return results;
}

async function listThreadIds(token: string, query: string, max: number): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ q: query, maxResults: String(PAGE_SIZE) });
    if (pageToken) params.set("pageToken", pageToken);

    const page = await gmailFetch<{ threads?: { id: string }[]; nextPageToken?: string }>(
      `/threads?${params}`,
      token,
    );

    for (const thread of page.threads ?? []) {
      ids.push(thread.id);
      if (ids.length >= max) return ids;
    }
    pageToken = page.nextPageToken;
  } while (pageToken);

  return ids;
}

/**
 * Thread ids changed since a history cursor. Far cheaper than re-listing, but
 * Gmail expires cursors after roughly a week, so the caller must be ready to
 * fall back to a query.
 */
async function listChangedThreadIds(
  token: string,
  startHistoryId: string,
  max: number,
): Promise<{ ids: string[]; historyId?: string; expired: boolean }> {
  const ids = new Set<string>();
  let pageToken: string | undefined;
  let historyId: string | undefined;

  do {
    const params = new URLSearchParams({
      startHistoryId,
      historyTypes: "messageAdded",
      maxResults: String(PAGE_SIZE),
    });
    if (pageToken) params.set("pageToken", pageToken);

    let page: {
      history?: { messagesAdded?: { message: { threadId: string } }[] }[];
      nextPageToken?: string;
      historyId?: string;
    };

    try {
      page = await gmailFetch(`/history?${params}`, token);
    } catch (error) {
      if (String(error).includes("404")) return { ids: [], expired: true };
      throw error;
    }

    for (const entry of page.history ?? []) {
      for (const added of entry.messagesAdded ?? []) {
        ids.add(added.message.threadId);
        if (ids.size >= max) return { ids: [...ids], historyId: page.historyId, expired: false };
      }
    }
    historyId = page.historyId ?? historyId;
    pageToken = page.nextPageToken;
  } while (pageToken);

  return { ids: [...ids], historyId, expired: false };
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json(405, { error: "POST only" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json(400, { error: "Body must be JSON" });
  }

  const address = body.mailbox?.trim().toLowerCase();
  if (!address) return json(400, { error: "mailbox is required" });

  const mode = body.mode ?? "incremental";
  const maxThreads = Math.min(body.maxThreads ?? 500, 5000);

  const { data: mailbox, error: mailboxError } = await supabase
    .from("mailboxes")
    .select("*")
    .eq("address", address)
    .single();

  if (mailboxError || !mailbox) return json(404, { error: `Mailbox ${address} is not registered` });
  if (!mailbox.enabled) return json(409, { error: `Mailbox ${address} is disabled` });

  const { data: run } = await supabase
    .from("mailbox_sync_runs")
    .insert({ mailbox_id: mailbox.id, mode })
    .select()
    .single();

  await supabase.from("mailboxes").update({ status: "running", last_error: null }).eq("id", mailbox.id);

  const finish = async (patch: Record<string, unknown>, error?: string) => {
    await supabase
      .from("mailbox_sync_runs")
      .update({ ...patch, finished_at: new Date().toISOString(), error })
      .eq("id", run?.id);
    await supabase
      .from("mailboxes")
      .update({
        status: error ? "error" : "idle",
        last_error: error ?? null,
        last_synced_at: new Date().toISOString(),
        ...(patch.history_id ? { last_history_id: patch.history_id } : {}),
      })
      .eq("id", mailbox.id);
  };

  try {
    const account = loadServiceAccount(Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY"));
    const token = await getAccessToken(account, address);

    /* Every registered mailbox counts as "us", not just the one being read —
       otherwise a colleague on the thread looks like an external party and the
       reciprocity signal is wrong. */
    const { data: allMailboxes } = await supabase.from("mailboxes").select("address");
    const context = makeContext((allMailboxes ?? []).map((row) => row.address as string));

    let threadIds: string[];
    let nextHistoryId: string | undefined;
    let effectiveMode = mode;

    if (mode === "incremental" && mailbox.last_history_id) {
      const changed = await listChangedThreadIds(token, mailbox.last_history_id, maxThreads);
      if (changed.expired) {
        /* The cursor aged out. Re-listing a short window is cheaper than a
           full backfill and loses nothing. */
        effectiveMode = "backfill";
        threadIds = await listThreadIds(token, "newer_than:14d -in:chats -in:spam", maxThreads);
      } else {
        threadIds = changed.ids;
        nextHistoryId = changed.historyId;
      }
    } else {
      effectiveMode = "backfill";
      threadIds = await listThreadIds(token, backfillQuery(3), maxThreads);
    }

    const profile = await gmailFetch<{ historyId?: string }>("/profile", token);
    nextHistoryId ??= profile.historyId;

    const tally = { buyers: 0, review: 0, discarded: 0 };

    const classified = await pooled(threadIds, CONCURRENCY, async (threadId) => {
      const raw = await gmailFetch<GmailThread>(
        `/threads/${threadId}?format=full`,
        token,
      );

      /* Drop spam, trash and promotions before any work is done on them. */
      const usable: GmailMessage[] = (raw.messages ?? []).filter((message) => !shouldSkip(message));
      if (usable.length === 0) return null;

      const parsed = toParsedThread({ id: raw.id, messages: usable });
      if (!parsed) return null;

      return classifyThread(parsed, context);
    });

    for (const result of classified) {
      if (!result) continue;
      if (result.verdict === "buyer") tally.buyers += 1;
      else if (result.verdict === "review") tally.review += 1;
      else tally.discarded += 1;
    }

    if (body.dryRun) {
      await finish({ threads_seen: threadIds.length, ...tally });
      return json(200, { mailbox: address, mode: effectiveMode, dryRun: true, ...tally });
    }

    /* Write companies first: contacts reference them. */
    const now = new Date().toISOString();
    const companies = new Map<string, Record<string, unknown>>();
    const contacts = new Map<string, Record<string, unknown>>();
    const threadRows: Record<string, unknown>[] = [];

    for (const result of classified) {
      if (!result) continue;

      const email = result.counterparty?.email;
      const domain = email?.split("@")[1];

      if (result.verdict === "buyer" && email && domain) {
        const guess = lookupByEmail(email);

        if (!companies.has(domain)) {
          companies.set(domain, {
            name: result.extracted.company ?? guess.record.companyName?.value ?? domain,
            domain,
            country_code: guess.record.countryCode?.value ?? "ZZ",
            country: guess.record.country?.value ?? "Unknown",
            verified: false,
            sources: ["gmail"],
          });
        }

        /* Last writer wins, and threads are processed newest-last, so the most
           recent signature is the one that sticks. */
        contacts.set(email, {
          email,
          name: result.extracted.name ?? result.counterparty?.name ?? null,
          phone: result.extracted.phone ?? null,
          designation: result.extracted.designation ?? null,
          role_category: guess.record.roleCategory?.value ?? null,
          role_priority: result.extracted.designation ? "high" : "medium",
          status: result.status,
          last_touch_at: result.lastAt ?? null,
          verified: false,
          sources: ["gmail"],
          _domain: domain,
        });
      }

      threadRows.push({
        mailbox_id: mailbox.id,
        external_id: result.threadId,
        source: "gmail",
        counterparty_email: email ?? null,
        verdict: result.verdict,
        score: result.score,
        excluded_reason: result.excluded ?? null,
        signals: result.signals,
        message_count: result.messageCount,
        first_message_at: result.firstAt ?? null,
        last_message_at: result.lastAt ?? null,
      });
    }

    if (companies.size > 0) {
      await supabase.from("companies").upsert([...companies.values()], { onConflict: "domain" });
    }

    if (contacts.size > 0) {
      const { data: saved } = await supabase
        .from("companies")
        .select("id, domain")
        .in("domain", [...companies.keys()]);

      const idByDomain = new Map((saved ?? []).map((row) => [row.domain as string, row.id as string]));

      const rows = [...contacts.values()]
        .map((contact) => {
          const { _domain, ...rest } = contact as Record<string, unknown> & { _domain: string };
          const companyId = idByDomain.get(_domain);
          return companyId ? { ...rest, company_id: companyId } : null;
        })
        .filter((row): row is Record<string, unknown> => row !== null);

      if (rows.length > 0) {
        /* ignoreDuplicates: a contact already in the database may have been
           reviewed or edited by a person, and an import must not overwrite
           that. New information for known contacts is a separate, later job. */
        await supabase.from("contacts").upsert(rows, { onConflict: "email", ignoreDuplicates: true });
      }
    }

    for (let index = 0; index < threadRows.length; index += 500) {
      await supabase
        .from("ingested_threads")
        .upsert(threadRows.slice(index, index + 500), { onConflict: "source,external_id" });
    }

    await supabase
      .from("mailboxes")
      .update({
        threads_seen: (mailbox.threads_seen ?? 0) + threadIds.length,
        threads_classified: (mailbox.threads_classified ?? 0) + threadRows.length,
        buyers_found: (mailbox.buyers_found ?? 0) + tally.buyers,
      })
      .eq("id", mailbox.id);

    await finish({ threads_seen: threadIds.length, ...tally, history_id: nextHistoryId });

    return json(200, {
      mailbox: address,
      mode: effectiveMode,
      threadsSeen: threadIds.length,
      ...tally,
      companiesWritten: companies.size,
      contactsWritten: contacts.size,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finish({}, message);
    return json(500, { mailbox: address, error: message });
  }
});
