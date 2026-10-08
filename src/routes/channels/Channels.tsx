import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Phone, ShieldAlert } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { repo } from "../../lib/domain/repository";
import { HUMAN_OWNED } from "../../lib/domain/types";
import type { Company, Contact } from "../../lib/domain/types";
import "../../styles/table.css";

/** Legal position per market for outbound AI calling. */
const CALL_RULES: Record<string, { tone: "rose" | "amber" | "green"; note: string }> = {
  DE: { tone: "rose", note: "Cold B2B calls need prior consent (UWG 7). Recording needs all-party consent (StGB 201)." },
  FR: { tone: "amber", note: "Bloctel screening required for cold calls; B2B exemptions are narrow." },
  NL: { tone: "amber", note: "B2B calling permitted with an opt-out register check." },
  IT: { tone: "amber", note: "Registro delle Opposizioni check required." },
  ES: { tone: "amber", note: "Consent expected for commercial calls." },
  GB: { tone: "amber", note: "CTPS screening required for cold B2B calls." },
  US: { tone: "amber", note: "State recording laws vary; several require all-party consent." },
  MX: { tone: "green", note: "Fewer restrictions on B2B calling." },
  SE: { tone: "amber", note: "NIX-Telefon screening expected." },
  BE: { tone: "amber", note: "Do-not-call list check required." },
};

export function Channels() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  useEffect(() => {
    void repo.listContacts().then(setContacts);
    void repo.listCompanies().then(setCompanies);
  }, []);

  const companyById = useMemo(() => new Map(companies.map((item) => [item.id, item])), [companies]);

  /* Warm contacts only: a relationship already exists and consent is recorded. */
  const callable = contacts.filter(
    (contact) => contact.phone && contact.callConsent && HUMAN_OWNED.includes(contact.status),
  );
  const whatsappReady = contacts.filter((contact) => contact.phone && !contact.doNotContact);

  return (
    <div className="page">
      <p className="page__lead">
        WhatsApp, SMS and voice run on the same buyer database and the same
        sequence engine as email — a campaign step carries a channel, so adding
        one does not fork the system.
      </p>

      <div className="split">
        <div className="stack">
          <Card
            title="Voice — eligible contacts"
            action={<Badge tone={callable.length ? "green" : "neutral"}>{callable.length}</Badge>}
            flushBody
          >
            {callable.length === 0 ? (
              <EmptyState
                icon={Phone}
                title="Nobody is eligible for a call"
                hint="Eligibility requires a phone number, recorded consent, and an existing conversation."
              />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Buyer</th>
                      <th>Phone</th>
                      <th>Language</th>
                      <th>Country</th>
                      <th>Legal position</th>
                    </tr>
                  </thead>
                  <tbody>
                    {callable.map((contact) => {
                      const company = companyById.get(contact.companyId);
                      const rule = CALL_RULES[company?.countryCode ?? ""];
                      return (
                        <tr key={contact.id}>
                          <td>
                            <div className="table__primary">{contact.name}</div>
                            <div className="table__sub">{company?.name}</div>
                          </td>
                          <td>{contact.phone}</td>
                          <td>
                            <Badge tone="violet">{contact.preferredLanguage.toUpperCase()}</Badge>
                          </td>
                          <td>
                            <span className="flag__code">{company?.countryCode}</span>
                          </td>
                          <td>
                            {rule ? (
                              <>
                                <Badge tone={rule.tone}>
                                  {rule.tone === "rose" ? "Restricted" : rule.tone === "amber" ? "Conditional" : "Permitted"}
                                </Badge>
                                <div className="table__sub">{rule.note}</div>
                              </>
                            ) : (
                              <Badge tone="neutral">Unreviewed</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card
            title="WhatsApp — reachable contacts"
            action={<Badge tone="neutral">{whatsappReady.length}</Badge>}
            flushBody
          >
            {whatsappReady.length === 0 ? (
              <EmptyState icon={MessageCircle} title="No phone numbers on file" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <tbody>
                    {whatsappReady.map((contact) => (
                      <tr key={contact.id}>
                        <td>
                          <div className="table__primary">{contact.name ?? contact.email}</div>
                          <div className="table__sub">{companyById.get(contact.companyId)?.name}</div>
                        </td>
                        <td>{contact.phone}</td>
                        <td>
                          <Badge tone="neutral">{contact.preferredLanguage.toUpperCase()}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="stack">
          <Card title="Voice architecture">
            <div className="kv">
              <span className="kv__k">Telephony</span>
              <span className="kv__v">Twilio / Telnyx</span>
            </div>
            <div className="kv">
              <span className="kv__k">Speech in</span>
              <span className="kv__v">Deepgram (streaming)</span>
            </div>
            <div className="kv">
              <span className="kv__k">Reasoning</span>
              <span className="kv__v">Claude Opus 4.5</span>
            </div>
            <div className="kv">
              <span className="kv__k">Speech out</span>
              <span className="kv__v">ElevenLabs</span>
            </div>
            <div className="kv">
              <span className="kv__k">Latency target</span>
              <span className="kv__v">under 800 ms</span>
            </div>
            <p style={{ marginTop: "var(--s-4)", fontSize: "var(--fs-sm)", color: "var(--c-text-secondary)", lineHeight: 1.6 }}>
              The orchestrator is a persistent Node service, not an Edge
              Function — a call is a multi-minute bidirectional audio stream and
              request-scoped workers cannot hold one.
            </p>
          </Card>

          <Card title="Rules the agent must follow">
            <div className="notice notice--stop" style={{ marginBottom: "var(--s-3)" }}>
              <ShieldAlert size={16} strokeWidth={2} />
              <span>
                The agent discloses that it is an AI at the start of every call.
                Required under the EU AI Act, and it is the honest thing to do.
              </span>
            </div>
            <ul style={{ listStyle: "disc", paddingLeft: "1.1em", fontSize: "var(--fs-sm)", color: "var(--c-text-secondary)", lineHeight: 1.7 }}>
              <li>Warm contacts only — never cold dialling.</li>
              <li>Speaks the buyer&rsquo;s language, taken from their record.</li>
              <li>Hands to a person on request, on confusion, or on any pricing commitment.</li>
              <li>Calls only inside the country&rsquo;s working hours.</li>
              <li>No recording where all-party consent has not been given.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
