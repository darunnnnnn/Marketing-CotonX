/**
 * mbox parsing for Google Takeout exports.
 *
 * Takeout gives one .mbox file per mailbox, which needs no API access and no
 * Workspace domain — so ingestion can be built and tested before the Gmail
 * access question is settled.
 *
 * Only what the classifier needs is decoded: participants, subject, date,
 * plain-text body and the headers the exclusion layer reads.
 */

import type { ParsedAddress, ParsedMessage, ParsedThread } from "./types.ts";
import { htmlToText } from "./html.ts";

/* A line beginning "From " at the start of a message is the mbox separator. */
const SEPARATOR = /^From \S+.*\d{4}$/;

/** Splits an mbox into raw message blocks. */
export function splitMbox(content: string): string[] {
  const lines = content.split(/\r?\n/);
  const blocks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (SEPARATOR.test(line) && current.length > 0) {
      blocks.push(current.join("\n"));
      current = [];
      continue;
    }
    if (SEPARATOR.test(line) && current.length === 0) continue;
    /* mboxrd quoting: ">From " at line start is an escaped body line. */
    current.push(line.replace(/^>(>*From )/, "$1"));
  }
  if (current.length > 0) blocks.push(current.join("\n"));
  return blocks.filter((block) => block.trim().length > 0);
}

/** Splits one message into headers and body, unfolding continuation lines. */
export function splitHeaders(raw: string): { headers: Record<string, string>; body: string } {
  const lines = raw.split(/\r?\n/);
  const headers: Record<string, string> = {};
  let index = 0;
  let name = "";

  for (; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "") {
      index += 1;
      break;
    }
    if (/^\s/.test(line) && name) {
      /* Folded continuation of the previous header. */
      headers[name] += ` ${line.trim()}`;
      continue;
    }
    const match = line.match(/^([!-9;-~]+):\s*(.*)$/);
    if (!match) continue;
    name = match[1].toLowerCase();
    /* Repeated headers such as Received are concatenated, not overwritten. */
    headers[name] = headers[name] ? `${headers[name]} ${match[2]}` : match[2];
  }

  return { headers, body: lines.slice(index).join("\n") };
}

/** Decodes RFC 2047 encoded words, which Takeout leaves in subject lines. */
export function decodeWords(input: string): string {
  return input.replace(
    /=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g,
    (match, _charset: string, encoding: string, text: string) => {
      try {
        if (encoding.toLowerCase() === "b") {
          return decodeBase64(text);
        }
        /* Decode to bytes first, then as UTF-8. Mapping each byte straight to
           a character yields Latin-1 mojibake on anything non-ASCII. */
        return decodeQuotedPrintable(text.replace(/_/g, " "));
      } catch {
        return match;
      }
    },
  );
}

function decodeBase64(text: string): string {
  const binary = atob(text.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function decodeQuotedPrintable(text: string): string {
  const joined = text.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let index = 0; index < joined.length; index += 1) {
    if (joined[index] === "=" && /[0-9A-Fa-f]{2}/.test(joined.slice(index + 1, index + 3))) {
      bytes.push(parseInt(joined.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(joined.charCodeAt(index));
    }
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(Uint8Array.from(bytes));
}

/** Parses an address list: `Name <a@b.c>, "Other, X" <d@e.f>`. */
export function parseAddresses(input: string | undefined): ParsedAddress[] {
  if (!input) return [];
  const out: ParsedAddress[] = [];
  let buffer = "";
  let quoted = false;

  const flush = () => {
    const piece = buffer.trim();
    buffer = "";
    if (!piece) return;

    const angled = piece.match(/<([^>]+)>/);
    const email = (angled ? angled[1] : piece).trim().toLowerCase();
    if (!email.includes("@")) return;

    let name = angled ? piece.slice(0, angled.index).trim() : "";
    name = decodeWords(name).replace(/^["']|["']$/g, "").trim();
    out.push(name ? { name, email } : { email });
  };

  for (const char of input) {
    if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      flush();
      continue;
    }
    buffer += char;
  }
  flush();
  return out;
}

/** Strips quoted history so the classifier scores what this person wrote. */
export function stripQuoted(body: string): string {
  const lines = body.split(/\r?\n/);
  const kept: string[] = [];

  for (const line of lines) {
    if (/^\s*>/.test(line)) continue;
    if (/^\s*On .{10,80}\bwrote:\s*$/i.test(line)) break;
    if (/^\s*-{2,}\s*(original message|forwarded message)\s*-{2,}/i.test(line)) break;
    if (/^\s*(From|Von|De|Da):\s*.+<[^>]+>\s*$/i.test(line) && kept.length > 2) break;
    if (/^\s*_{10,}\s*$/.test(line)) break;
    kept.push(line);
  }

  return kept.join("\n").trim();
}

/** Takes the text/plain part from a multipart body. */
function extractPlainText(headers: Record<string, string>, body: string): string {
  const contentType = headers["content-type"] ?? "";
  const boundary = contentType.match(/boundary="?([^";\s]+)"?/i)?.[1];

  if (!boundary) {
    const encoding = (headers["content-transfer-encoding"] ?? "").toLowerCase();
    let text = body;
    if (encoding === "base64") {
      try {
        text = decodeBase64(body);
      } catch {
        /* Leave it as-is; a mangled body still scores on its headers. */
      }
    } else if (encoding === "quoted-printable") {
      text = decodeQuotedPrintable(body);
    }
    return /text\/html/i.test(contentType) ? htmlToText(text) : text;
  }

  const parts = body.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:--)?`));
  let html = "";

  for (const part of parts) {
    const { headers: partHeaders, body: partBody } = splitHeaders(part.replace(/^\r?\n/, ""));
    const partType = partHeaders["content-type"] ?? "";
    if (/multipart\//i.test(partType)) {
      const nested = extractPlainText(partHeaders, partBody);
      if (nested.trim()) return nested;
      continue;
    }
    const decoded = extractPlainText(partHeaders, partBody);
    if (/text\/plain/i.test(partType)) return decoded;
    if (/text\/html/i.test(partType) && !html) html = decoded;
  }

  return html;
}

export function parseMessage(raw: string, index: number): ParsedMessage | null {
  const { headers, body } = splitHeaders(raw);
  const from = parseAddresses(headers["from"])[0];
  if (!from) return null;

  const parsedDate = headers["date"] ? new Date(headers["date"]) : null;
  const date =
    parsedDate && Number.isFinite(parsedDate.getTime())
      ? parsedDate.toISOString()
      : new Date(0).toISOString();

  return {
    id: headers["message-id"]?.trim() || `mbox-${index}`,
    threadId: "",
    from,
    to: parseAddresses(headers["to"]),
    cc: parseAddresses(headers["cc"]),
    subject: decodeWords(headers["subject"] ?? "").trim(),
    date,
    body: stripQuoted(extractPlainText(headers, body)),
    headers,
  };
}

/** Strips reply and forward prefixes, in the languages Cotonex deals in. */
export function normaliseSubject(subject: string): string {
  return subject
    .replace(/^(?:\s*(?:re|aw|fwd?|wg|tr|rv|r|sv|vs|antw|res)\s*(?:\[\d+\])?\s*:\s*)+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Union-find over message ids.
 *
 * Keying each message independently does not work: an original message has no
 * References, so it would key by subject, while its reply keys by the
 * original's id — and the two would never meet. Merging the two together is
 * the only way replies land in the same thread as what they reply to.
 */
class Grouping {
  private parent = new Map<string, string>();

  find(id: string): string {
    const seen = this.parent.get(id);
    if (seen === undefined) {
      this.parent.set(id, id);
      return id;
    }
    if (seen === id) return id;
    const root = this.find(seen);
    this.parent.set(id, root);
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootB, rootA);
  }
}

/** Parses an mbox file into threads, ready for the classifier. */
export function parseMbox(content: string): ParsedThread[] {
  const messages = splitMbox(content)
    .map((raw, index) => parseMessage(raw, index))
    .filter((message): message is ParsedMessage => message !== null);

  const groups = new Grouping();

  /* Link every message to the ids it references. */
  for (const message of messages) {
    groups.find(message.id);
    const related = [
      ...(message.headers["references"]?.trim().split(/\s+/) ?? []),
      message.headers["in-reply-to"]?.trim() ?? "",
    ].filter(Boolean);
    for (const reference of related) {
      groups.union(message.id, reference);
    }
  }

  /* Some clients drop References entirely, so also merge messages that share
     a normalised subject with someone they corresponded with. */
  const bySubject = new Map<string, ParsedMessage[]>();
  for (const message of messages) {
    const subject = normaliseSubject(message.subject);
    if (!subject) continue;
    const bucket = bySubject.get(subject);
    if (bucket) bucket.push(message);
    else bySubject.set(subject, [message]);
  }

  for (const bucket of bySubject.values()) {
    if (bucket.length < 2) continue;
    const participants = (message: ParsedMessage) =>
      new Set([message.from.email, ...message.to.map((a) => a.email), ...message.cc.map((a) => a.email)]);

    for (let index = 1; index < bucket.length; index += 1) {
      const previous = participants(bucket[index - 1]);
      const current = participants(bucket[index]);
      /* Same subject alone is not enough — a shared participant is needed,
         or unrelated "Enquiry" threads from different buyers would merge. */
      if ([...current].some((email) => previous.has(email))) {
        groups.union(bucket[index - 1].id, bucket[index].id);
      }
    }
  }

  const byThread = new Map<string, ParsedMessage[]>();
  for (const message of messages) {
    const key = groups.find(message.id);
    const bucket = byThread.get(key);
    if (bucket) bucket.push(message);
    else byThread.set(key, [message]);
  }

  return [...byThread.entries()].map(([key, group]) => ({
    id: key,
    messages: group
      .map((message) => ({ ...message, threadId: key }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  }));
}
