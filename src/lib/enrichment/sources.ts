import type { SourceDescriptor, SourceId } from "./types";

/**
 * Every way a buyer fact can enter the database. The lookup page renders this
 * list so it is always clear which sources contributed and which are still dark.
 */
export const SOURCES: SourceDescriptor[] = [
  {
    id: "email",
    label: "Email address analysis",
    status: "ready",
    phase: "Phase 0",
    provides: "Domain, country from ccTLD, role category, likely contact name",
  },
  {
    id: "dns",
    label: "DNS / MX check",
    status: "planned",
    phase: "Phase 1",
    provides: "Whether the domain accepts mail at all, and which provider hosts it",
    blockedBy: "Needs a Supabase Edge Function — browsers cannot query DNS",
  },
  {
    id: "gmail",
    label: "Gmail conversation history",
    status: "planned",
    phase: "Phase 2",
    provides: "Past threads, signature blocks (phone, designation), conversation status",
    blockedBy: "Needs mailbox access — see README",
  },
  {
    id: "apollo",
    label: "Apollo",
    status: "needs-config",
    phase: "Phase 4",
    provides: "Verified company data, named decision-makers, designations, direct phones",
    blockedBy: "Needs an Apollo API key",
  },
  {
    id: "website",
    label: "Company website",
    status: "planned",
    phase: "Phase 4",
    provides: "Legal company name, address, imprint contacts, product categories",
    blockedBy: "Needs a server-side fetch",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    status: "planned",
    phase: "Phase 4",
    provides: "Current role, tenure, confirms the person still works there",
  },
];

export const SOURCE_LABELS: Record<SourceId, string> = {
  email: "Email analysis",
  dns: "DNS",
  gmail: "Gmail history",
  apollo: "Apollo",
  website: "Website",
  linkedin: "LinkedIn",
  manual: "Entered by hand",
};
