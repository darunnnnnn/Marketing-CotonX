/**
 * The single seam between the UI and the data store.
 *
 * Today it is backed by the in-memory seed set; in Phase 1 a Supabase-backed
 * implementation replaces `memoryRepo` and no component changes. Everything is
 * async for that reason, even though nothing here actually awaits.
 */

import * as seed from "./seed.ts";
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
  Suppression,
  Template,
} from "./types.ts";

export type ContactFilter = {
  search?: string;
  countryCodes?: string[];
  statuses?: ContactStatus[];
  verifiedOnly?: boolean;
  highPriorityOnly?: boolean;
};

export type CountrySegment = {
  code: string;
  name: string;
  companies: number;
  contacts: number;
  verified: number;
  contactable: number;
  replied: number;
};

export interface Repository {
  listCompanies(): Promise<Company[]>;
  getCompany(id: Id): Promise<Company | undefined>;
  listContacts(filter?: ContactFilter): Promise<Contact[]>;
  getContact(id: Id): Promise<Contact | undefined>;
  updateContact(id: Id, patch: Partial<Contact>): Promise<Contact | undefined>;
  addContacts(contacts: Contact[]): Promise<void>;
  addCompanies(companies: Company[]): Promise<void>;
  listMergeCandidates(): Promise<MergeCandidate[]>;
  resolveMerge(id: Id, keepId: Id): Promise<void>;
  listCampaigns(): Promise<Campaign[]>;
  getCampaign(id: Id): Promise<Campaign | undefined>;
  saveCampaign(campaign: Campaign): Promise<void>;
  listTemplates(): Promise<Template[]>;
  getTemplate(id: Id): Promise<Template | undefined>;
  listEvents(): Promise<OutreachEvent[]>;
  addEvent(event: OutreachEvent): Promise<void>;
  listHandoffs(): Promise<Handoff[]>;
  addHandoff(handoff: Handoff): Promise<void>;
  resolveHandoff(id: Id): Promise<void>;
  listSuppressions(): Promise<Suppression[]>;
  addSuppression(suppression: Suppression): Promise<void>;
  countrySegments(): Promise<CountrySegment[]>;
}

/* Mutable copies so the UI can actually change things during a session. */
const db = {
  companies: [...seed.companies],
  contacts: [...seed.contacts],
  mergeCandidates: [...seed.mergeCandidates],
  campaigns: [...seed.campaigns],
  templates: [...seed.templates],
  events: [...seed.events],
  handoffs: [...seed.handoffs],
  suppressions: [...seed.suppressions],
};

const ok = <T>(value: T): Promise<T> => Promise.resolve(value);

function matches(contact: Contact, company: Company | undefined, filter: ContactFilter): boolean {
  if (filter.countryCodes?.length && !filter.countryCodes.includes(company?.countryCode ?? "")) return false;
  if (filter.statuses?.length && !filter.statuses.includes(contact.status)) return false;
  if (filter.verifiedOnly && !contact.verified) return false;
  if (filter.highPriorityOnly && contact.rolePriority !== "high") return false;
  if (filter.search) {
    const needle = filter.search.toLowerCase();
    const haystack = [contact.name, contact.email, contact.designation, company?.name, company?.domain]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

export const memoryRepo: Repository = {
  listCompanies: () => ok([...db.companies]),

  getCompany: (id) => ok(db.companies.find((company) => company.id === id)),

  listContacts: (filter = {}) => {
    const byId = new Map(db.companies.map((company) => [company.id, company]));
    return ok(db.contacts.filter((contact) => matches(contact, byId.get(contact.companyId), filter)));
  },

  getContact: (id) => ok(db.contacts.find((contact) => contact.id === id)),

  updateContact: (id, patch) => {
    const index = db.contacts.findIndex((contact) => contact.id === id);
    if (index === -1) return ok(undefined);
    db.contacts[index] = { ...db.contacts[index], ...patch };
    return ok(db.contacts[index]);
  },

  addContacts: (contacts) => {
    /* Deduplicate on email — the cheap half of identity resolution. */
    const seen = new Set(db.contacts.map((contact) => contact.email.toLowerCase()));
    for (const contact of contacts) {
      if (!seen.has(contact.email.toLowerCase())) {
        db.contacts.push(contact);
        seen.add(contact.email.toLowerCase());
      }
    }
    return ok(undefined);
  },

  addCompanies: (companies) => {
    const seen = new Set(db.companies.map((company) => company.domain ?? company.name));
    for (const company of companies) {
      if (!seen.has(company.domain ?? company.name)) {
        db.companies.push(company);
        seen.add(company.domain ?? company.name);
      }
    }
    return ok(undefined);
  },

  listMergeCandidates: () => ok([...db.mergeCandidates]),

  resolveMerge: (id, keepId) => {
    const candidate = db.mergeCandidates.find((item) => item.id === id);
    if (candidate) {
      const dropId = candidate.contactIds.find((contactId) => contactId !== keepId);
      db.contacts = db.contacts.filter((contact) => contact.id !== dropId);
      db.mergeCandidates = db.mergeCandidates.filter((item) => item.id !== id);
    }
    return ok(undefined);
  },

  listCampaigns: () => ok([...db.campaigns]),

  getCampaign: (id) => ok(db.campaigns.find((campaign) => campaign.id === id)),

  saveCampaign: (campaign) => {
    const index = db.campaigns.findIndex((item) => item.id === campaign.id);
    if (index === -1) db.campaigns.push(campaign);
    else db.campaigns[index] = campaign;
    return ok(undefined);
  },

  listTemplates: () => ok([...db.templates]),

  getTemplate: (id) => ok(db.templates.find((template) => template.id === id)),

  listEvents: () => ok([...db.events].sort((a, b) => b.at.localeCompare(a.at))),

  addEvent: (event) => {
    db.events.push(event);
    return ok(undefined);
  },

  listHandoffs: () => ok([...db.handoffs].sort((a, b) => b.at.localeCompare(a.at))),

  addHandoff: (handoff) => {
    /* One open handoff per contact — a second reply should not queue a
       duplicate task for the sales team. */
    const existing = db.handoffs.find((item) => item.contactId === handoff.contactId && !item.resolved);
    if (existing) existing.reason = handoff.reason;
    else db.handoffs.push(handoff);
    return ok(undefined);
  },

  resolveHandoff: (id) => {
    const handoff = db.handoffs.find((item) => item.id === id);
    if (handoff) handoff.resolved = true;
    return ok(undefined);
  },

  listSuppressions: () => ok([...db.suppressions]),

  addSuppression: (suppression) => {
    db.suppressions.push(suppression);
    return ok(undefined);
  },

  countrySegments: () => {
    const byCode = new Map<string, CountrySegment>();
    const companyById = new Map(db.companies.map((company) => [company.id, company]));

    for (const company of db.companies) {
      const segment = byCode.get(company.countryCode) ?? {
        code: company.countryCode,
        name: company.country,
        companies: 0,
        contacts: 0,
        verified: 0,
        contactable: 0,
        replied: 0,
      };
      segment.companies += 1;
      byCode.set(company.countryCode, segment);
    }

    for (const contact of db.contacts) {
      const company = companyById.get(contact.companyId);
      if (!company) continue;
      const segment = byCode.get(company.countryCode);
      if (!segment) continue;
      segment.contacts += 1;
      if (contact.verified) segment.verified += 1;
      if (HUMAN_OWNED.includes(contact.status)) segment.replied += 1;
      else if (!contact.doNotContact && contact.verified) segment.contactable += 1;
    }

    return ok([...byCode.values()].sort((a, b) => b.contacts - a.contacts));
  },
};

export const repo: Repository = memoryRepo;
