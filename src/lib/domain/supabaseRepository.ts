/**
 * The Postgres-backed Repository.
 *
 * Same interface as memoryRepo, so no screen changes. Mapping lives here and
 * nowhere else: the database speaks snake_case and the app speaks camelCase,
 * and letting that leak into components would spread it everywhere.
 */

import { supabase } from "../supabase";
import type { Row, Tables } from "../supabase";
import { HUMAN_OWNED } from "./types.ts";
import type {
  Campaign,
  Company,
  Contact,
  ContactStatus,
  Handoff,
  Id,
  MergeCandidate,
  OutreachEvent,
  SequenceStep,
  Suppression,
  Template,
} from "./types.ts";
import type { ContactFilter, CountrySegment, Repository } from "./repository.ts";
import type { SourceId } from "../enrichment/types.ts";

/* ------------------------------------------------------------ mapping -- */

const toCompany = (row: Row<"companies">): Company => ({
  id: row.id,
  name: row.name,
  domain: row.domain ?? undefined,
  website: row.website ?? undefined,
  countryCode: row.country_code,
  country: row.country,
  city: row.city ?? undefined,
  industry: row.industry ?? undefined,
  employeeCount: row.employee_count ?? undefined,
  verified: row.verified,
  sources: (row.sources ?? []) as SourceId[],
  createdAt: row.created_at,
});

const toContact = (row: Row<"contacts">): Contact => ({
  id: row.id,
  companyId: row.company_id,
  name: row.name ?? undefined,
  email: row.email,
  phone: row.phone ?? undefined,
  designation: row.designation ?? undefined,
  roleCategory: row.role_category ?? undefined,
  rolePriority: row.role_priority,
  linkedin: row.linkedin ?? undefined,
  preferredLanguage: row.preferred_language,
  status: row.status,
  lastTouchAt: row.last_touch_at ?? undefined,
  lastReplyAt: row.last_reply_at ?? undefined,
  sequencePosition: (row.sequence_position ?? {}) as Record<Id, number>,
  verified: row.verified,
  sources: (row.sources ?? []) as SourceId[],
  doNotContact: row.do_not_contact,
  callConsent: row.call_consent,
  createdAt: row.created_at,
});

const toTemplate = (row: Row<"templates">): Template => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  channel: row.channel,
  language: row.language,
  subject: row.subject,
  body: row.body,
  attachments: row.attachments ?? [],
});

const toStep = (row: Row<"sequence_steps">): SequenceStep => ({
  id: row.id,
  order: row.step_order,
  channel: row.channel,
  kind: row.kind,
  templateId: row.template_id,
  delayDays: row.delay_days,
});

const toCampaign = (row: Row<"campaigns">, steps: Row<"sequence_steps">[]): Campaign => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  channel: row.channel,
  status: row.status,
  countryCodes: row.country_codes ?? [],
  targetStatuses: (row.target_statuses ?? []) as ContactStatus[],
  steps: steps.filter((step) => step.campaign_id === row.id).map(toStep).sort((a, b) => a.order - b.order),
  approvedBy: row.approved_by ?? undefined,
  approvedAt: row.approved_at ?? undefined,
  scheduledFrom: row.scheduled_from ?? undefined,
  createdAt: row.created_at,
});

const toEvent = (row: Row<"outreach_events">): OutreachEvent => ({
  id: row.id,
  contactId: row.contact_id,
  campaignId: row.campaign_id ?? undefined,
  stepId: row.step_id ?? undefined,
  channel: row.channel,
  type: row.type,
  at: row.occurred_at,
  detail: row.detail ?? undefined,
});

const toHandoff = (row: Row<"handoffs">): Handoff => ({
  id: row.id,
  contactId: row.contact_id,
  campaignId: row.campaign_id ?? undefined,
  reason: row.reason,
  at: row.created_at,
  resolved: row.resolved,
});

const toSuppression = (row: Row<"suppressions">): Suppression => ({
  id: row.id,
  value: row.value,
  scope: row.scope,
  reason: row.reason,
  at: row.created_at,
});

/** Throws on error so a failure surfaces rather than looking like empty data. */
function unwrap<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return (result.data ?? []) as T;
}

/* --------------------------------------------------------- repository -- */

export const supabaseRepo: Repository = {
  async listCompanies() {
    const result = await supabase.from("companies").select("*").order("name");
    return unwrap(result, "listCompanies").map(toCompany);
  },

  async getCompany(id) {
    const { data } = await supabase.from("companies").select("*").eq("id", id).maybeSingle();
    return data ? toCompany(data) : undefined;
  },

  async listContacts(filter: ContactFilter = {}) {
    /* Filters that can run in Postgres do; only the cross-table search and
       country filter need the company join resolved client-side. */
    let query = supabase.from("contacts").select("*, companies!inner(country_code, name, domain)");

    if (filter.statuses?.length) query = query.in("status", filter.statuses);
    if (filter.verifiedOnly) query = query.eq("verified", true);
    if (filter.highPriorityOnly) query = query.eq("role_priority", "high");
    if (filter.countryCodes?.length) {
      query = query.in("companies.country_code", filter.countryCodes);
    }
    if (filter.search) {
      const term = `%${filter.search}%`;
      query = query.or(`name.ilike.${term},email.ilike.${term},designation.ilike.${term}`);
    }

    const result = await query.order("created_at", { ascending: false });
    return unwrap(result, "listContacts").map((row) => toContact(row as Row<"contacts">));
  },

  async getContact(id) {
    const { data } = await supabase.from("contacts").select("*").eq("id", id).maybeSingle();
    return data ? toContact(data) : undefined;
  },

  async updateContact(id, patch) {
    const row: Tables["contacts"]["Update"] = {};
    if (patch.verified !== undefined) row.verified = patch.verified;
    if (patch.doNotContact !== undefined) row.do_not_contact = patch.doNotContact;
    if (patch.callConsent !== undefined) row.call_consent = patch.callConsent;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.lastReplyAt !== undefined) row.last_reply_at = patch.lastReplyAt;
    if (patch.lastTouchAt !== undefined) row.last_touch_at = patch.lastTouchAt;
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.designation !== undefined) row.designation = patch.designation;
    if (patch.phone !== undefined) row.phone = patch.phone;
    if (patch.sequencePosition !== undefined) row.sequence_position = patch.sequencePosition;
    if (Object.keys(row).length === 0) return this.getContact(id);

    const { data } = await supabase.from("contacts").update(row).eq("id", id).select().maybeSingle();
    return data ? toContact(data) : undefined;
  },

  async addContacts(contacts) {
    if (contacts.length === 0) return;
    const rows = contacts.map((contact) => ({
      company_id: contact.companyId,
      name: contact.name ?? null,
      email: contact.email,
      phone: contact.phone ?? null,
      designation: contact.designation ?? null,
      role_category: contact.roleCategory ?? null,
      role_priority: contact.rolePriority,
      preferred_language: contact.preferredLanguage,
      status: contact.status,
      last_touch_at: contact.lastTouchAt ?? null,
      verified: contact.verified,
      sources: contact.sources,
      do_not_contact: contact.doNotContact,
      call_consent: contact.callConsent,
    }));
    /* ignoreDuplicates: an existing contact may already have been reviewed by
       a person, and an import must never overwrite that. */
    const { error } = await supabase
      .from("contacts")
      .upsert(rows, { onConflict: "email", ignoreDuplicates: true });
    if (error) throw new Error(`addContacts: ${error.message}`);
  },

  async addCompanies(companies) {
    if (companies.length === 0) return;
    const rows = companies.map((company) => ({
      name: company.name,
      domain: company.domain ?? null,
      website: company.website ?? null,
      country_code: company.countryCode || "ZZ",
      country: company.country || "Unknown",
      city: company.city ?? null,
      industry: company.industry ?? null,
      employee_count: company.employeeCount ?? null,
      verified: company.verified,
      sources: company.sources,
    }));
    const { error } = await supabase
      .from("companies")
      .upsert(rows, { onConflict: "domain", ignoreDuplicates: true });
    if (error) throw new Error(`addCompanies: ${error.message}`);
  },

  async listMergeCandidates() {
    const result = await supabase
      .from("merge_candidates")
      .select("*")
      .is("resolved_at", null)
      .order("score", { ascending: false });

    return unwrap(result, "listMergeCandidates").map(
      (row): MergeCandidate => ({
        id: row.id,
        reason: row.reason,
        score: Number(row.score),
        contactIds: [row.contact_a, row.contact_b],
      }),
    );
  },

  async resolveMerge(id, keepId) {
    const { data: candidate } = await supabase
      .from("merge_candidates")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!candidate) return;

    const dropId = candidate.contact_a === keepId ? candidate.contact_b : candidate.contact_a;
    /* Mark resolved before deleting: the row references both contacts, and
       losing the audit of what was merged is worse than a stale flag. */
    await supabase.from("merge_candidates").update({ resolved_at: new Date().toISOString() }).eq("id", id);
    await supabase.from("contacts").delete().eq("id", dropId);
  },

  async listCampaigns() {
    const [campaigns, steps] = await Promise.all([
      supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("sequence_steps").select("*"),
    ]);
    const stepRows = unwrap(steps, "listCampaigns.steps");
    return unwrap(campaigns, "listCampaigns").map((row) => toCampaign(row, stepRows));
  },

  async getCampaign(id) {
    const [campaign, steps] = await Promise.all([
      supabase.from("campaigns").select("*").eq("id", id).maybeSingle(),
      supabase.from("sequence_steps").select("*").eq("campaign_id", id),
    ]);
    if (!campaign.data) return undefined;
    return toCampaign(campaign.data, steps.data ?? []);
  },

  async saveCampaign(campaign) {
    const row = {
      id: campaign.id,
      name: campaign.name,
      kind: campaign.kind,
      channel: campaign.channel,
      status: campaign.status,
      country_codes: campaign.countryCodes,
      target_statuses: campaign.targetStatuses,
      approved_by: campaign.approvedBy ?? null,
      approved_at: campaign.approvedAt ?? null,
      scheduled_from: campaign.scheduledFrom ?? null,
    };

    const { data, error } = await supabase.from("campaigns").upsert(row).select().maybeSingle();
    if (error) throw new Error(`saveCampaign: ${error.message}`);
    if (!data) return;

    /* Steps are replaced wholesale. Diffing them would be more surgical, but
       the editor already treats the sequence as one value. */
    await supabase.from("sequence_steps").delete().eq("campaign_id", data.id);
    if (campaign.steps.length > 0) {
      const steps = campaign.steps.map((step) => ({
        campaign_id: data.id,
        step_order: step.order,
        channel: step.channel,
        kind: step.kind,
        template_id: step.templateId,
        delay_days: step.delayDays,
      }));
      const { error: stepError } = await supabase.from("sequence_steps").insert(steps);
      if (stepError) throw new Error(`saveCampaign.steps: ${stepError.message}`);
    }
  },

  async listTemplates() {
    const result = await supabase.from("templates").select("*").order("name");
    return unwrap(result, "listTemplates").map(toTemplate);
  },

  async getTemplate(id) {
    const { data } = await supabase.from("templates").select("*").eq("id", id).maybeSingle();
    return data ? toTemplate(data) : undefined;
  },

  async listEvents() {
    const result = await supabase
      .from("outreach_events")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(500);
    return unwrap(result, "listEvents").map(toEvent);
  },

  async addEvent(event) {
    /* The id is generated by Postgres; the caller's placeholder is ignored.
       Inserting a 'replied' event fires the database trigger that cancels the
       queue, suppresses the address and raises the handoff. */
    const { error } = await supabase.from("outreach_events").insert({
      contact_id: event.contactId,
      campaign_id: event.campaignId ?? null,
      step_id: event.stepId ?? null,
      channel: event.channel,
      type: event.type,
      detail: event.detail ?? null,
      occurred_at: event.at,
    });
    if (error) throw new Error(`addEvent: ${error.message}`);
  },

  async listHandoffs() {
    const result = await supabase
      .from("handoffs")
      .select("*")
      .order("created_at", { ascending: false });
    return unwrap(result, "listHandoffs").map(toHandoff);
  },

  async addHandoff(handoff) {
    /* The reply trigger usually creates these; this covers a manual handoff.
       The partial unique index keeps it to one open per contact. */
    const { error } = await supabase.from("handoffs").insert({
      contact_id: handoff.contactId,
      campaign_id: handoff.campaignId ?? null,
      reason: handoff.reason,
    });
    if (error && !error.message.includes("duplicate")) {
      throw new Error(`addHandoff: ${error.message}`);
    }
  },

  async resolveHandoff(id) {
    const { error } = await supabase
      .from("handoffs")
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(`resolveHandoff: ${error.message}`);
  },

  async listSuppressions() {
    const result = await supabase.from("suppressions").select("*");
    return unwrap(result, "listSuppressions").map(toSuppression);
  },

  async addSuppression(suppression) {
    const { error } = await supabase
      .from("suppressions")
      .upsert(
        { value: suppression.value, scope: suppression.scope, reason: suppression.reason },
        { onConflict: "value,scope", ignoreDuplicates: true },
      );
    if (error) throw new Error(`addSuppression: ${error.message}`);
  },

  async countrySegments() {
    const [companies, contacts] = await Promise.all([
      supabase.from("companies").select("id, country_code, country"),
      supabase.from("contacts").select("company_id, verified, status, do_not_contact"),
    ]);

    const companyRows = unwrap(companies, "countrySegments.companies");
    const contactRows = unwrap(contacts, "countrySegments.contacts");

    const byCode = new Map<string, CountrySegment>();
    for (const company of companyRows) {
      const segment = byCode.get(company.country_code) ?? {
        code: company.country_code,
        name: company.country,
        companies: 0,
        contacts: 0,
        verified: 0,
        contactable: 0,
        replied: 0,
      };
      segment.companies += 1;
      byCode.set(company.country_code, segment);
    }

    const codeByCompany = new Map(companyRows.map((company) => [company.id, company.country_code]));

    for (const contact of contactRows) {
      const code = codeByCompany.get(contact.company_id);
      const segment = code ? byCode.get(code) : undefined;
      if (!segment) continue;
      segment.contacts += 1;
      if (contact.verified) segment.verified += 1;
      if (HUMAN_OWNED.includes(contact.status)) segment.replied += 1;
      else if (!contact.do_not_contact && contact.verified) segment.contactable += 1;
    }

    return [...byCode.values()].sort((a, b) => b.contacts - a.contacts);
  },
};
