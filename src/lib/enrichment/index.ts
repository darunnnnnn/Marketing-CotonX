import { COMPANY_SUFFIXES, FREE_PROVIDERS, ROLE_PREFIXES, SLD_PREFIXES, TLD_COUNTRIES } from "./data";
import type { BuyerRecord, Fact, LookupResult } from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

const fact = <T>(value: T, confidence: Fact<T>["confidence"], note?: string): Fact<T> => ({
  value,
  source: "email",
  confidence,
  note,
});

const titleCase = (text: string) =>
  text
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");

/** "hansmueller-textil.de" -> "Hansmueller Textil" — a starting point, not the legal name. */
function companyFromDomain(domain: string): string {
  const base = domain.split(".")[0];
  const words = base
    .split(/[-_]/)
    .filter((word) => word && !COMPANY_SUFFIXES.includes(word.toLowerCase()));
  return titleCase((words.length ? words : [base]).join(" "));
}

/** firstname.lastname / f.lastname / firstname_lastname -> a person's name. */
function personFromLocalPart(local: string): string | undefined {
  const cleaned = local.replace(/\d+$/, "");
  const parts = cleaned.split(/[._-]/).filter(Boolean);
  if (parts.length < 2 || parts.length > 3) return undefined;
  if (parts.some((part) => part.length > 20)) return undefined;
  /* A single initial is common (j.schmidt) but two initials is probably a code. */
  const initials = parts.filter((part) => part.length === 1).length;
  if (initials > 1) return undefined;
  if (parts.every((part) => part.length === 1)) return undefined;
  return titleCase(parts.join(" "));
}

function countryFromDomain(domain: string) {
  const labels = domain.split(".");
  const tld = labels[labels.length - 1];
  const direct = TLD_COUNTRIES[tld];
  if (direct) {
    /* co.uk, com.au: the ccTLD is still the last label, so this already covers them. */
    const isSld = labels.length > 2 && SLD_PREFIXES.has(labels[labels.length - 2]);
    return { ...direct, confidence: isSld ? ("high" as const) : ("high" as const) };
  }
  return undefined;
}

export function lookupByEmail(input: string): LookupResult {
  const email = input.trim().toLowerCase();
  const warnings: string[] = [];
  const record: BuyerRecord = {};

  if (!email) {
    return { email, valid: false, problem: "Enter an email address.", record, warnings };
  }
  if (!EMAIL_RE.test(email)) {
    return { email, valid: false, problem: "That is not a valid email address.", record, warnings };
  }

  const [local, domain] = email.split("@");

  record.domain = fact(domain, "verified");

  /* A free provider address tells us about a person, never about a company. */
  if (FREE_PROVIDERS.has(domain)) {
    record.emailType = fact("Personal provider", "verified");
    warnings.push(
      "Personal email provider — the domain reveals nothing about the company. Country, employer and role all have to come from Apollo, past conversations, or the signature block.",
    );
  } else {
    record.emailType = fact("Company domain", "high");
    record.companyName = fact(
      companyFromDomain(domain),
      "low",
      "Guessed from the domain. The legal name comes from Apollo or the website imprint.",
    );
    record.website = fact(`https://${domain}`, "medium", "Assumed from the email domain.");

    const country = countryFromDomain(domain);
    if (country) {
      record.country = fact(country.name, country.confidence, "From the country-code domain.");
      record.countryCode = fact(country.code, country.confidence);
    } else {
      warnings.push(
        `No country in ".${domain.split(".").pop()}" — a generic domain. Country must come from Apollo, the website address, or a phone dialling code.`,
      );
    }
  }

  /* Role mailbox, or a named person? */
  const prefix = local.split(/[._-]/)[0];
  const role = ROLE_PREFIXES[local] ?? ROLE_PREFIXES[prefix];

  if (role) {
    record.roleCategory = fact(role.category, "high", role.note);
    if (role.priority === "low") {
      warnings.push(
        `"${local}@" is a ${role.category.toLowerCase()} address, not a named person. Campaigns to shared inboxes convert poorly — find a decision-maker at this company first.`,
      );
    }
  } else {
    const person = personFromLocalPart(local);
    if (person) {
      record.contactName = fact(
        person,
        "medium",
        "Read from the address pattern. Confirm against a signature block or Apollo.",
      );
      record.roleCategory = fact("Named individual", "medium", "Role unknown until enriched.");
    } else {
      warnings.push("Could not read a person's name from the address. Needs enrichment to identify who this is.");
    }
  }

  return { email, valid: true, record, warnings };
}
