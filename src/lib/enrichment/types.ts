/** How much weight a fact carries. Drives merge order and the review queue. */
export type Confidence = "verified" | "high" | "medium" | "low";

export type SourceId =
  | "email"
  | "dns"
  | "gmail"
  | "apollo"
  | "website"
  | "linkedin"
  | "manual";

/** Every fact in the database carries its origin — requirement §9. */
export type Fact<T = string> = {
  value: T;
  source: SourceId;
  confidence: Confidence;
  note?: string;
};

export type BuyerRecord = {
  companyName?: Fact;
  domain?: Fact;
  website?: Fact;
  country?: Fact;
  countryCode?: Fact;
  contactName?: Fact;
  designation?: Fact;
  roleCategory?: Fact;
  emailType?: Fact;
  phone?: Fact;
  linkedin?: Fact;
  employeeCount?: Fact;
  industry?: Fact;
};

export type BuyerField = keyof BuyerRecord;

export type SourceStatus = "ready" | "needs-config" | "planned";

export type SourceDescriptor = {
  id: SourceId;
  label: string;
  status: SourceStatus;
  phase: string;
  /** What this source contributes that no other source can. */
  provides: string;
  blockedBy?: string;
};

export type LookupResult = {
  email: string;
  valid: boolean;
  problem?: string;
  record: BuyerRecord;
  /** Flags for the human reviewer, not errors. */
  warnings: string[];
};
