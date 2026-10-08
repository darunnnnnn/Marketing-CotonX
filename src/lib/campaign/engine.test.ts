import { describe, expect, it } from "vitest";
import { applyReply, buildPlan, evaluate, planToQueue, render } from "./engine";
import type { Campaign, Company, Contact, Suppression, Template } from "../domain/types";

const company = (over: Partial<Company> = {}): Company => ({
  id: "co",
  name: "Test Textiles",
  domain: "test.de",
  countryCode: "DE",
  country: "Germany",
  verified: true,
  sources: ["apollo"],
  createdAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

const contact = (over: Partial<Contact> = {}): Contact => ({
  id: "ct",
  companyId: "co",
  name: "Anna Brandt",
  email: "a.brandt@test.de",
  rolePriority: "high",
  preferredLanguage: "de",
  status: "never_contacted",
  sequencePosition: {},
  verified: true,
  sources: ["apollo"],
  doNotContact: false,
  callConsent: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

const campaign = (over: Partial<Campaign> = {}): Campaign => ({
  id: "cp",
  name: "Germany intro",
  kind: "introduction",
  channel: "email",
  status: "approved",
  countryCodes: ["DE"],
  targetStatuses: ["never_contacted"],
  steps: [
    { id: "st1", order: 1, channel: "email", kind: "introduction", templateId: "t1", delayDays: 0 },
    { id: "st2", order: 2, channel: "email", kind: "follow_up", templateId: "t2", delayDays: 7 },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

const template = (over: Partial<Template> = {}): Template => ({
  id: "t1",
  name: "Intro",
  kind: "introduction",
  channel: "email",
  language: "en",
  subject: "Hello {{company_name}}",
  body: "Dear {{contact_name}}, we are Cotonex.",
  attachments: [],
  ...over,
});

const noSuppressions = new Set<string>();

describe("evaluate", () => {
  it("admits a new contact matching the entry status", () => {
    const result = evaluate(contact(), company(), campaign(), noSuppressions);
    expect(result.eligible).toBe(true);
    if (result.eligible) expect(result.step.order).toBe(1);
  });

  it("excludes a contact in a country the campaign does not target", () => {
    const result = evaluate(contact(), company({ countryCode: "FR" }), campaign(), noSuppressions);
    expect(result).toMatchObject({ eligible: false, reason: "wrong_country" });
  });

  it("excludes a contact whose status is outside the entry statuses", () => {
    const result = evaluate(contact({ status: "no_reply" }), company(), campaign(), noSuppressions);
    expect(result).toMatchObject({ eligible: false, reason: "wrong_status" });
  });

  it("excludes unverified contacts", () => {
    const result = evaluate(contact({ verified: false }), company(), campaign(), noSuppressions);
    expect(result).toMatchObject({ eligible: false, reason: "unverified" });
  });

  it("excludes do-not-contact regardless of anything else", () => {
    const result = evaluate(contact({ doNotContact: true }), company(), campaign(), noSuppressions);
    expect(result).toMatchObject({ eligible: false, reason: "do_not_contact" });
  });

  it("excludes suppressed addresses case-insensitively", () => {
    const result = evaluate(
      contact({ email: "A.Brandt@Test.de" }),
      company(),
      campaign(),
      new Set(["a.brandt@test.de"]),
    );
    expect(result).toMatchObject({ eligible: false, reason: "suppressed" });
  });

  /* Requirement 20: the reply-stop rule must outrank every other condition. */
  it.each(["buyer_replied", "enquiry_received", "active_lead"] as const)(
    "never contacts a buyer in status %s",
    (status) => {
      const result = evaluate(contact({ status }), company(), campaign(), noSuppressions);
      expect(result).toMatchObject({ eligible: false, reason: "human_owned" });
    },
  );

  /* Requirement 16: resume, never restart. */
  it("resumes at the next step rather than the introduction", () => {
    const result = evaluate(
      contact({ status: "introduction_sent", sequencePosition: { cp: 1 }, lastTouchAt: "2020-01-01T00:00:00.000Z" }),
      company(),
      campaign(),
      noSuppressions,
    );
    expect(result.eligible).toBe(true);
    if (result.eligible) expect(result.step.order).toBe(2);
  });

  it("holds a mid-sequence contact until the step delay has elapsed", () => {
    const now = new Date("2026-03-10T09:00:00.000Z");
    const result = evaluate(
      contact({
        status: "introduction_sent",
        sequencePosition: { cp: 1 },
        lastTouchAt: "2026-03-08T09:00:00.000Z",
      }),
      company(),
      campaign(),
      noSuppressions,
      now,
    );
    expect(result).toMatchObject({ eligible: false, reason: "waiting_for_delay" });
  });

  it("releases the step once the delay has passed", () => {
    const now = new Date("2026-03-20T09:00:00.000Z");
    const result = evaluate(
      contact({
        status: "introduction_sent",
        sequencePosition: { cp: 1 },
        lastTouchAt: "2026-03-08T09:00:00.000Z",
      }),
      company(),
      campaign(),
      noSuppressions,
      now,
    );
    expect(result.eligible).toBe(true);
  });

  it("stops when every step has been delivered", () => {
    const result = evaluate(
      contact({ status: "no_reply", sequencePosition: { cp: 2 }, lastTouchAt: "2020-01-01T00:00:00.000Z" }),
      company(),
      campaign(),
      noSuppressions,
    );
    expect(result).toMatchObject({ eligible: false, reason: "sequence_complete" });
  });

  it("keeps each campaign's position independent", () => {
    const person = contact({ sequencePosition: { other: 2 } });
    const result = evaluate(person, company(), campaign(), noSuppressions);
    expect(result.eligible).toBe(true);
    if (result.eligible) expect(result.step.order).toBe(1);
  });

  it("holds a mid-sequence contact that has no recorded last touch", () => {
    const result = evaluate(
      contact({ status: "introduction_sent", sequencePosition: { cp: 1 }, lastTouchAt: undefined }),
      company(),
      campaign(),
      noSuppressions,
    );
    expect(result).toMatchObject({ eligible: false, reason: "waiting_for_delay" });
  });

  it("orders steps by `order`, not by array position", () => {
    const scrambled = campaign({
      steps: [
        { id: "b", order: 2, channel: "email", kind: "follow_up", templateId: "t2", delayDays: 7 },
        { id: "a", order: 1, channel: "email", kind: "introduction", templateId: "t1", delayDays: 0 },
      ],
    });
    const result = evaluate(contact(), company(), scrambled, noSuppressions);
    expect(result.eligible).toBe(true);
    if (result.eligible) expect(result.step.id).toBe("a");
  });
});

describe("buildPlan", () => {
  const templates = [template(), template({ id: "t2", name: "Follow-up" })];

  it("schedules inside the recipient's own working hours", () => {
    /* 02:00 UTC on a Tuesday is the middle of the night in Germany. */
    const now = new Date("2026-03-10T02:00:00.000Z");
    const plan = buildPlan(campaign(), [contact()], [company()], templates, [], now);

    expect(plan.rows).toHaveLength(1);
    const hourInBerlin = Number(
      new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/Berlin" }).format(
        plan.rows[0].sendAt,
      ),
    );
    expect(hourInBerlin).toBeGreaterThanOrEqual(8);
    expect(hourInBerlin).toBeLessThan(11);
  });

  it("never schedules onto a weekend", () => {
    /* Saturday. */
    const now = new Date("2026-03-14T09:00:00.000Z");
    const plan = buildPlan(campaign(), [contact()], [company()], templates, [], now);
    const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Europe/Berlin" }).format(
      plan.rows[0].sendAt,
    );
    expect(["Sat", "Sun"]).not.toContain(weekday);
  });

  it("suppresses a whole domain when one is listed", () => {
    const suppressions: Suppression[] = [
      { id: "s", value: "test.de", scope: "domain", reason: "complaint", at: "2026-01-01T00:00:00.000Z" },
    ];
    const plan = buildPlan(campaign(), [contact()], [company()], templates, suppressions);
    expect(plan.rows).toHaveLength(0);
    expect(plan.tally.suppressed).toBe(1);
  });

  it("counts each exclusion reason", () => {
    const plan = buildPlan(
      campaign(),
      [
        contact({ id: "a", email: "a@test.de", verified: false }),
        contact({ id: "b", email: "b@test.de", doNotContact: true }),
        contact({ id: "c", email: "c@test.de", status: "buyer_replied" }),
        contact({ id: "d", email: "d@test.de" }),
      ],
      [company()],
      templates,
      [],
    );
    expect(plan.rows).toHaveLength(1);
    expect(plan.tally).toMatchObject({ unverified: 1, do_not_contact: 1, human_owned: 1 });
  });

  it("excludes a contact whose company is missing rather than throwing", () => {
    const plan = buildPlan(campaign(), [contact({ companyId: "gone" })], [company()], templates, []);
    expect(plan.rows).toHaveLength(0);
    expect(plan.tally.wrong_country).toBe(1);
  });

  it("returns rows ordered by send time", () => {
    const plan = buildPlan(
      campaign({ countryCodes: ["DE", "US"] }),
      [contact({ id: "de", email: "de@test.de" }), contact({ id: "us", email: "us@test.us", companyId: "us" })],
      [company(), company({ id: "us", countryCode: "US", country: "United States", domain: "test.us" })],
      templates,
      [],
      new Date("2026-03-10T02:00:00.000Z"),
    );
    const times = plan.rows.map((row) => row.sendAt.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});

describe("applyReply", () => {
  it("moves the buyer to human ownership and suppresses them", () => {
    const at = new Date("2026-03-10T10:00:00.000Z");
    const outcome = applyReply(contact({ status: "introduction_sent" }), at);

    expect(outcome.contact.status).toBe("buyer_replied");
    expect(outcome.contact.lastReplyAt).toBe(at.toISOString());
    expect(outcome.events.map((event) => event.type)).toEqual(["replied", "stopped"]);
    expect(outcome.suppression).toMatchObject({ reason: "human_owned", scope: "email" });
  });

  it("removes the contact from every subsequent plan", () => {
    const person = contact({ status: "introduction_sent", sequencePosition: { cp: 1 }, lastTouchAt: "2020-01-01T00:00:00.000Z" });
    const before = buildPlan(campaign(), [person], [company()], [template()], []);
    expect(before.rows).toHaveLength(1);

    const outcome = applyReply(person);
    const after = buildPlan(
      campaign(),
      [outcome.contact],
      [company()],
      [template()],
      [{ ...outcome.suppression, id: "s" }],
    );
    expect(after.rows).toHaveLength(0);
    expect(after.tally.human_owned).toBe(1);
  });
});

describe("render", () => {
  it("substitutes merge fields", () => {
    const output = render(template(), contact(), company());
    expect(output.subject).toBe("Hello Test Textiles");
    expect(output.body).toBe("Dear Anna Brandt, we are Cotonex.");
  });

  it("falls back politely when the name is unknown", () => {
    const output = render(template(), contact({ name: undefined }), company());
    expect(output.body).toContain("Dear Sir or Madam");
  });

  it("leaves unknown placeholders untouched rather than emptying them", () => {
    const output = render(template({ body: "Hi {{nope}}" }), contact(), company());
    expect(output.body).toBe("Hi {{nope}}");
  });

  it("does not re-expand a value that itself looks like a placeholder", () => {
    const output = render(template({ body: "Hi {{contact_name}}" }), contact({ name: "{{company_name}}" }), company());
    expect(output.body).toBe("Hi {{company_name}}");
  });
});

describe("planToQueue", () => {
  it("produces one queued item per planned row, carrying the UTC send time", () => {
    const plan = buildPlan(
      campaign(),
      [contact()],
      [company()],
      [template()],
      [],
      new Date("2026-03-10T02:00:00.000Z"),
    );
    const queue = planToQueue(plan);

    expect(queue).toHaveLength(plan.rows.length);
    expect(queue[0]).toMatchObject({
      contactId: "ct",
      campaignId: "cp",
      stepId: "st1",
      channel: "email",
      status: "queued",
    });
    expect(new Date(queue[0].sendAtUtc).getTime()).toBe(plan.rows[0].sendAt.getTime());
  });

  it("gives every item a distinct id", () => {
    const plan = buildPlan(
      campaign({ countryCodes: ["DE"] }),
      [contact({ id: "a", email: "a@test.de" }), contact({ id: "b", email: "b@test.de" })],
      [company()],
      [template()],
      [],
    );
    const ids = planToQueue(plan).map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns nothing for an empty plan", () => {
    const plan = buildPlan(campaign(), [], [company()], [template()], []);
    expect(planToQueue(plan)).toHaveLength(0);
  });
});
