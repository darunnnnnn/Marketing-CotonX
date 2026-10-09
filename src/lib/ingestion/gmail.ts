/**
 * Gmail API message format -> the shared ParsedMessage shape.
 *
 * The second ingestion route, alongside the Takeout mbox reader. Both produce
 * the same ParsedThread, so the classifier, signature parser and status
 * derivation are identical either way — only the transport differs.
 *
 * Pure functions with no network and no Deno globals, so this is testable here
 * and importable by the Edge Function that does the fetching.
 */

import type { ParsedAddress, ParsedMessage, ParsedThread } from "./types.ts";
import { decodeWords, parseAddresses, stripQuoted } from "./mbox.ts";
import { htmlToText } from "./html.ts";

/* ------------------------------------------------- Gmail API wire types -- */

export type GmailHeader = { name: string; value: string };

export type GmailPart = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: GmailPart[];
};

export type GmailMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart;
};

export type GmailThread = {
  id: string;
  messages?: GmailMessage[];
};

/* --------------------------------------------------------------- utils -- */

/** Gmail uses base64url with the padding stripped. */
export function decodeBase64Url(data: string): string {
  const normalised = data.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalised + "=".repeat((4 - (normalised.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return "";
  }
}

/** Header lookup is case-insensitive; Gmail does not normalise names. */
export function headerMap(headers: GmailHeader[] | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  for (const header of headers ?? []) {
    const key = header.name.toLowerCase();
    map[key] = map[key] ? `${map[key]} ${header.value}` : header.value;
  }
  return map;
}

/**
 * Walks the MIME tree for the readable body, preferring text/plain.
 * Attachments are skipped entirely — we never download them.
 */
export function extractBody(part: GmailPart | undefined): string {
  if (!part) return "";

  const mime = (part.mimeType ?? "").toLowerCase();

  if (part.filename) return "";

  if (!part.parts?.length) {
    const data = part.body?.data;
    if (!data) return "";
    const text = decodeBase64Url(data);
    return mime === "text/html" ? htmlToText(text) : text;
  }

  let html = "";
  for (const child of part.parts) {
    const childMime = (child.mimeType ?? "").toLowerCase();
    if (childMime.startsWith("multipart/")) {
      const nested = extractBody(child);
      if (nested.trim()) return nested;
      continue;
    }
    if (child.filename) continue;
    if (childMime === "text/plain") {
      const text = extractBody(child);
      if (text.trim()) return text;
    }
    if (childMime === "text/html" && !html) {
      html = extractBody(child);
    }
  }
  return html;
}

/* --------------------------------------------------------------- main -- */

/** Converts one Gmail API message into the shared shape. */
export function toParsedMessage(message: GmailMessage): ParsedMessage | null {
  const headers = headerMap(message.payload?.headers);
  const from: ParsedAddress | undefined = parseAddresses(headers["from"])[0];
  if (!from) return null;

  /* internalDate is authoritative and already epoch milliseconds; the Date
     header is whatever the sender's clock said. */
  const epoch = Number(message.internalDate);
  const headerDate = headers["date"] ? new Date(headers["date"]) : null;
  const date = Number.isFinite(epoch) && epoch > 0
    ? new Date(epoch).toISOString()
    : headerDate && Number.isFinite(headerDate.getTime())
      ? headerDate.toISOString()
      : new Date(0).toISOString();

  return {
    id: headers["message-id"]?.trim() || message.id,
    threadId: message.threadId,
    from,
    to: parseAddresses(headers["to"]),
    cc: parseAddresses(headers["cc"]),
    subject: decodeWords(headers["subject"] ?? "").trim(),
    date,
    body: stripQuoted(extractBody(message.payload) || message.snippet || ""),
    headers,
  };
}

/**
 * Converts a Gmail thread. Gmail has already done the threading, so unlike the
 * mbox route there is nothing to infer — its threadId is authoritative.
 */
export function toParsedThread(thread: GmailThread): ParsedThread | null {
  const messages = (thread.messages ?? [])
    .map(toParsedMessage)
    .filter((message): message is ParsedMessage => message !== null)
    .map((message) => ({ ...message, threadId: thread.id }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (messages.length === 0) return null;
  return { id: thread.id, messages };
}

export function toParsedThreads(threads: GmailThread[]): ParsedThread[] {
  return threads
    .map(toParsedThread)
    .filter((thread): thread is ParsedThread => thread !== null);
}

/* -------------------------------------------------------------- labels -- */

/** Labels Gmail applies that mark a thread as not worth classifying. */
const SKIP_LABELS = new Set(["SPAM", "TRASH", "DRAFT", "CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL"]);

export function shouldSkip(message: GmailMessage): boolean {
  return (message.labelIds ?? []).some((label) => SKIP_LABELS.has(label));
}

/**
 * The Gmail search query for a backfill.
 *
 * Narrowing server-side matters: the API bills quota per message fetched, and
 * Gmail can exclude chats, spam and promotions before anything crosses the
 * wire. `category:promotions` alone removes most of what the exclusion layer
 * would otherwise have to process.
 */
export function backfillQuery(years = 3): string {
  return [
    `newer_than:${years}y`,
    "-in:chats",
    "-in:spam",
    "-in:trash",
    "-category:promotions",
    "-category:social",
    "-category:forums",
  ].join(" ");
}
