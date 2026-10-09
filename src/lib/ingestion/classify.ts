/**
 * Thread classification without a model.
 *
 * Four layers, in order of how much work they do:
 *   1. Exclusion   - headers prove most mail is not from a buyer
 *   2. Reciprocity - a two-way conversation over time is the strongest signal
 *   3. Lexicon     - the home textile trade has a narrow, distinctive language
 *   4. Signature   - a buying job title confirms it, and yields phone/title
 *
 * Every verdict carries the signals that produced it, so a wrong answer can be
 * explained and corrected rather than argued with.
 */

import { FREE_PROVIDERS } from "../enrichment/data";
import {
  ALL_TERMS,
  AUTOMATED_LOCAL_PARTS,
  DEFAULT_VENDOR_DOMAINS,
  MARKETING_PLATFORMS,
} from "./lexicon";
import { isBuyingTitle, parseSignature } from "./signature";
import { EXCLUSION_LABELS, THRESHOLDS } from "./types";
import type {
  Classification,
  Extracted,
  ExclusionReason,
  MailboxContext,
  ParsedAddress,
  ParsedThread,
  Signal,
  Verdict,
} from "./types";
import type { ContactStatus } from "../domain/types";

const DAY = 86_400_000;

export function makeContext(
  ownAddresses: string[],
  extraVendorDomains: string[] = [],
): MailboxContext {
  const addresses = ownAddresses.map((address) => address.toLowerCase().trim()).filter(Boolean);
  return {
    ownAddresses: new Set(addresses),
    ownDomains: new Set(addresses.map((address) => address.split("@")[1]).filter(Boolean)),
    vendorDomains: new Set([...DEFAULT_VENDOR_DOMAINS, ...extraVendorDomains].map((d) => d.toLowerCase())),
  };
}

const domainOf = (email: string) => email.toLowerCase().split("@")[1] ?? "";
const localOf = (email: string) => email.toLowerCase().split("@")[0] ?? "";

function isInternal(address: ParsedAddress, context: MailboxContext): boolean {
  const email = address.email.toLowerCase();
  return context.ownAddresses.has(email) || context.ownDomains.has(domainOf(email));
}

/** Escapes a lexicon term and matches it on word boundaries. */
function termRegex(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:[^\\p{L}\\p{N}]|$)`, "iu");
}

const TERM_MATCHERS = ALL_TERMS.map((entry) => ({ ...entry, pattern: termRegex(entry.term) }));

/* ------------------------------------------------------------ layer 1 -- */

function exclude(thread: ParsedThread, context: MailboxContext): ExclusionReason | undefined {
  const external = counterparties(thread, context);
  if (external.length === 0) {
    return thread.messages.length > 0 ? "internal_only" : "no_counterparty";
  }

  const inbound = thread.messages.filter((message) => !isInternal(message.from, context));

  /* Judge the inbound mail: our own messages say nothing about the sender. */
  for (const message of inbound) {
    const headers = message.headers;

    if (AUTOMATED_LOCAL_PARTS.includes(localOf(message.from.email))) {
      return "automated_sender";
    }
    if (headers["list-unsubscribe"] || headers["list-id"] || /bulk|list/i.test(headers["precedence"] ?? "")) {
      return "bulk_mail";
    }
    if (/auto-replied|auto-generated/i.test(headers["auto-submitted"] ?? "")) {
      return "auto_reply";
    }
    if (headers["x-autoreply"] || headers["x-autorespond"]) {
      return "auto_reply";
    }
    if (/text\/calendar/i.test(headers["content-type"] ?? "")) {
      return "calendar_invite";
    }

    const platformHaystack = [
      headers["dkim-signature"],
      headers["return-path"],
      headers["x-mailer"],
      headers["received"],
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (MARKETING_PLATFORMS.some((platform) => platformHaystack.includes(platform))) {
      return "marketing_platform";
    }
  }

  if (external.every((address) => context.vendorDomains.has(domainOf(address.email)))) {
    return "vendor_domain";
  }

  /* A single unanswered message from a personal address is almost always
     noise. The same address inside a real conversation is kept. */
  const weReplied = thread.messages.some((message) => isInternal(message.from, context));
  if (
    !weReplied &&
    thread.messages.length === 1 &&
    external.every((address) => FREE_PROVIDERS.has(domainOf(address.email)))
  ) {
    return "free_provider_one_shot";
  }

  return undefined;
}

/** External people on the thread, most frequent first. */
function counterparties(thread: ParsedThread, context: MailboxContext): ParsedAddress[] {
  const seen = new Map<string, { address: ParsedAddress; count: number }>();

  for (const message of thread.messages) {
    const participants = [message.from, ...message.to, ...message.cc];
    for (const participant of participants) {
      if (!participant.email || isInternal(participant, context)) continue;
      const key = participant.email.toLowerCase();
      const existing = seen.get(key);
      /* Weight the sender over a cc, and keep whichever copy carries a name. */
      const weight = participant === message.from ? 3 : 1;
      if (existing) {
        existing.count += weight;
        if (!existing.address.name && participant.name) existing.address.name = participant.name;
      } else {
        seen.set(key, { address: { ...participant, email: key }, count: weight });
      }
    }
  }

  return [...seen.values()].sort((a, b) => b.count - a.count).map((entry) => entry.address);
}

/* ------------------------------------------------------------ layer 2 -- */

function reciprocity(
  thread: ParsedThread,
  context: MailboxContext,
  counterparty: ParsedAddress | undefined,
): { signals: Signal[]; twoWay: boolean } {
  const signals: Signal[] = [];
  const outbound = thread.messages.filter((message) => isInternal(message.from, context));
  const inbound = thread.messages.filter((message) => !isInternal(message.from, context));
  const twoWay = outbound.length > 0 && inbound.length > 0;

  if (twoWay) {
    /* The single most reliable signal: they wrote, we wrote, they wrote back. */
    signals.push({
      label: "Two-way conversation",
      points: 6,
      detail: `${outbound.length} sent, ${inbound.length} received`,
    });
  } else if (inbound.length > 0) {
    /* Someone wrote and nobody answered. That is not evidence against them
       being a buyer — from a company address it is a lead we dropped, which
       is precisely what this ingestion exists to find. */
    const fromCompany = counterparty && !FREE_PROVIDERS.has(domainOf(counterparty.email));
    signals.push({
      label: fromCompany ? "Unanswered message from a company" : "Unanswered inbound",
      points: fromCompany ? 2 : 0,
      detail: fromCompany ? "A possible missed lead" : undefined,
    });
  } else if (outbound.length > 0) {
    signals.push({ label: "Outbound only, no reply", points: 0, detail: "A contacted prospect" });
  }

  if (thread.messages.length >= 4) {
    signals.push({ label: "Sustained exchange", points: 2, detail: `${thread.messages.length} messages` });
  }

  const times = thread.messages
    .map((message) => new Date(message.date).getTime())
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => a - b);

  if (times.length >= 2) {
    const spanDays = Math.round((times[times.length - 1] - times[0]) / DAY);
    if (spanDays >= 2) {
      signals.push({
        label: "Conversation ran over time",
        points: spanDays >= 14 ? 3 : 2,
        detail: `${spanDays} days`,
      });
    }
  }

  /* More than one colleague engaged means the business took it seriously. */
  const staff = new Set(
    thread.messages.filter((message) => isInternal(message.from, context)).map((message) => message.from.email),
  );
  if (staff.size >= 2) {
    signals.push({ label: "Several colleagues involved", points: 2, detail: `${staff.size} internal senders` });
  }

  return { signals, twoWay };
}

/* ------------------------------------------------------------ layer 3 -- */

function lexicon(thread: ParsedThread, twoWay: boolean): Signal[] {
  const haystack = thread.messages
    .map((message) => `${message.subject}\n${message.body}`)
    .join("\n")
    .toLowerCase();

  const hits: Signal[] = [];
  const cap = twoWay ? 8 : 4;
  let positive = 0;

  for (const entry of TERM_MATCHERS) {
    /* Each term counts once per thread, so repetition cannot inflate a score. */
    if (!entry.pattern.test(haystack)) continue;

    if (entry.points > 0) {
      /* Vocabulary alone must never clear the accept bar, and it counts for
         less when there is no conversation behind it. */
      if (positive >= cap) continue;
      positive += entry.points;
    }
    hits.push({
      label: `Trade term: ${entry.term}`,
      points: entry.points,
      detail: entry.note,
    });
  }

  return hits;
}

/* ------------------------------------------------------------ layer 4 -- */

function signature(thread: ParsedThread, context: MailboxContext): { signals: Signal[]; extracted: Extracted } {
  const inbound = thread.messages.filter((message) => !isInternal(message.from, context));
  const merged: Extracted = {};

  /* Newest first: a title in a recent message beats one from three years ago. */
  for (const message of [...inbound].reverse()) {
    const parsed = parseSignature(message.body);
    merged.name ??= parsed.name;
    merged.designation ??= parsed.designation;
    merged.phone ??= parsed.phone;
    merged.company ??= parsed.company;
    if (merged.name && merged.designation && merged.phone && merged.company) break;
  }

  const signals: Signal[] = [];
  if (isBuyingTitle(merged.designation)) {
    signals.push({ label: "Signature shows a buying role", points: 5, detail: merged.designation });
  } else if (merged.designation) {
    signals.push({ label: "Signature shows a job title", points: 1, detail: merged.designation });
  }
  if (merged.phone) {
    signals.push({ label: "Direct phone in signature", points: 1, detail: merged.phone });
  }

  return { signals, extracted: merged };
}

/* ------------------------------------------------------- domain signals -- */

function domainSignals(counterparty: ParsedAddress | undefined): Signal[] {
  if (!counterparty) return [];
  const domain = domainOf(counterparty.email);
  if (!domain) return [];

  if (FREE_PROVIDERS.has(domain)) {
    return [{ label: "Personal email provider", points: -1, detail: "Company unknown from the address" }];
  }
  return [{ label: "Company domain", points: 1, detail: domain }];
}

/* ------------------------------------------------------------- status -- */

/**
 * Conversation status read off the thread shape — requirement 3 derived
 * rather than hand-set, so it cannot drift out of date.
 */
export function deriveStatus(
  thread: ParsedThread,
  context: MailboxContext,
  now = new Date(),
): ContactStatus {
  const ordered = [...thread.messages].sort((a, b) => a.date.localeCompare(b.date));
  if (ordered.length === 0) return "never_contacted";

  const outbound = ordered.filter((message) => isInternal(message.from, context));
  const inbound = ordered.filter((message) => !isInternal(message.from, context));
  const last = ordered[ordered.length - 1];
  const lastWasInbound = !isInternal(last.from, context);
  const daysSinceLast = Math.round((now.getTime() - new Date(last.date).getTime()) / DAY);

  if (inbound.length === 0) {
    if (outbound.length === 0) return "never_contacted";
    /* We wrote and heard nothing. A month of silence is a non-answer. */
    if (daysSinceLast > 30) return "no_reply";
    return outbound.length === 1 ? "introduction_sent" : "waiting_for_buyer";
  }

  const enquiry = /\b(rfq|quotation|proforma|purchase order|moq|enquiry|inquiry|anfrage|devis|presupuesto|preventivo)\b/i;
  const buyerAskedForSomething = inbound.some((message) =>
    enquiry.test(`${message.subject} ${message.body}`),
  );

  if (lastWasInbound) {
    if (buyerAskedForSomething) return "enquiry_received";
    return "buyer_replied";
  }

  /* They replied at some point, but we spoke last. */
  if (buyerAskedForSomething) return "active_lead";
  if (daysSinceLast > 30) return "follow_up_required";
  return "conversation_started";
}

/* --------------------------------------------------------------- main -- */

export function classifyThread(
  thread: ParsedThread,
  context: MailboxContext,
  now = new Date(),
): Classification {
  const times = thread.messages
    .map((message) => message.date)
    .filter(Boolean)
    .sort();

  const base = {
    threadId: thread.id,
    messageCount: thread.messages.length,
    firstAt: times[0],
    lastAt: times[times.length - 1],
  };

  const [counterparty] = counterparties(thread, context);

  const excluded = exclude(thread, context);
  if (excluded) {
    return {
      ...base,
      verdict: "not_buyer",
      score: 0,
      /* Keep the counterparty: the review screen needs to say who was
         excluded, not just that something was. */
      counterparty,
      signals: [{ label: "Excluded", points: 0, detail: EXCLUSION_LABELS[excluded] }],
      excluded,
      extracted: {},
      status: "never_contacted",
    };
  }

  const { signals: signatureSignals, extracted } = signature(thread, context);

  const { signals: reciprocitySignals, twoWay } = reciprocity(thread, context, counterparty);

  const signals: Signal[] = [
    ...reciprocitySignals,
    ...lexicon(thread, twoWay),
    ...signatureSignals,
    ...domainSignals(counterparty),
  ];

  const score = signals.reduce((sum, signal) => sum + signal.points, 0);

  const verdict: Verdict =
    score >= THRESHOLDS.accept ? "buyer" : score <= THRESHOLDS.reject ? "not_buyer" : "review";

  if (counterparty?.name && !extracted.name) extracted.name = counterparty.name;

  return {
    ...base,
    verdict,
    score,
    counterparty,
    signals: signals.sort((a, b) => Math.abs(b.points) - Math.abs(a.points)),
    extracted,
    status: deriveStatus(thread, context, now),
  };
}

export function classifyAll(
  threads: ParsedThread[],
  context: MailboxContext,
  now = new Date(),
): Classification[] {
  return threads.map((thread) => classifyThread(thread, context, now));
}

/** Counts for the ingestion summary screen. */
export function summarise(results: Classification[]) {
  const byVerdict = { buyer: 0, review: 0, not_buyer: 0 };
  const byExclusion = new Map<ExclusionReason, number>();

  for (const result of results) {
    byVerdict[result.verdict] += 1;
    if (result.excluded) {
      byExclusion.set(result.excluded, (byExclusion.get(result.excluded) ?? 0) + 1);
    }
  }

  return { total: results.length, byVerdict, byExclusion };
}
