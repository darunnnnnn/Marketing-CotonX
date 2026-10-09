import { describe, expect, it } from "vitest";
import { lookupByEmail } from "./index.ts";

describe("lookupByEmail", () => {
  it("rejects malformed addresses", () => {
    for (const bad of ["", "   ", "not-an-email", "a@b", "a@@b.com", "@test.de", "a b@test.de"]) {
      expect(lookupByEmail(bad).valid, bad).toBe(false);
    }
  });

  it("normalises case and surrounding whitespace", () => {
    const result = lookupByEmail("  A.Brandt@Test.DE  ");
    expect(result.email).toBe("a.brandt@test.de");
    expect(result.record.domain?.value).toBe("test.de");
  });

  it("reads the country from a country-code domain", () => {
    expect(lookupByEmail("x@weber.de").record.country?.value).toBe("Germany");
    expect(lookupByEmail("x@shop.nl").record.countryCode?.value).toBe("NL");
  });

  it("reads the country from a second-level domain", () => {
    const result = lookupByEmail("buyer@londonlinen.co.uk");
    expect(result.record.countryCode?.value).toBe("GB");
  });

  it("warns instead of guessing on a generic domain", () => {
    const result = lookupByEmail("buyer@globaltextiles.com");
    expect(result.record.country).toBeUndefined();
    expect(result.warnings.join(" ")).toMatch(/no country/i);
  });

  it("treats a personal provider as revealing nothing about a company", () => {
    const result = lookupByEmail("maria.lopez@gmail.com");
    expect(result.record.emailType?.value).toBe("Personal provider");
    expect(result.record.companyName).toBeUndefined();
    expect(result.record.website).toBeUndefined();
    /* Still reads the person's name from the local part. */
    expect(result.record.contactName?.value).toBe("Maria Lopez");
  });

  it("does not derive a country from a personal provider's domain", () => {
    /* gmx.de is German but tells us nothing about where the buyer trades. */
    const result = lookupByEmail("hans@gmx.de");
    expect(result.record.country).toBeUndefined();
  });

  it("flags role mailboxes and scores buying roles as high priority", () => {
    const buying = lookupByEmail("einkauf@weber.de");
    expect(buying.record.roleCategory?.value).toBe("Procurement");

    const shared = lookupByEmail("info@weber.de");
    expect(shared.record.roleCategory?.value).toBe("General inbox");
    expect(shared.warnings.join(" ")).toMatch(/shared inbox/i);
  });

  it("recognises buying roles in the buyer's own language", () => {
    for (const [local, expected] of [
      ["einkauf", "Procurement"],
      ["inkoop", "Procurement"],
      ["achats", "Procurement"],
      ["compras", "Procurement"],
      ["acquisti", "Procurement"],
      ["import", "Import"],
      ["sourcing", "Sourcing"],
    ] as const) {
      expect(lookupByEmail(`${local}@firm.de`).record.roleCategory?.value, local).toBe(expected);
    }
  });

  it("reads a person's name from common address patterns", () => {
    expect(lookupByEmail("jan.vandenberg@firm.nl").record.contactName?.value).toBe("Jan Vandenberg");
    expect(lookupByEmail("j.schmidt@firm.de").record.contactName?.value).toBe("J Schmidt");
    expect(lookupByEmail("anna_brandt@firm.de").record.contactName?.value).toBe("Anna Brandt");
  });

  it("does not invent a name from a code or a single word", () => {
    for (const local of ["kb", "x.y", "ab.cd.ef.gh", "orders2024"]) {
      expect(lookupByEmail(`${local}@firm.de`).record.contactName, local).toBeUndefined();
    }
  });

  it("strips legal-form suffixes from a guessed company name", () => {
    expect(lookupByEmail("x@weber-gmbh.de").record.companyName?.value).toBe("Weber");
    expect(lookupByEmail("x@dutchlinen-bv.nl").record.companyName?.value).toBe("Dutchlinen");
  });

  it("never claims high confidence for a guessed company name", () => {
    const result = lookupByEmail("x@heimtextil-weber.de");
    expect(result.record.companyName?.confidence).toBe("low");
    expect(result.record.domain?.confidence).toBe("verified");
  });

  it("marks automated mailboxes so they are never campaigned to", () => {
    const result = lookupByEmail("noreply@firm.de");
    expect(result.record.roleCategory?.value).toBe("Automated");
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
