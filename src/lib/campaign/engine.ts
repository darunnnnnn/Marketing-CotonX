/**
 * The campaign engine. Pure functions over the domain model — no I/O, no React —
 * so the rules that decide who gets contacted are testable in isolation and
 * identical whether they run in the browser or in an Edge Function.
 *
 * Implements requirements 15 (country send windows), 16 (sequence memory),
 * 17 (approval before send) and 20 (reply stops the sequence).
 */

import { nextSendSlot } from "../domain/countries";
import { HUMAN_OWNED } from "../domain/types";
import type {
  Campaign,
  Company,
  Contact,
  Id,
  OutreachEvent,
  QueueItem,
  SequenceStep,
  Suppression,
  Template,
} from "../domain/types";

export type SkipReason =
  | "wrong_country"
  | "wrong_status"
  | "human_owned"
  | "suppressed"
  | "do_not_contact"
  | "unverified"
  | "sequence_complete"
  | "waiting_for_delay";

export const SKIP_LABELS: Record<SkipReason, string> = {
  wrong_country: "Not in a targeted country",
  wrong_status: "Status is outside this campaign's target",
  human_owned: "Owned by the sales team — a human is already talking to them",
  suppressed: "On the suppression list",
  do_not_contact: "Marked do-not-contact",
  unverified: "Contact not verified yet",
  sequence_complete: "Already finished every step of this sequence",
  waiting_for_delay: "Next step is not due yet",
};

export type Eligibility =
  | { eligible: true; contact: Contact; step: SequenceStep; stepIndex: number }
  | { eligible: false; contact: Contact; reason: SkipReason };

export type PlanRow = {
  contact: Contact;
  company: Company;
  step: SequenceStep;
  template?: Template;
  sendAt: Date;
  localLabel: string;
};

export type Plan = {
  campaign: Campaign;
  rows: PlanRow[];
  skipped: { contact: Contact; reason: SkipReason }[];
  /** Skip counts by reason, for the summary strip. */
  tally: Partial<Record<SkipReason, number>>;
};

const dayMs = 86_400_000;

/**
 * Where a contact sits in this campaign's sequence, and whether the next step
 * is due. Requirement 16 — re-running a country must not restart the intro.
 */
export function evaluate(
  contact: Contact,
  company: Company | undefined,
  campaign: Campaign,
  suppressed: Set<string>,
  now = new Date(),
): Eligibility {
  if (!company || !campaign.countryCodes.includes(company.countryCode)) {
    return { eligible: false, contact, reason: "wrong_country" };
  }
  if (contact.doNotContact) {
    return { eligible: false, contact, reason: "do_not_contact" };
  }
  /* The reply-stop rule outranks everything else. */
  if (HUMAN_OWNED.includes(contact.status)) {
    return { eligible: false, contact, reason: "human_owned" };
  }
  if (suppressed.has(contact.email.toLowerCase())) {
    return { eligible: false, contact, reason: "suppressed" };
  }
  if (!contact.verified) {
    return { eligible: false, contact, reason: "unverified" };
  }

  const position = contact.sequencePosition[campaign.id] ?? 0;
  const ordered = [...campaign.steps].sort((a, b) => a.order - b.order);

  if (position >= ordered.length) {
    return { eligible: false, contact, reason: "sequence_complete" };
  }

  /* A contact already in the sequence keeps going; a new one must match the
     campaign's entry statuses. */
  if (position === 0 && !campaign.targetStatuses.includes(contact.status)) {
    return { eligible: false, contact, reason: "wrong_status" };
  }

  const step = ordered[position];

  if (position > 0 && contact.lastTouchAt) {
    const due = new Date(contact.lastTouchAt).getTime() + step.delayDays * dayMs;
    if (due > now.getTime()) {
      return { eligible: false, contact, reason: "waiting_for_delay" };
    }
  }

  return { eligible: true, contact, step, stepIndex: position };
}

/**
 * Builds the full send plan for a campaign: who gets which step, when in their
 * own local time, and why everyone else was left out.
 */
export function buildPlan(
  campaign: Campaign,
  contacts: Contact[],
  companies: Company[],
  templates: Template[],
  suppressions: Suppression[],
  now = new Date(),
): Plan {
  const companyById = new Map(companies.map((company) => [company.id, company]));
  const templateById = new Map(templates.map((template) => [template.id, template]));
  const suppressed = new Set(
    suppressions.filter((item) => item.scope === "email").map((item) => item.value.toLowerCase()),
  );
  const suppressedDomains = new Set(
    suppressions.filter((item) => item.scope === "domain").map((item) => item.value.toLowerCase()),
  );

  const rows: PlanRow[] = [];
  const skipped: { contact: Contact; reason: SkipReason }[] = [];
  const tally: Partial<Record<SkipReason, number>> = {};

  for (const contact of contacts) {
    const company = companyById.get(contact.companyId);
    const domain = contact.email.split("@")[1]?.toLowerCase() ?? "";
    const effectivelySuppressed = suppressedDomains.has(domain) ? new Set([...suppressed, contact.email.toLowerCase()]) : suppressed;

    const verdict = evaluate(contact, company, campaign, effectivelySuppressed, now);

    if (!verdict.eligible) {
      skipped.push({ contact, reason: verdict.reason });
      tally[verdict.reason] = (tally[verdict.reason] ?? 0) + 1;
      continue;
    }

    const sendAt = nextSendSlot(company!.countryCode, now);
    rows.push({
      contact,
      company: company!,
      step: verdict.step,
      template: templateById.get(verdict.step.templateId),
      sendAt,
      localLabel: new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(sendAt),
    });
  }

  rows.sort((a, b) => a.sendAt.getTime() - b.sendAt.getTime());
  return { campaign, rows, skipped, tally };
}

export function planToQueue(plan: Plan): QueueItem[] {
  return plan.rows.map((row, index) => ({
    id: `q-${plan.campaign.id}-${row.contact.id}-${index}`,
    contactId: row.contact.id,
    campaignId: plan.campaign.id,
    stepId: row.step.id,
    channel: row.step.channel,
    localSendAt: row.localLabel,
    sendAtUtc: row.sendAt.toISOString(),
    status: "queued",
  }));
}

/**
 * Requirement 20. A reply ends the automated sequence and hands the buyer to a
 * person. Deliberately unconditional: if we are unsure a message is a reply, we
 * still stop, because a duplicate handoff is cheap and an automated email on
 * top of a live sales conversation is not.
 */
export function applyReply(contact: Contact, at = new Date()): {
  contact: Contact;
  events: Omit<OutreachEvent, "id">[];
  suppression: Omit<Suppression, "id">;
} {
  const when = at.toISOString();
  return {
    contact: { ...contact, status: "buyer_replied", lastReplyAt: when },
    events: [
      { contactId: contact.id, channel: "email", type: "replied", at: when },
      {
        contactId: contact.id,
        channel: "email",
        type: "stopped",
        at: when,
        detail: "Buyer replied - sequence halted, handed to sales",
      },
    ],
    suppression: { value: contact.email, scope: "email", reason: "human_owned", at: when },
  };
}

/** Fills {{merge_fields}} in a template for a specific contact. */
export function render(template: Template, contact: Contact, company: Company): { subject: string; body: string } {
  const values: Record<string, string> = {
    contact_name: contact.name ?? "Sir or Madam",
    first_name: contact.name?.split(" ")[0] ?? "there",
    company_name: company.name,
    country: company.country,
    designation: contact.designation ?? "",
    last_touch_date: contact.lastTouchAt
      ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" }).format(new Date(contact.lastTouchAt))
      : "my previous note",
  };

  const fill = (text: string) =>
    text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => values[key] ?? match);

  return { subject: fill(template.subject), body: fill(template.body) };
}

/** Counts per status for a campaign's audience, for the dashboard strip. */
export function summarise(plan: Plan) {
  const byStep = new Map<Id, number>();
  for (const row of plan.rows) {
    byStep.set(row.step.id, (byStep.get(row.step.id) ?? 0) + 1);
  }
  return {
    willSend: plan.rows.length,
    skipped: plan.skipped.length,
    byStep,
    countries: new Set(plan.rows.map((row) => row.company.countryCode)).size,
  };
}
