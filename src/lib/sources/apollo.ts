/**
 * Apollo adapter (requirement 7).
 *
 * The real call must run server-side: Apollo's key is secret and their API
 * does not permit browser origins. So this module owns the request shape and
 * the response mapping, and `search()` posts to a Supabase Edge Function that
 * holds the key. Until that function exists, it falls back to a deterministic
 * sample so the screen is usable and the mapping is exercised.
 */

import type { Company, Contact } from "../domain/types";

/** The targeting rules of requirement 6, as a reusable preset. */
export type SearchPreset = {
  id: string;
  label: string;
  titles: string[];
  industries: string[];
  keywords: string[];
};

export const BUYER_PRESET: SearchPreset = {
  id: "home-textile-buyers",
  label: "Home textile buyers and importers",
  titles: [
    "Purchasing Manager",
    "Purchase Manager",
    "Head of Purchasing",
    "Buying Manager",
    "Category Buyer",
    "Import Manager",
    "Head of Import",
    "Sourcing Manager",
    "Head of Sourcing",
    "Procurement Manager",
    "Supply Chain Manager",
    "Merchandise Manager",
    "Managing Director",
  ],
  industries: ["Textiles", "Home Furnishings", "Wholesale", "Retail", "Import and Export"],
  keywords: ["home textiles", "bed linen", "towels", "kitchen textiles", "cotton bags", "ready textiles"],
};

export type ApolloQuery = {
  countryCode: string;
  preset: SearchPreset;
  /** Narrow the preset further, e.g. only "Import Manager". */
  titleFilter?: string[];
  employeeRange?: [number, number];
  page: number;
  perPage: number;
};

export type ApolloHit = {
  externalId: string;
  personName: string;
  title: string;
  email?: string;
  emailStatus: "verified" | "guessed" | "locked";
  phone?: string;
  linkedin?: string;
  companyName: string;
  companyDomain: string;
  companyCountry: string;
  companyCity?: string;
  employeeCount?: number;
  industry?: string;
};

export type ApolloResponse = {
  hits: ApolloHit[];
  total: number;
  page: number;
  /** True when the sample data was used because no key is configured. */
  sample: boolean;
  /** Apollo charges a credit per revealed email; surfaced so it is never a surprise. */
  creditsUsed: number;
};

/** Maps Apollo's payload onto our domain shape. The point of the adapter. */
export function toDomain(hit: ApolloHit, now = new Date()) {
  const companyId = `apollo-${hit.companyDomain}`;
  const company: Company = {
    id: companyId,
    name: hit.companyName,
    domain: hit.companyDomain,
    website: `https://${hit.companyDomain}`,
    countryCode: hit.companyCountry,
    country: hit.companyCountry,
    city: hit.companyCity,
    industry: hit.industry,
    employeeCount: hit.employeeCount,
    verified: false,
    sources: ["apollo"],
    createdAt: now.toISOString(),
  };

  const contact: Contact = {
    id: `apollo-${hit.externalId}`,
    companyId,
    name: hit.personName,
    email: hit.email ?? "",
    phone: hit.phone,
    designation: hit.title,
    roleCategory: categorise(hit.title),
    rolePriority: priority(hit.title),
    linkedin: hit.linkedin,
    preferredLanguage: "en",
    status: "never_contacted",
    sequencePosition: {},
    /* Apollo's own "verified" only means the address resolves, not that the
       person is the right target — a human still confirms in the review queue. */
    verified: false,
    sources: ["apollo"],
    doNotContact: false,
    callConsent: false,
    createdAt: now.toISOString(),
  };

  return { company, contact };
}

function categorise(title: string): string {
  const lower = title.toLowerCase();
  if (/purchas|buying|buyer|procure|einkauf|achat|compras/.test(lower)) return "Procurement";
  if (/import/.test(lower)) return "Import";
  if (/sourc/.test(lower)) return "Sourcing";
  if (/supply|logistic/.test(lower)) return "Supply chain";
  if (/merchand/.test(lower)) return "Merchandising";
  if (/director|ceo|owner|manag.*direct|geschaftsfuhr/.test(lower)) return "Executive";
  return "Other";
}

function priority(title: string): "high" | "medium" | "low" {
  const category = categorise(title);
  if (["Procurement", "Import", "Sourcing", "Merchandising"].includes(category)) return "high";
  if (category === "Executive" || category === "Supply chain") return "medium";
  return "low";
}

const ENDPOINT = "/functions/v1/apollo-search";

export async function search(query: ApolloQuery): Promise<ApolloResponse> {
  const base = import.meta.env.VITE_SUPABASE_URL;

  if (!base) {
    return sampleResponse(query);
  }

  try {
    const response = await fetch(`${base}${ENDPOINT}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(query),
    });
    if (!response.ok) throw new Error(`Apollo search failed: ${response.status}`);
    return (await response.json()) as ApolloResponse;
  } catch {
    /* The Edge Function is not deployed yet. Sample data keeps the screen
       usable rather than showing an error for an expected gap. */
    return sampleResponse(query);
  }
}

/* ----------------------------------------------------------- sample data -- */

const FIRST = ["Anna", "Lukas", "Marie", "Jens", "Sofia", "Pieter", "Lena", "Mateo", "Hanna", "Tomas", "Ines", "Felix"];
const LAST = ["Brandt", "Keller", "Hoffmann", "de Vries", "Jansen", "Moreau", "Rossi", "Garcia", "Nilsson", "Novak", "Hughes", "Costa"];
const STEMS = ["Textil", "Linen", "Home", "Casa", "Maison", "Decor", "Living", "Baumwoll", "Weave", "Nordic"];
const TAILS = ["Group", "Trading", "Import", "Handels", "Collective", "Partners", "Distribution", "House"];

const TLD: Record<string, string> = {
  DE: "de", NL: "nl", FR: "fr", IT: "it", ES: "es", BE: "be", AT: "at", SE: "se",
  GB: "co.uk", US: "com", MX: "mx", PL: "pl", TR: "com.tr", BR: "com.br",
};

/** Deterministic per query, so re-running a search looks stable. */
function hash(text: string): number {
  let value = 0;
  for (let index = 0; index < text.length; index += 1) {
    value = (value * 31 + text.charCodeAt(index)) >>> 0;
  }
  return value;
}

function sampleResponse(query: ApolloQuery): ApolloResponse {
  const titles = query.titleFilter?.length ? query.titleFilter : query.preset.titles;
  const hits: ApolloHit[] = [];
  const seed = hash(`${query.countryCode}:${query.page}:${titles.join(",")}`);

  for (let index = 0; index < query.perPage; index += 1) {
    const n = seed + index * 7919;
    const first = FIRST[n % FIRST.length];
    const last = LAST[(n >> 3) % LAST.length];
    const stem = STEMS[(n >> 5) % STEMS.length];
    const tail = TAILS[(n >> 7) % TAILS.length];
    const domain = `${stem}${tail}`.toLowerCase() + "." + (TLD[query.countryCode] ?? "com");
    const title = titles[(n >> 9) % titles.length];
    /* Apollo commonly returns a locked email until a credit is spent. */
    const locked = n % 5 === 0;

    hits.push({
      externalId: `sample-${query.countryCode}-${query.page}-${index}`,
      personName: `${first} ${last}`,
      title,
      email: locked ? undefined : `${first[0].toLowerCase()}.${last.replace(/[^a-z]/gi, "").toLowerCase()}@${domain}`,
      emailStatus: locked ? "locked" : n % 3 === 0 ? "guessed" : "verified",
      phone: n % 4 === 0 ? undefined : `+${(n % 90) + 10} ${(n % 900) + 100} ${(n % 9000) + 1000}`,
      linkedin: `https://linkedin.com/in/${first.toLowerCase()}-${last.replace(/[^a-z]/gi, "").toLowerCase()}`,
      companyName: `${stem} ${tail}`,
      companyDomain: domain,
      companyCountry: query.countryCode,
      companyCity: undefined,
      employeeCount: 15 + (n % 400),
      industry: query.preset.industries[(n >> 11) % query.preset.industries.length],
    });
  }

  return {
    hits,
    total: 240 + (seed % 400),
    page: query.page,
    sample: true,
    creditsUsed: hits.filter((hit) => hit.email).length,
  };
}
