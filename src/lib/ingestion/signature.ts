/**
 * Signature block extraction.
 *
 * A buyer's signature carries their job title, direct phone and company — the
 * same fields Apollo charges a credit for. Three years of mail is full of them.
 *
 * Deliberately conservative: a wrong designation is worse than none, because it
 * flows into campaign personalisation and the review queue trusts it.
 */

import { BUYING_TITLES } from "./lexicon.ts";
import type { Extracted } from "./types.ts";

/* Enough digits to be a real number, loose enough for European formats. */
const PHONE_RE = /(?:\+|00)\d[\d\s().-]{7,20}\d|\b0\d[\d\s().-]{7,18}\d\b/g;

const SIGNATURE_MARKERS = [
  /^--\s*$/,
  /^-{2,}\s*$/,
  /^_{2,}\s*$/,
  /^(?:best|kind|warm)\s+regards[,.]?\s*$/i,
  /^regards[,.]?\s*$/i,
  /^sincerely[,.]?\s*$/i,
  /^thanks(?:\s+and\s+regards)?[,.]?\s*$/i,
  /^thank you[,.]?\s*$/i,
  /^mit freundlichen gr(?:ü|ue)(?:ß|ss)en[,.]?\s*$/i,
  /^met vriendelijke groet(?:en)?[,.]?\s*$/i,
  /^cordialement[,.]?\s*$/i,
  /^bien cordialement[,.]?\s*$/i,
  /^saludos(?:\s+cordiales)?[,.]?\s*$/i,
  /^cordiali saluti[,.]?\s*$/i,
  /^distinti saluti[,.]?\s*$/i,
];

const PHONE_LABEL_RE =
  /^(?:tel|telephone|phone|mobile|mob|cell|direct|t|m|p|fon|festnetz|tél|telefono|teléfono)[.:\s]/i;

const COMPANY_SUFFIX_RE =
  /\b(?:gmbh(?:\s*&\s*co\.?\s*kg)?|ag|kg|ohg|mbh|b\.?v\.?|n\.?v\.?|s\.?a\.?r\.?l\.?|s\.?a\.?s\.?|s\.?p\.?a\.?|s\.?r\.?l\.?|s\.?l\.?|ltd|limited|llc|inc|corp|plc|oy|ab|aps|a\/s)\b\.?/i;

const NOISE_RE =
  /(confidential|disclaimer|privacy|unsubscribe|sent from my|this (?:e-?mail|message)|please consider the environment|registered (?:office|in)|vat\s|ust-?id|handelsregister|kvk)/i;

/** Finds where the signature starts, or null if there is no clear marker. */
function signatureStart(lines: string[]): number | null {
  /* Search from the bottom: a quoted reply can contain earlier sign-offs. */
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (SIGNATURE_MARKERS.some((marker) => marker.test(lines[index].trim()))) {
      return index + 1;
    }
  }
  return null;
}

function cleanPhone(raw: string): string {
  const trimmed = raw.trim().replace(/[\s().-]+$/, "");
  const digits = trimmed.replace(/\D/g, "");
  /* Reject dates, order numbers and years masquerading as numbers. */
  if (digits.length < 9 || digits.length > 15) return "";
  return trimmed.replace(/\s{2,}/g, " ");
}

function looksLikeName(line: string): boolean {
  if (line.length > 48 || line.length < 4) return false;
  if (/[@|/\\]|www\.|https?:/i.test(line)) return false;
  if (/\d/.test(line)) return false;
  const words = line.split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  /* Initial capitals on at least two words. */
  return words.filter((word) => /^[A-ZÄÖÜÁÉÍÓÚÀÈÌÒÙÇÑ]/.test(word)).length >= 2;
}

/**
 * Pulls name, designation, phone and company out of a message body.
 * Every field is optional; absence is the normal case.
 */
export function parseSignature(body: string): Extracted {
  const found: Extracted = {};
  const allLines = body.split(/\r?\n/);

  const start = signatureStart(allLines);
  /* With no marker, fall back to the last few lines — most signatures live
     there — but never scan the whole body, which produces false positives. */
  const block = (start !== null ? allLines.slice(start) : allLines.slice(-12))
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !NOISE_RE.test(line))
    .slice(0, 12);

  if (block.length === 0) return found;

  for (const line of block) {
    const lower = line.toLowerCase();

    if (!found.designation) {
      const title = BUYING_TITLES.find((candidate) => lower.includes(candidate));
      if (title) {
        /* Keep the writer's own capitalisation and wording. */
        found.designation = line.length <= 60 ? line.replace(/^[-•|\s]+/, "") : title;
      }
    }

    if (!found.phone) {
      const labelled = PHONE_LABEL_RE.test(line);
      const matches = line.match(PHONE_RE);
      if (matches) {
        for (const match of matches) {
          const phone = cleanPhone(match);
          /* An unlabelled number needs to look international to be trusted. */
          if (phone && (labelled || phone.startsWith("+") || phone.startsWith("00"))) {
            found.phone = phone;
            break;
          }
        }
      }
    }

    if (!found.company && COMPANY_SUFFIX_RE.test(line) && line.length <= 60) {
      found.company = line.replace(/^[-•|\s]+/, "").trim();
    }

    if (!found.name && looksLikeName(line)) {
      found.name = line;
    }
  }

  return found;
}

/** True when a title is a buying role — a strong buyer signal on its own. */
export function isBuyingTitle(title: string | undefined): boolean {
  if (!title) return false;
  const lower = title.toLowerCase();
  return BUYING_TITLES.some((candidate) => lower.includes(candidate));
}
