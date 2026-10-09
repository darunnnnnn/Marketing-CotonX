/**
 * Demo data so every screen is real and clickable before Supabase exists.
 * Shapes match `types.ts` exactly, so swapping in the Postgres repository
 * changes no component.
 */

import type {
  Campaign,
  Company,
  Contact,
  Handoff,
  MergeCandidate,
  OutreachEvent,
  Suppression,
  Template,
} from "./types.ts";

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

export const companies: Company[] = [
  { id: "c1", name: "Heimtextil Weber", domain: "heimtextil-weber.de", website: "https://heimtextil-weber.de", countryCode: "DE", country: "Germany", city: "Wuppertal", industry: "Home textiles", employeeCount: 120, verified: true, sources: ["gmail", "apollo"], createdAt: daysAgo(210) },
  { id: "c2", name: "Bettwaren Nord", domain: "bettwaren-nord.de", website: "https://bettwaren-nord.de", countryCode: "DE", country: "Germany", city: "Hamburg", industry: "Bedding", employeeCount: 45, verified: true, sources: ["gmail"], createdAt: daysAgo(185) },
  { id: "c3", name: "Textilhaus Sauer", domain: "textilhaus-sauer.de", countryCode: "DE", country: "Germany", city: "Munich", industry: "Home textiles", employeeCount: 30, verified: false, sources: ["apollo"], createdAt: daysAgo(40) },
  { id: "c4", name: "Dutch Home Textiles", domain: "dutchhometextiles.nl", website: "https://dutchhometextiles.nl", countryCode: "NL", country: "Netherlands", city: "Rotterdam", industry: "Importer", employeeCount: 80, verified: true, sources: ["gmail", "apollo", "linkedin"], createdAt: daysAgo(160) },
  { id: "c5", name: "Amsterdam Linen Co", domain: "amsterdamlinen.nl", countryCode: "NL", country: "Netherlands", city: "Amsterdam", industry: "Linen", employeeCount: 25, verified: true, sources: ["apollo"], createdAt: daysAgo(95) },
  { id: "c6", name: "Maison du Linge", domain: "maisondulinge.fr", website: "https://maisondulinge.fr", countryCode: "FR", country: "France", city: "Lyon", industry: "Home textiles", employeeCount: 60, verified: true, sources: ["gmail"], createdAt: daysAgo(140) },
  { id: "c7", name: "Textiles Provence", domain: "textiles-provence.fr", countryCode: "FR", country: "France", city: "Marseille", industry: "Home textiles", employeeCount: 18, verified: false, sources: ["website"], createdAt: daysAgo(30) },
  { id: "c8", name: "Casa Bella Tessili", domain: "casabella.it", website: "https://casabella.it", countryCode: "IT", country: "Italy", city: "Milan", industry: "Home textiles", employeeCount: 95, verified: true, sources: ["apollo"], createdAt: daysAgo(120) },
  { id: "c9", name: "Textiles del Norte", domain: "textilesdelnorte.es", countryCode: "ES", country: "Spain", city: "Barcelona", industry: "Importer", employeeCount: 55, verified: true, sources: ["gmail", "apollo"], createdAt: daysAgo(100) },
  { id: "c10", name: "Nordic Home AB", domain: "nordichome.se", countryCode: "SE", country: "Sweden", city: "Gothenburg", industry: "Retail", employeeCount: 200, verified: true, sources: ["apollo"], createdAt: daysAgo(75) },
  { id: "c11", name: "Grupo Textil Monterrey", domain: "gtmonterrey.mx", countryCode: "MX", country: "Mexico", city: "Monterrey", industry: "Importer", employeeCount: 140, verified: true, sources: ["apollo", "linkedin"], createdAt: daysAgo(65) },
  { id: "c12", name: "Atlantic Home Goods", domain: "atlantichome.us", countryCode: "US", country: "United States", city: "Charlotte", industry: "Wholesale", employeeCount: 310, verified: true, sources: ["apollo"], createdAt: daysAgo(55) },
  { id: "c13", name: "London Linen House", domain: "londonlinen.co.uk", countryCode: "GB", country: "United Kingdom", city: "London", industry: "Retail", employeeCount: 70, verified: true, sources: ["gmail"], createdAt: daysAgo(170) },
  { id: "c14", name: "Bruxelles Textiles", domain: "bruxellestextiles.be", countryCode: "BE", country: "Belgium", city: "Brussels", industry: "Importer", employeeCount: 40, verified: false, sources: ["website"], createdAt: daysAgo(22) },
];

export const contacts: Contact[] = [
  { id: "p1", companyId: "c1", name: "Klaus Weber", email: "k.weber@heimtextil-weber.de", phone: "+49 202 555 118", designation: "Head of Purchasing", roleCategory: "Procurement", rolePriority: "high", preferredLanguage: "de", status: "enquiry_received", lastTouchAt: daysAgo(4), lastReplyAt: daysAgo(4), sequencePosition: { camp1: 2 }, verified: true, sources: ["gmail", "apollo"], doNotContact: false, callConsent: true, createdAt: daysAgo(210) },
  { id: "p2", companyId: "c1", email: "einkauf@heimtextil-weber.de", roleCategory: "Procurement", rolePriority: "high", preferredLanguage: "de", status: "introduction_sent", lastTouchAt: daysAgo(18), sequencePosition: { camp1: 1 }, verified: true, sources: ["gmail"], doNotContact: false, callConsent: false, createdAt: daysAgo(205) },
  { id: "p3", companyId: "c2", name: "Petra Lindqvist", email: "p.lindqvist@bettwaren-nord.de", designation: "Import Manager", roleCategory: "Import", rolePriority: "high", preferredLanguage: "de", status: "no_reply", lastTouchAt: daysAgo(46), sequencePosition: { camp1: 2 }, verified: true, sources: ["gmail"], doNotContact: false, callConsent: false, createdAt: daysAgo(185) },
  { id: "p4", companyId: "c3", name: "Markus Sauer", email: "m.sauer@textilhaus-sauer.de", designation: "Managing Director", roleCategory: "Executive", rolePriority: "medium", preferredLanguage: "de", status: "never_contacted", sequencePosition: {}, verified: false, sources: ["apollo"], doNotContact: false, callConsent: false, createdAt: daysAgo(40) },
  { id: "p5", companyId: "c4", name: "Jan van den Berg", email: "j.vandenberg@dutchhometextiles.nl", phone: "+31 10 555 221", designation: "Purchasing Director", roleCategory: "Procurement", rolePriority: "high", preferredLanguage: "nl", status: "buyer_replied", lastTouchAt: daysAgo(6), lastReplyAt: daysAgo(5), sequencePosition: { camp1: 2 }, verified: true, sources: ["gmail", "apollo", "linkedin"], doNotContact: false, callConsent: true, createdAt: daysAgo(160) },
  { id: "p6", companyId: "c4", name: "Sanne Mulder", email: "s.mulder@dutchhometextiles.nl", designation: "Category Buyer", roleCategory: "Procurement", rolePriority: "high", preferredLanguage: "nl", status: "waiting_for_buyer", lastTouchAt: daysAgo(9), sequencePosition: { camp2: 1 }, verified: true, sources: ["apollo"], doNotContact: false, callConsent: false, createdAt: daysAgo(88) },
  { id: "p7", companyId: "c5", email: "inkoop@amsterdamlinen.nl", roleCategory: "Procurement", rolePriority: "high", preferredLanguage: "nl", status: "never_contacted", sequencePosition: {}, verified: true, sources: ["apollo"], doNotContact: false, callConsent: false, createdAt: daysAgo(95) },
  { id: "p8", companyId: "c6", name: "Celine Dubois", email: "c.dubois@maisondulinge.fr", phone: "+33 4 72 55 88", designation: "Responsable Achats", roleCategory: "Procurement", rolePriority: "high", preferredLanguage: "fr", status: "follow_up_required", lastTouchAt: daysAgo(21), sequencePosition: { camp1: 1 }, verified: true, sources: ["gmail"], doNotContact: false, callConsent: false, createdAt: daysAgo(140) },
  { id: "p9", companyId: "c7", email: "contact@textiles-provence.fr", roleCategory: "General inbox", rolePriority: "low", preferredLanguage: "fr", status: "never_contacted", sequencePosition: {}, verified: false, sources: ["website"], doNotContact: false, callConsent: false, createdAt: daysAgo(30) },
  { id: "p10", companyId: "c8", name: "Marco Bellini", email: "m.bellini@casabella.it", designation: "Direttore Acquisti", roleCategory: "Procurement", rolePriority: "high", preferredLanguage: "it", status: "conversation_started", lastTouchAt: daysAgo(11), lastReplyAt: daysAgo(12), sequencePosition: { camp1: 2 }, verified: true, sources: ["apollo"], doNotContact: false, callConsent: true, createdAt: daysAgo(120) },
  { id: "p11", companyId: "c9", name: "Elena Ruiz", email: "e.ruiz@textilesdelnorte.es", designation: "Jefa de Compras", roleCategory: "Procurement", rolePriority: "high", preferredLanguage: "es", status: "active_lead", lastTouchAt: daysAgo(3), lastReplyAt: daysAgo(3), sequencePosition: { camp1: 3 }, verified: true, sources: ["gmail", "apollo"], doNotContact: false, callConsent: true, createdAt: daysAgo(100) },
  { id: "p12", companyId: "c10", name: "Anders Holm", email: "a.holm@nordichome.se", designation: "Sourcing Lead", roleCategory: "Sourcing", rolePriority: "high", preferredLanguage: "en", status: "introduction_sent", lastTouchAt: daysAgo(13), sequencePosition: { camp2: 1 }, verified: true, sources: ["apollo"], doNotContact: false, callConsent: false, createdAt: daysAgo(75) },
  { id: "p13", companyId: "c11", name: "Rodrigo Alvarez", email: "r.alvarez@gtmonterrey.mx", phone: "+52 81 5555 9021", designation: "Gerente de Importaciones", roleCategory: "Import", rolePriority: "high", preferredLanguage: "es", status: "never_contacted", sequencePosition: {}, verified: true, sources: ["apollo", "linkedin"], doNotContact: false, callConsent: false, createdAt: daysAgo(65) },
  { id: "p14", companyId: "c12", name: "Dana Whitfield", email: "d.whitfield@atlantichome.us", designation: "VP Sourcing", roleCategory: "Sourcing", rolePriority: "high", preferredLanguage: "en", status: "no_reply", lastTouchAt: daysAgo(52), sequencePosition: { camp1: 2 }, verified: true, sources: ["apollo"], doNotContact: false, callConsent: false, createdAt: daysAgo(55) },
  { id: "p15", companyId: "c13", name: "Oliver Grant", email: "o.grant@londonlinen.co.uk", designation: "Buying Manager", roleCategory: "Procurement", rolePriority: "high", preferredLanguage: "en", status: "waiting_for_buyer", lastTouchAt: daysAgo(8), sequencePosition: { camp1: 1 }, verified: true, sources: ["gmail"], doNotContact: false, callConsent: false, createdAt: daysAgo(170) },
  { id: "p16", companyId: "c14", email: "info@bruxellestextiles.be", roleCategory: "General inbox", rolePriority: "low", preferredLanguage: "nl", status: "never_contacted", sequencePosition: {}, verified: false, sources: ["website"], doNotContact: false, callConsent: false, createdAt: daysAgo(22) },
  { id: "p17", companyId: "c2", name: "Petra Lindquist", email: "petra.lindquist@bettwaren-nord.de", designation: "Import Mgr", roleCategory: "Import", rolePriority: "high", preferredLanguage: "de", status: "never_contacted", sequencePosition: {}, verified: false, sources: ["apollo"], doNotContact: false, callConsent: false, createdAt: daysAgo(12) },
  { id: "p18", companyId: "c6", email: "achats@maisondulinge.fr", roleCategory: "Procurement", rolePriority: "high", preferredLanguage: "fr", status: "never_contacted", sequencePosition: {}, verified: true, sources: ["website"], doNotContact: false, callConsent: false, createdAt: daysAgo(18) },
];

export const mergeCandidates: MergeCandidate[] = [
  {
    id: "m1",
    reason: "Same company, near-identical name and designation. Likely the same person imported twice.",
    score: 0.92,
    contactIds: ["p3", "p17"],
  },
];

export const templates: Template[] = [
  {
    id: "t1",
    name: "Cotonex introduction (EN)",
    kind: "introduction",
    channel: "email",
    language: "en",
    subject: "Cotonex - home textile manufacturing partner",
    body: "Dear {{contact_name}},\n\nI am writing from Cotonex, a home textile manufacturer supplying importers and retailers across Europe.\n\nWe produce bed linen, towels, kitchen textiles and cotton bags to buyer specification, with certified production and full traceability.\n\nOur company profile is attached. If {{company_name}} is reviewing suppliers for the coming season, I would be glad to share references and indicative pricing.\n\nKind regards,\nCotonex",
    attachments: ["cotonex-profile.pdf"],
  },
  {
    id: "t2",
    name: "Cotonex Vorstellung (DE)",
    kind: "introduction",
    channel: "email",
    language: "de",
    subject: "Cotonex - Partner fuer Heimtextilien",
    body: "Sehr geehrte Damen und Herren,\n\nich melde mich von Cotonex, einem Hersteller von Heimtextilien fuer Importeure und Haendler in Europa.\n\nWir fertigen Bettwaesche, Handtuecher und Kuechentextilien nach Kundenspezifikation.\n\nUnser Firmenprofil finden Sie im Anhang.\n\nMit freundlichen Gruessen\nCotonex",
    attachments: ["cotonex-profil-de.pdf"],
  },
  {
    id: "t3",
    name: "Follow-up (no reply)",
    kind: "follow_up",
    channel: "email",
    language: "en",
    subject: "Re: Cotonex - home textile manufacturing partner",
    body: "Dear {{contact_name}},\n\nI wanted to follow up briefly on my note from {{last_touch_date}}.\n\nIf sourcing is handled by a colleague, I would be grateful for a pointer in the right direction.\n\nKind regards,\nCotonex",
    attachments: [],
  },
  {
    id: "t4",
    name: "Spring / Summer collection",
    kind: "collection",
    channel: "email",
    language: "en",
    subject: "Cotonex Spring/Summer collection",
    body: "Dear {{contact_name}},\n\nOur Spring/Summer range is now available: lightweight cotton bedding, waffle towels and printed kitchen textiles.\n\nThe lookbook is attached.\n\nKind regards,\nCotonex",
    attachments: ["ss-collection.pdf"],
  },
  {
    id: "t5",
    name: "Capability and certifications",
    kind: "proof",
    channel: "email",
    language: "en",
    subject: "Cotonex - capacity, certifications and audits",
    body: "Dear {{contact_name}},\n\nA short summary of our production capability: monthly capacity, OEKO-TEX and GOTS certification, and recent audit reports.\n\nKind regards,\nCotonex",
    attachments: ["certifications.pdf"],
  },
  {
    id: "t6",
    name: "Heimtextil fair invitation",
    kind: "event",
    channel: "email",
    language: "en",
    subject: "Meet Cotonex at Heimtextil",
    body: "Dear {{contact_name}},\n\nCotonex will be exhibiting at Heimtextil. We would be glad to arrange a meeting at our stand.\n\nKind regards,\nCotonex",
    attachments: [],
  },
  {
    id: "t7",
    name: "Introduction (WhatsApp)",
    kind: "introduction",
    channel: "whatsapp",
    language: "en",
    subject: "",
    body: "Hello {{contact_name}}, this is Cotonex, a home textile manufacturer. May I send you our company profile?",
    attachments: [],
  },
];

export const campaigns: Campaign[] = [
  {
    id: "camp1",
    name: "Germany - Introduction",
    kind: "introduction",
    channel: "email",
    status: "running",
    countryCodes: ["DE"],
    targetStatuses: ["never_contacted"],
    steps: [
      { id: "s1", order: 1, channel: "email", kind: "introduction", templateId: "t2", delayDays: 0 },
      { id: "s2", order: 2, channel: "email", kind: "follow_up", templateId: "t3", delayDays: 7 },
      { id: "s3", order: 3, channel: "email", kind: "proof", templateId: "t5", delayDays: 14 },
    ],
    approvedBy: "ceo@cotonex.test",
    approvedAt: daysAgo(30),
    scheduledFrom: daysAgo(28),
    createdAt: daysAgo(35),
  },
  {
    id: "camp2",
    name: "Benelux - Spring collection",
    kind: "collection",
    channel: "email",
    status: "pending_approval",
    countryCodes: ["NL", "BE"],
    targetStatuses: ["no_reply", "waiting_for_buyer", "follow_up_required"],
    steps: [
      { id: "s4", order: 1, channel: "email", kind: "collection", templateId: "t4", delayDays: 0 },
      { id: "s5", order: 2, channel: "email", kind: "follow_up", templateId: "t3", delayDays: 10 },
    ],
    createdAt: daysAgo(5),
  },
  {
    id: "camp3",
    name: "France - Heimtextil invitation",
    kind: "event",
    channel: "email",
    status: "draft",
    countryCodes: ["FR"],
    targetStatuses: ["never_contacted", "no_reply"],
    steps: [{ id: "s6", order: 1, channel: "email", kind: "event", templateId: "t6", delayDays: 0 }],
    createdAt: daysAgo(2),
  },
  {
    id: "camp4",
    name: "Mexico and US - Introduction",
    kind: "introduction",
    channel: "email",
    status: "approved",
    countryCodes: ["MX", "US"],
    targetStatuses: ["never_contacted"],
    steps: [
      { id: "s7", order: 1, channel: "email", kind: "introduction", templateId: "t1", delayDays: 0 },
      { id: "s8", order: 2, channel: "email", kind: "follow_up", templateId: "t3", delayDays: 7 },
    ],
    approvedBy: "ceo@cotonex.test",
    approvedAt: daysAgo(1),
    createdAt: daysAgo(8),
  },
];

export const events: OutreachEvent[] = [
  { id: "e1", contactId: "p1", campaignId: "camp1", stepId: "s1", channel: "email", type: "sent", at: daysAgo(25) },
  { id: "e2", contactId: "p1", campaignId: "camp1", stepId: "s1", channel: "email", type: "opened", at: daysAgo(25) },
  { id: "e3", contactId: "p1", campaignId: "camp1", stepId: "s2", channel: "email", type: "sent", at: daysAgo(18) },
  { id: "e4", contactId: "p1", campaignId: "camp1", channel: "email", type: "replied", at: daysAgo(4), detail: "Asked for pricing on 200 GSM towels" },
  { id: "e5", contactId: "p1", campaignId: "camp1", channel: "email", type: "stopped", at: daysAgo(4), detail: "Buyer replied - sequence halted, handed to sales" },
  { id: "e6", contactId: "p5", campaignId: "camp1", stepId: "s1", channel: "email", type: "sent", at: daysAgo(20) },
  { id: "e7", contactId: "p5", campaignId: "camp1", stepId: "s1", channel: "email", type: "opened", at: daysAgo(20) },
  { id: "e8", contactId: "p5", campaignId: "camp1", stepId: "s2", channel: "email", type: "sent", at: daysAgo(6) },
  { id: "e9", contactId: "p5", campaignId: "camp1", channel: "email", type: "replied", at: daysAgo(5), detail: "Requested samples" },
  { id: "e10", contactId: "p5", campaignId: "camp1", channel: "email", type: "stopped", at: daysAgo(5), detail: "Buyer replied - sequence halted, handed to sales" },
  { id: "e11", contactId: "p3", campaignId: "camp1", stepId: "s1", channel: "email", type: "sent", at: daysAgo(60) },
  { id: "e12", contactId: "p3", campaignId: "camp1", stepId: "s2", channel: "email", type: "sent", at: daysAgo(46) },
  { id: "e13", contactId: "p11", campaignId: "camp1", channel: "email", type: "replied", at: daysAgo(3), detail: "Wants a quotation for 5,000 bed sets" },
  { id: "e14", contactId: "p11", campaignId: "camp1", channel: "email", type: "stopped", at: daysAgo(3), detail: "Buyer replied - sequence halted, handed to sales" },
  { id: "e15", contactId: "p10", campaignId: "camp1", stepId: "s1", channel: "email", type: "sent", at: daysAgo(26) },
  { id: "e16", contactId: "p10", campaignId: "camp1", channel: "email", type: "replied", at: daysAgo(12), detail: "Asked about GOTS certification" },
  { id: "e17", contactId: "p14", campaignId: "camp1", stepId: "s1", channel: "email", type: "sent", at: daysAgo(66) },
  { id: "e18", contactId: "p14", campaignId: "camp1", stepId: "s2", channel: "email", type: "sent", at: daysAgo(52) },
  { id: "e19", contactId: "p12", campaignId: "camp2", stepId: "s4", channel: "email", type: "sent", at: daysAgo(13) },
  { id: "e20", contactId: "p12", campaignId: "camp2", stepId: "s4", channel: "email", type: "opened", at: daysAgo(12) },
  { id: "e21", contactId: "p15", campaignId: "camp1", stepId: "s1", channel: "email", type: "sent", at: daysAgo(8) },
  { id: "e22", contactId: "p8", campaignId: "camp1", stepId: "s1", channel: "email", type: "sent", at: daysAgo(21) },
  { id: "e23", contactId: "p9", campaignId: "camp1", stepId: "s1", channel: "email", type: "bounced", at: daysAgo(30), detail: "550 mailbox unavailable" },
  { id: "e24", contactId: "p6", campaignId: "camp2", stepId: "s4", channel: "email", type: "sent", at: daysAgo(9) },
];

export const handoffs: Handoff[] = [
  { id: "h1", contactId: "p1", campaignId: "camp1", reason: "Buyer replied asking for towel pricing", at: daysAgo(4), resolved: false },
  { id: "h2", contactId: "p5", campaignId: "camp1", reason: "Buyer requested samples", at: daysAgo(5), resolved: false },
  { id: "h3", contactId: "p11", campaignId: "camp1", reason: "Buyer wants a quotation for 5,000 bed sets", at: daysAgo(3), resolved: true },
  { id: "h4", contactId: "p10", campaignId: "camp1", reason: "Buyer asked about GOTS certification", at: daysAgo(12), resolved: true },
];

export const suppressions: Suppression[] = [
  { id: "x1", value: "contact@textiles-provence.fr", scope: "email", reason: "bounce", at: daysAgo(30) },
  { id: "x2", value: "k.weber@heimtextil-weber.de", scope: "email", reason: "human_owned", at: daysAgo(4) },
  { id: "x3", value: "j.vandenberg@dutchhometextiles.nl", scope: "email", reason: "human_owned", at: daysAgo(5) },
  { id: "x4", value: "e.ruiz@textilesdelnorte.es", scope: "email", reason: "human_owned", at: daysAgo(3) },
];
