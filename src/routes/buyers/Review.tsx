import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, GitMerge } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { repo } from "../../lib/domain/repository";
import type { Company, Contact, MergeCandidate } from "../../lib/domain/types";
import "../../styles/table.css";

export function Review() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [merges, setMerges] = useState<MergeCandidate[]>([]);

  const load = () => {
    void repo.listContacts().then(setContacts);
    void repo.listCompanies().then(setCompanies);
    void repo.listMergeCandidates().then(setMerges);
  };

  useEffect(load, []);

  const byId = useMemo(() => new Map(contacts.map((contact) => [contact.id, contact])), [contacts]);
  const companyById = useMemo(() => new Map(companies.map((item) => [item.id, item])), [companies]);

  const unverified = contacts.filter((contact) => !contact.verified);
  const sharedInboxes = contacts.filter((contact) => contact.rolePriority === "low" && contact.verified);
  const missingName = contacts.filter((contact) => contact.verified && !contact.name);

  const verify = async (id: string) => {
    await repo.updateContact(id, { verified: true });
    load();
  };

  const merge = async (candidateId: string, keepId: string) => {
    await repo.resolveMerge(candidateId, keepId);
    load();
  };

  return (
    <div className="page">
      <p className="page__lead">
        The quality gate. Nothing reaches a campaign until a person has looked at
        it — the goal is a clean database, not a large one.
      </p>

      <Card
        title="Possible duplicates"
        action={<Badge tone={merges.length ? "amber" : "green"}>{merges.length}</Badge>}
        flushBody
      >
        {merges.length === 0 ? (
          <EmptyState icon={GitMerge} title="No duplicates detected" hint="Candidates appear when two records look like the same person." />
        ) : (
          <div style={{ padding: "0 var(--s-6) var(--s-6)" }}>
            {merges.map((candidate) => {
              const [a, b] = candidate.contactIds.map((id) => byId.get(id));
              if (!a || !b) return null;
              return (
                <div key={candidate.id} style={{ paddingTop: "var(--s-4)" }}>
                  <div className="notice notice--warn" style={{ marginBottom: "var(--s-3)" }}>
                    <AlertTriangle size={16} strokeWidth={2} />
                    <span>
                      {candidate.reason} Match confidence {(candidate.score * 100).toFixed(0)}%.
                    </span>
                  </div>
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Record</th>
                          <th>Email</th>
                          <th>Designation</th>
                          <th>Sources</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {[a, b].map((contact) => (
                          <tr key={contact.id}>
                            <td>
                              <div className="table__primary">{contact.name ?? contact.email}</div>
                              <div className="table__sub">{companyById.get(contact.companyId)?.name}</div>
                            </td>
                            <td>{contact.email}</td>
                            <td>{contact.designation ?? "—"}</td>
                            <td>
                              <div style={{ display: "flex", gap: 4 }}>
                                {contact.sources.map((source) => (
                                  <Badge key={source} tone="neutral">
                                    {source}
                                  </Badge>
                                ))}
                              </div>
                            </td>
                            <td>
                              <div className="table__actions">
                                <Button variant="primary" onClick={() => void merge(candidate.id, contact.id)}>
                                  Keep this one
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card
        title="Awaiting verification"
        action={<Badge tone={unverified.length ? "amber" : "green"}>{unverified.length}</Badge>}
        flushBody
      >
        {unverified.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Everything is verified" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Company</th>
                  <th>Country</th>
                  <th>Designation</th>
                  <th>Came from</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {unverified.map((contact) => {
                  const company = companyById.get(contact.companyId);
                  return (
                    <tr key={contact.id}>
                      <td>
                        <div className="table__primary">{contact.name ?? "Shared inbox"}</div>
                        <div className="table__sub">{contact.email}</div>
                      </td>
                      <td>{company?.name}</td>
                      <td>
                        <span className="flag__code">{company?.countryCode}</span>
                      </td>
                      <td>{contact.designation ?? "—"}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          {contact.sources.map((source) => (
                            <Badge key={source} tone="neutral">
                              {source}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div className="table__actions">
                          <Button variant="primary" onClick={() => void verify(contact.id)}>
                            <CheckCircle2 size={16} strokeWidth={2} />
                            Verify
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="split">
        <Card title="Shared inboxes" action={<Badge tone="neutral">{sharedInboxes.length}</Badge>} flushBody>
          {sharedInboxes.length === 0 ? (
            <EmptyState title="None" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  {sharedInboxes.map((contact) => (
                    <tr key={contact.id}>
                      <td>
                        <div className="table__primary">{contact.email}</div>
                        <div className="table__sub">{companyById.get(contact.companyId)?.name}</div>
                      </td>
                      <td>
                        <Badge tone="amber">{contact.roleCategory}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Why this matters">
          <p style={{ color: "var(--c-text-secondary)", fontSize: "var(--fs-sm)", lineHeight: 1.6 }}>
            Campaigns to <strong>info@</strong> addresses convert far worse than
            campaigns to a named buyer, and they burn sending reputation at the
            same rate. {sharedInboxes.length} shared inboxes and {missingName.length}{" "}
            verified records without a person&rsquo;s name are worth enriching
            through Apollo before any of them is campaigned to.
          </p>
        </Card>
      </div>
    </div>
  );
}
