/**
 * Trade vocabulary. The home textile buying process has a narrow, distinctive
 * language, which is what makes keyword scoring work here where it would fail
 * on open-domain mail.
 *
 * Terms are matched on word boundaries, case-insensitively, and each term
 * scores at most once per thread so a repeated word cannot inflate a verdict.
 */

export type LexiconEntry = {
  term: string;
  points: number;
  /** Shown in the explanation of a verdict. */
  note?: string;
};

/** Unambiguous trade terms. Nobody writes "proforma" by accident. */
export const STRONG_TERMS: LexiconEntry[] = [
  { term: "rfq", points: 4, note: "request for quotation" },
  { term: "proforma", points: 4 },
  { term: "pro forma", points: 4 },
  { term: "quotation", points: 3 },
  { term: "moq", points: 4, note: "minimum order quantity" },
  { term: "fob", points: 3, note: "incoterm" },
  { term: "cif", points: 3, note: "incoterm" },
  { term: "exw", points: 3, note: "incoterm" },
  { term: "ddp", points: 3, note: "incoterm" },
  { term: "incoterm", points: 3 },
  { term: "lab dip", points: 4, note: "textile sampling" },
  { term: "strike off", points: 4, note: "textile sampling" },
  { term: "strike-off", points: 4 },
  { term: "gsm", points: 3, note: "fabric weight" },
  { term: "thread count", points: 3 },
  { term: "purchase order", points: 4 },
  { term: "bill of lading", points: 3 },
  { term: "letter of credit", points: 3 },
  { term: "oeko-tex", points: 3, note: "certification" },
  { term: "gots", points: 3, note: "certification" },
  { term: "bci cotton", points: 3 },
];

/** Commercial words that are meaningful in context but common elsewhere. */
export const MEDIUM_TERMS: LexiconEntry[] = [
  { term: "enquiry", points: 2 },
  { term: "inquiry", points: 2 },
  { term: "sample", points: 2 },
  { term: "samples", points: 2 },
  { term: "swatch", points: 3 },
  { term: "price list", points: 2 },
  { term: "pricelist", points: 2 },
  { term: "lead time", points: 2 },
  { term: "catalogue", points: 2 },
  { term: "catalog", points: 2 },
  { term: "lookbook", points: 2 },
  { term: "composition", points: 2 },
  { term: "bed linen", points: 2 },
  { term: "bedding", points: 2 },
  { term: "towel", points: 2 },
  { term: "towels", points: 2 },
  { term: "bathrobe", points: 2 },
  { term: "kitchen textile", points: 2 },
  { term: "home textile", points: 3 },
  { term: "fabric", points: 1 },
  { term: "cotton", points: 1 },
  { term: "shipment", points: 2 },
  { term: "container", points: 1 },
  { term: "order quantity", points: 2 },
  { term: "unit price", points: 2 },
  { term: "delivery time", points: 2 },
  { term: "supplier", points: 1 },
  { term: "manufacturer", points: 1 },
];

/** Cotonex sells into Europe, so buyers often write in their own language. */
export const MULTILINGUAL_TERMS: LexiconEntry[] = [
  // German
  { term: "anfrage", points: 3, note: "enquiry (DE)" },
  { term: "angebot", points: 3, note: "quotation (DE)" },
  { term: "bestellung", points: 3, note: "order (DE)" },
  { term: "muster", points: 3, note: "sample (DE)" },
  { term: "einkauf", points: 2, note: "purchasing (DE)" },
  { term: "lieferzeit", points: 3, note: "lead time (DE)" },
  { term: "heimtextilien", points: 3, note: "home textiles (DE)" },
  // Dutch
  { term: "offerte", points: 3, note: "quotation (NL)" },
  { term: "aanvraag", points: 3, note: "enquiry (NL)" },
  { term: "inkoop", points: 2, note: "purchasing (NL)" },
  { term: "monster", points: 2, note: "sample (NL)" },
  // French
  { term: "devis", points: 3, note: "quotation (FR)" },
  { term: "echantillon", points: 3, note: "sample (FR)" },
  { term: "échantillon", points: 3, note: "sample (FR)" },
  { term: "commande", points: 3, note: "order (FR)" },
  { term: "linge de maison", points: 3, note: "home linen (FR)" },
  // Spanish
  { term: "presupuesto", points: 3, note: "quotation (ES)" },
  { term: "muestra", points: 3, note: "sample (ES)" },
  { term: "pedido", points: 3, note: "order (ES)" },
  { term: "compras", points: 2, note: "purchasing (ES)" },
  // Italian
  { term: "preventivo", points: 3, note: "quotation (IT)" },
  { term: "campione", points: 3, note: "sample (IT)" },
  { term: "ordine", points: 2, note: "order (IT)" },
  { term: "acquisti", points: 2, note: "purchasing (IT)" },
];

/** Wording that marks a thread as something other than buyer correspondence. */
export const NEGATIVE_TERMS: LexiconEntry[] = [
  { term: "unsubscribe", points: -5 },
  { term: "webinar", points: -4 },
  { term: "newsletter", points: -4 },
  { term: "seo services", points: -6 },
  { term: "digital marketing services", points: -6 },
  { term: "guest post", points: -6 },
  { term: "link building", points: -6 },
  { term: "we are a software", points: -5 },
  { term: "lead generation service", points: -6 },
  { term: "job application", points: -5 },
  { term: "curriculum vitae", points: -5 },
  { term: "resume attached", points: -5 },
  { term: "internship", points: -4 },
  { term: "invoice overdue", points: -3 },
  { term: "payment reminder", points: -3 },
  { term: "your subscription", points: -3 },
  { term: "password reset", points: -5 },
  { term: "verify your account", points: -5 },
  { term: "crypto", points: -4 },
  { term: "investment opportunity", points: -5 },
];

export const ALL_TERMS: LexiconEntry[] = [
  ...STRONG_TERMS,
  ...MEDIUM_TERMS,
  ...MULTILINGUAL_TERMS,
  ...NEGATIVE_TERMS,
];

/** Buying-role titles, used on signature blocks and in scoring. */
export const BUYING_TITLES = [
  "purchasing manager",
  "purchase manager",
  "head of purchasing",
  "purchasing director",
  "buying manager",
  "buyer",
  "category buyer",
  "senior buyer",
  "import manager",
  "head of import",
  "sourcing manager",
  "head of sourcing",
  "procurement manager",
  "procurement officer",
  "merchandise manager",
  "merchandiser",
  "supply chain manager",
  // Local-language equivalents
  "einkaufsleiter",
  "einkaufsleiterin",
  "leiter einkauf",
  "inkoopmanager",
  "responsable achats",
  "directeur des achats",
  "jefe de compras",
  "jefa de compras",
  "responsable de compras",
  "direttore acquisti",
  "responsabile acquisti",
  "gerente de importaciones",
];

/** Senders that are never a person. */
export const AUTOMATED_LOCAL_PARTS = [
  "noreply",
  "no-reply",
  "no_reply",
  "donotreply",
  "do-not-reply",
  "mailer-daemon",
  "postmaster",
  "bounce",
  "bounces",
  "notification",
  "notifications",
  "alerts",
  "automated",
  "system",
  "root",
  "cron",
];

/** Bulk senders betray themselves in the DKIM domain or Return-Path. */
export const MARKETING_PLATFORMS = [
  "mailchimp",
  "mcsv.net",
  "sendgrid",
  "sendinblue",
  "brevo",
  "hubspot",
  "klaviyo",
  "mailgun",
  "constantcontact",
  "campaign-archive",
  "getresponse",
  "activecampaign",
  "salesforce",
  "pardot",
  "marketo",
  "sender.net",
  "substack",
  "beehiiv",
];

/** Correspondents who are suppliers or services rather than buyers. */
export const DEFAULT_VENDOR_DOMAINS = [
  "dhl.com",
  "fedex.com",
  "ups.com",
  "maersk.com",
  "msc.com",
  "dbschenker.com",
  "kuehne-nagel.com",
  "linkedin.com",
  "google.com",
  "microsoft.com",
  "apple.com",
  "amazon.com",
  "atlassian.com",
  "slack.com",
  "zoom.us",
  "dropbox.com",
  "adobe.com",
  "intuit.com",
  "stripe.com",
  "paypal.com",
  "indeed.com",
  "naukri.com",
];
