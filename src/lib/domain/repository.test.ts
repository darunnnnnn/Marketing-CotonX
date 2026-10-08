import { describe, expect, it } from "vitest";
import { memoryRepo as repo } from "./repository";
import { HUMAN_OWNED } from "./types";
import type { Company, Contact } from "./types";

const now = "2026-01-01T00:00:00.000Z";

const company = (id: string, over: Partial<Company> = {}): Company => ({
  id,
  name: `Company ${id}`,
  domain: `${id}.de`,
  countryCode: "DE",
  country: "Germany",
  verified: true,
  sources: ["manual"],
  createdAt: now,
  ...over,
});

const contact = (id: string, over: Partial<Contact> = {}): Contact => ({
  id,
  companyId: "c1",
  email: `${id}@heimtextil-weber.de`,
  rolePriority: "medium",
  preferredLanguage: "de",
  status: "never_contacted",
  sequencePosition: {},
  verified: false,
  sources: ["manual"],
  doNotContact: false,
  callConsent: false,
  createdAt: now,
  ...over,
});

describe("memoryRepo", () => {
  it("ships with seed data on every entity", async () => {
    expect((await repo.listCompanies()).length).toBeGreaterThan(0);
    expect((await repo.listContacts()).length).toBeGreaterThan(0);
    expect((await repo.listCampaigns()).length).toBeGreaterThan(0);
    expect((await repo.listTemplates()).length).toBeGreaterThan(0);
    expect((await repo.listEvents()).length).toBeGreaterThan(0);
  });

  it("returns events newest first", async () => {
    const events = await repo.listEvents();
    const times = events.map((event) => event.at);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it("does not leak its internal arrays to callers", async () => {
    const first = await repo.listCompanies();
    first.push(company("injected"));
    const second = await repo.listCompanies();
    expect(second.find((item) => item.id === "injected")).toBeUndefined();
  });

  it("refuses to add a contact whose email already exists", async () => {
    const before = (await repo.listContacts()).length;
    await repo.addContacts([contact("dupe", { email: "k.weber@heimtextil-weber.de" })]);
    expect((await repo.listContacts()).length).toBe(before);
  });

  it("deduplicates on email case-insensitively", async () => {
    const before = (await repo.listContacts()).length;
    await repo.addContacts([contact("dupe2", { email: "K.Weber@HeimTextil-Weber.DE" })]);
    expect((await repo.listContacts()).length).toBe(before);
  });

  it("deduplicates companies by domain", async () => {
    const before = (await repo.listCompanies()).length;
    await repo.addCompanies([company("new", { domain: "heimtextil-weber.de" })]);
    expect((await repo.listCompanies()).length).toBe(before);
  });

  it("filters contacts by country through the company", async () => {
    const german = await repo.listContacts({ countryCodes: ["DE"] });
    const companies = await repo.listCompanies();
    const byId = new Map(companies.map((item) => [item.id, item]));
    expect(german.length).toBeGreaterThan(0);
    for (const person of german) {
      expect(byId.get(person.companyId)?.countryCode).toBe("DE");
    }
  });

  it("searches across name, email, designation and company", async () => {
    expect((await repo.listContacts({ search: "weber" })).length).toBeGreaterThan(0);
    expect((await repo.listContacts({ search: "Purchasing" })).length).toBeGreaterThan(0);
    expect(await repo.listContacts({ search: "zzzz-no-match" })).toHaveLength(0);
  });

  it("combines filters rather than widening them", async () => {
    const all = await repo.listContacts({ countryCodes: ["DE"] });
    const narrowed = await repo.listContacts({ countryCodes: ["DE"], highPriorityOnly: true });
    expect(narrowed.length).toBeLessThanOrEqual(all.length);
    expect(narrowed.every((person) => person.rolePriority === "high")).toBe(true);
  });

  it("applies a contact patch without disturbing other fields", async () => {
    const [first] = await repo.listContacts();
    const updated = await repo.updateContact(first.id, { verified: !first.verified });
    expect(updated?.verified).toBe(!first.verified);
    expect(updated?.email).toBe(first.email);
    await repo.updateContact(first.id, { verified: first.verified });
  });

  it("returns undefined when patching a contact that does not exist", async () => {
    expect(await repo.updateContact("nope", { verified: true })).toBeUndefined();
  });

  it("keeps one open handoff per contact instead of stacking duplicates", async () => {
    const openBefore = (await repo.listHandoffs()).filter((item) => !item.resolved).length;

    await repo.addHandoff({ id: "h-a", contactId: "p15", reason: "First reply", at: now, resolved: false });
    await repo.addHandoff({ id: "h-b", contactId: "p15", reason: "Second reply", at: now, resolved: false });

    const open = (await repo.listHandoffs()).filter((item) => !item.resolved);
    expect(open.length).toBe(openBefore + 1);
    expect(open.find((item) => item.contactId === "p15")?.reason).toBe("Second reply");
  });

  it("resolves a handoff", async () => {
    await repo.resolveHandoff("h-a");
    const handoff = (await repo.listHandoffs()).find((item) => item.id === "h-a");
    expect(handoff?.resolved).toBe(true);
  });

  describe("countrySegments", () => {
    it("counts every company exactly once", async () => {
      const segments = await repo.countrySegments();
      const companies = await repo.listCompanies();
      const total = segments.reduce((sum, segment) => sum + segment.companies, 0);
      expect(total).toBe(companies.length);
    });

    it("never counts a replied buyer as contactable", async () => {
      const segments = await repo.countrySegments();
      const contacts = await repo.listContacts();
      const companies = await repo.listCompanies();
      const byId = new Map(companies.map((item) => [item.id, item]));

      const repliedByCode = new Map<string, number>();
      for (const person of contacts) {
        if (!HUMAN_OWNED.includes(person.status)) continue;
        const code = byId.get(person.companyId)?.countryCode;
        if (code) repliedByCode.set(code, (repliedByCode.get(code) ?? 0) + 1);
      }

      for (const segment of segments) {
        expect(segment.replied, segment.code).toBe(repliedByCode.get(segment.code) ?? 0);
        expect(segment.contactable + segment.replied, segment.code).toBeLessThanOrEqual(segment.contacts);
      }
    });

    it("sorts the busiest market first", async () => {
      const segments = await repo.countrySegments();
      const counts = segments.map((segment) => segment.contacts);
      expect([...counts].sort((a, b) => b - a)).toEqual(counts);
    });
  });

  it("merges a duplicate pair by removing the record not kept", async () => {
    const [candidate] = await repo.listMergeCandidates();
    expect(candidate).toBeDefined();

    const [keep, drop] = candidate.contactIds;
    await repo.resolveMerge(candidate.id, keep);

    expect(await repo.getContact(keep)).toBeDefined();
    expect(await repo.getContact(drop)).toBeUndefined();
    expect(await repo.listMergeCandidates()).toHaveLength(0);
  });
});
