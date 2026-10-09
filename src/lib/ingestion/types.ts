/**
 * Types for turning raw mailbox history into buyer records.
 *
 * The classifier works on threads, not messages. A single email is ambiguous;
 * a conversation is not. Everything here is plain data so the classifier stays
 * pure functions, testable without a mailbox.
 */

import type { ContactStatus } from "../domain/types";

export type ParsedAddress = {
  name?: string;
  email: string;
};

export type ParsedMessage = {
  id: string;
  threadId: string;
  from: ParsedAddress;
  to: ParsedAddress[];
  cc: ParsedAddress[];
  subject: string;
  /** ISO 8601. */
  date: string;
  /** Plain text, quoted history already stripped. */
  body: string;
  /** Lower-cased header names. */
  headers: Record<string, string>;
};

export type ParsedThread = {
  id: string;
  messages: ParsedMessage[];
};

/** Who we are, so the classifier can tell inbound from outbound. */
export type MailboxContext = {
  /** Every address the Cotonex team sends from. */
  ownAddresses: Set<string>;
  /** Domains belonging to Cotonex. */
  ownDomains: Set<string>;
  /** Suppliers, banks, software — correspondents who are not buyers. */
  vendorDomains: Set<string>;
};

export type ExclusionReason =
  | "no_counterparty"
  | "internal_only"
  | "automated_sender"
  | "bulk_mail"
  | "auto_reply"
  | "calendar_invite"
  | "marketing_platform"
  | "vendor_domain"
  | "free_provider_one_shot";

export const EXCLUSION_LABELS: Record<ExclusionReason, string> = {
  no_counterparty: "No external correspondent in the thread",
  internal_only: "Everyone on the thread is internal",
  automated_sender: "Sent from an unattended mailbox",
  bulk_mail: "Bulk or list mail",
  auto_reply: "Automatic reply",
  calendar_invite: "Calendar invitation",
  marketing_platform: "Sent through a marketing platform",
  vendor_domain: "Correspondent is a known vendor, not a buyer",
  free_provider_one_shot: "Single unanswered message from a personal address",
};

/** One reason the score moved, so any verdict can be explained. */
export type Signal = {
  label: string;
  points: number;
  detail?: string;
};

export type Verdict = "buyer" | "review" | "not_buyer";

export type Extracted = {
  name?: string;
  designation?: string;
  phone?: string;
  company?: string;
  country?: string;
};

export type Classification = {
  threadId: string;
  verdict: Verdict;
  score: number;
  /** The external party — who the buyer record would be built from. */
  counterparty?: ParsedAddress;
  signals: Signal[];
  excluded?: ExclusionReason;
  extracted: Extracted;
  /** Derived from thread shape, not guessed. */
  status: ContactStatus;
  messageCount: number;
  firstAt?: string;
  lastAt?: string;
};

/** Score bands. Tuned so the middle band stays small enough to review by hand. */
export const THRESHOLDS = {
  accept: 8,
  reject: 2,
} as const;
