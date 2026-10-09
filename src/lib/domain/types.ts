/**
 * The domain model. These types are the schema design — the Phase 1 Postgres
 * migration is generated from them, so changes here are schema changes.
 *
 * Deliberately channel-agnostic: campaigns, steps and events carry a `channel`
 * so WhatsApp and voice reuse the engine instead of forking it.
 */

import type { SourceId } from "../enrichment/types.ts";

export type Id = string;

/* ---------------------------------------------------------------- buyers -- */

export type Company = {
  id: Id;
  name: string;
  domain?: string;
  website?: string;
  countryCode: string;
  country: string;
  city?: string;
  industry?: string;
  employeeCount?: number;
  verified: boolean;
  sources: SourceId[];
  createdAt: string;
};

/** The nine statuses of requirement §3, derived rather than hand-set. */
export type ContactStatus =
  | "never_contacted"
  | "introduction_sent"
  | "conversation_started"
  | "buyer_replied"
  | "waiting_for_buyer"
  | "no_reply"
  | "follow_up_required"
  | "enquiry_received"
  | "active_lead";

export const STATUS_LABELS: Record<ContactStatus, string> = {
  never_contacted: "Never contacted",
  introduction_sent: "Introduction sent",
  conversation_started: "Conversation started",
  buyer_replied: "Buyer replied",
  waiting_for_buyer: "Waiting for buyer",
  no_reply: "No reply",
  follow_up_required: "Follow-up required",
  enquiry_received: "Enquiry received",
  active_lead: "Active lead",
};

/** Statuses that mean a human owns the relationship — campaigns must not touch these. */
export const HUMAN_OWNED: ContactStatus[] = ["buyer_replied", "enquiry_received", "active_lead"];

export type RolePriority = "high" | "medium" | "low";

export type Contact = {
  id: Id;
  companyId: Id;
  name?: string;
  email: string;
  phone?: string;
  designation?: string;
  roleCategory?: string;
  rolePriority: RolePriority;
  linkedin?: string;
  preferredLanguage: string;
  status: ContactStatus;
  lastTouchAt?: string;
  lastReplyAt?: string;
  /** Where in a sequence this contact sits — requirement §16. */
  sequencePosition: Record<Id, number>;
  verified: boolean;
  sources: SourceId[];
  doNotContact: boolean;
  callConsent: boolean;
  createdAt: string;
};

export type MergeCandidate = {
  id: Id;
  reason: string;
  score: number;
  contactIds: [Id, Id];
};

/* ------------------------------------------------------------- campaigns -- */

export type Channel = "email" | "whatsapp" | "sms" | "voice";

export type CampaignKind = "introduction" | "category" | "collection" | "proof" | "follow_up" | "event";

export const CAMPAIGN_KIND_LABELS: Record<CampaignKind, string> = {
  introduction: "Introduction",
  category: "Category",
  collection: "Collection",
  proof: "Capability proof",
  follow_up: "Follow-up",
  event: "Fair / event",
};

export type CampaignStatus = "draft" | "pending_approval" | "approved" | "scheduled" | "running" | "paused" | "done";

export type SequenceStep = {
  id: Id;
  order: number;
  channel: Channel;
  kind: CampaignKind;
  templateId: Id;
  /** Days to wait after the previous step before this one may send. */
  delayDays: number;
};

export type Campaign = {
  id: Id;
  name: string;
  kind: CampaignKind;
  channel: Channel;
  status: CampaignStatus;
  countryCodes: string[];
  /** Only contacts in these statuses are eligible. */
  targetStatuses: ContactStatus[];
  steps: SequenceStep[];
  approvedBy?: string;
  approvedAt?: string;
  scheduledFrom?: string;
  createdAt: string;
};

export type Template = {
  id: Id;
  name: string;
  kind: CampaignKind;
  channel: Channel;
  language: string;
  subject: string;
  body: string;
  attachments: string[];
};

/* -------------------------------------------------------------- outreach -- */

export type OutreachEventType =
  | "queued"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "replied"
  | "bounced"
  | "complained"
  | "unsubscribed"
  | "stopped";

export type OutreachEvent = {
  id: Id;
  contactId: Id;
  campaignId?: Id;
  stepId?: Id;
  channel: Channel;
  type: OutreachEventType;
  at: string;
  detail?: string;
};

export type QueueItem = {
  id: Id;
  contactId: Id;
  campaignId: Id;
  stepId: Id;
  channel: Channel;
  /** Local time in the buyer's country that this is aimed at. */
  localSendAt: string;
  sendAtUtc: string;
  status: "queued" | "held" | "sent" | "cancelled";
  heldReason?: string;
};

export type Handoff = {
  id: Id;
  contactId: Id;
  campaignId?: Id;
  reason: string;
  at: string;
  resolved: boolean;
};

export type Suppression = {
  id: Id;
  value: string;
  scope: "email" | "domain";
  reason: "unsubscribe" | "bounce" | "complaint" | "manual" | "human_owned";
  at: string;
};
