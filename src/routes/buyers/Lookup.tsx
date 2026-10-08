import { useState } from "react";
import type { FormEvent } from "react";
import { AlertTriangle, Search } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { lookupByEmail } from "../../lib/enrichment";
import { SOURCES, SOURCE_LABELS } from "../../lib/enrichment/sources";
import type { BuyerField, Confidence, LookupResult } from "../../lib/enrichment/types";
import "./lookup.css";

const FIELD_LABELS: Record<BuyerField, string> = {
  companyName: "Company",
  domain: "Domain",
  website: "Website",
  country: "Country",
  countryCode: "Country code",
  contactName: "Contact",
  designation: "Designation",
  roleCategory: "Role",
  emailType: "Address type",
  phone: "Phone",
  linkedin: "LinkedIn",
  employeeCount: "Employees",
  industry: "Industry",
};

const FIELD_ORDER: BuyerField[] = [
  "companyName",
  "domain",
  "website",
  "country",
  "contactName",
  "designation",
  "roleCategory",
  "emailType",
  "phone",
  "industry",
  "employeeCount",
  "linkedin",
];

const CONFIDENCE_TONE: Record<Confidence, "green" | "blue" | "amber" | "rose"> = {
  verified: "green",
  high: "blue",
  medium: "amber",
  low: "rose",
};

const SAMPLES = [
  "einkauf@heimtextil-weber.de",
  "j.vandenberg@dutchhometextiles.nl",
  "info@casabella.it",
  "maria.lopez@gmail.com",
];

export function Lookup() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);

  const run = (email: string) => {
    setQuery(email);
    setResult(lookupByEmail(email));
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    run(query);
  };

  const known = result?.valid
    ? FIELD_ORDER.filter((field) => result.record[field]).map((field) => ({ field, fact: result.record[field]! }))
    : [];
  const missing = result?.valid ? FIELD_ORDER.filter((field) => !result.record[field]) : [];

  return (
    <div className="lookup">
      <form className="lookup__form" onSubmit={onSubmit}>
        <input
          className="lookup__input"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="buyer@company.de"
          aria-label="Buyer email address"
          spellCheck={false}
          autoComplete="off"
        />
        <Button type="submit" variant="primary">
          <Search size={16} strokeWidth={2} aria-hidden />
          Look up
        </Button>
      </form>

      <div className="lookup__samples">
        <span>Try:</span>
        {SAMPLES.map((sample) => (
          <button key={sample} type="button" className="lookup__sample" onClick={() => run(sample)}>
            {sample}
          </button>
        ))}
      </div>

      {result && !result.valid && <p className="lookup__error">{result.problem}</p>}

      {result?.valid && (
        <div className="lookup__grid">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
            <Card
              title="What we know"
              action={<Badge tone="violet">{known.length} of {FIELD_ORDER.length} fields</Badge>}
              flushBody
            >
              <table className="fact-table">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Value</th>
                    <th>Source</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {known.map(({ field, fact }) => (
                    <tr key={field}>
                      <td className="fact-table__field">{FIELD_LABELS[field]}</td>
                      <td>
                        <div className="fact-table__value">{fact.value}</div>
                        {fact.note && <div className="fact-table__note">{fact.note}</div>}
                      </td>
                      <td className="fact-table__field">{SOURCE_LABELS[fact.source]}</td>
                      <td>
                        <Badge tone={CONFIDENCE_TONE[fact.confidence]} upper>
                          {fact.confidence}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {missing.length > 0 && (
              <Card title="Still unknown" action={<Badge tone="rose">{missing.length}</Badge>}>
                <p style={{ color: "var(--c-text-secondary)", marginBottom: "var(--s-3)" }}>
                  These fields cannot be derived from an email address. They come from the
                  sources on the right once those are connected.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-2)" }}>
                  {missing.map((field) => (
                    <Badge key={field} tone="neutral">
                      {FIELD_LABELS[field]}
                    </Badge>
                  ))}
                </div>
              </Card>
            )}

            {result.warnings.length > 0 && (
              <Card title="Reviewer notes">
                <div className="warn-list">
                  {result.warnings.map((warning) => (
                    <p key={warning} className="warn">
                      <AlertTriangle size={16} strokeWidth={2} aria-hidden />
                      <span>{warning}</span>
                    </p>
                  ))}
                </div>
              </Card>
            )}
          </div>

          <Card title="Sources" flushBody>
            <div className="source-list">
              {SOURCES.map((source) => (
                <div key={source.id} className={`source source--${source.status}`}>
                  <span className="source__dot" aria-hidden />
                  <div>
                    <div className="source__head">
                      <span className="source__label">{source.label}</span>
                      {source.status === "ready" ? (
                        <Badge tone="green" upper>live</Badge>
                      ) : (
                        <Badge tone="neutral" upper>{source.phase}</Badge>
                      )}
                    </div>
                    <div className="source__provides">{source.provides}</div>
                    {source.blockedBy && <div className="source__blocked">{source.blockedBy}</div>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {!result && (
        <Card flushBody>
          <EmptyState
            icon={Search}
            title="Enter a buyer email address"
            hint="You will see every fact we can establish, where each one came from, and how confident we are in it."
          />
        </Card>
      )}
    </div>
  );
}
