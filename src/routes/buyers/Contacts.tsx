import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ShieldOff, Users } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { repo } from "../../lib/domain/repository";
import { STATUS_LABELS } from "../../lib/domain/types";
import type { Company, Contact, ContactStatus } from "../../lib/domain/types";
import "../../styles/table.css";

const STATUSES = Object.keys(STATUS_LABELS) as ContactStatus[];

export function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [status, setStatus] = useState<ContactStatus | "">("");
  const [highOnly, setHighOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const load = () => {
    void repo.listContacts().then(setContacts);
    void repo.listCompanies().then(setCompanies);
  };

  useEffect(load, []);

  const companyById = useMemo(() => new Map(companies.map((item) => [item.id, item])), [companies]);
  const countries = useMemo(
    () => [...new Set(companies.map((item) => item.countryCode))].sort(),
    [companies],
  );

  const rows = useMemo(
    () =>
      contacts.filter((contact) => {
        const company = companyById.get(contact.companyId);
        if (country && company?.countryCode !== country) return false;
        if (status && contact.status !== status) return false;
        if (highOnly && contact.rolePriority !== "high") return false;
        if (verifiedOnly && !contact.verified) return false;
        if (search) {
          const needle = search.toLowerCase();
          const hay = [contact.name, contact.email, contact.designation, company?.name]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      }),
    [contacts, companyById, country, status, highOnly, verifiedOnly, search],
  );

  const toggleVerified = async (contact: Contact) => {
    await repo.updateContact(contact.id, { verified: !contact.verified });
    load();
  };

  const toggleDnc = async (contact: Contact) => {
    await repo.updateContact(contact.id, { doNotContact: !contact.doNotContact });
    load();
  };

  return (
    <div className="page">
      <p className="page__lead">
        Every person in the database, from every source. Verification is a human
        decision — an unverified contact is never included in a campaign.
      </p>

      <div className="toolbar">
        <input
          className="toolbar__search"
          placeholder="Search name, email, company or designation"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select className="toolbar__select" value={country} onChange={(event) => setCountry(event.target.value)}>
          <option value="">All countries</option>
          {countries.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
        <select
          className="toolbar__select"
          value={status}
          onChange={(event) => setStatus(event.target.value as ContactStatus | "")}
        >
          <option value="">All statuses</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={highOnly ? "chip is-on" : "chip"}
          onClick={() => setHighOnly((value) => !value)}
        >
          Buying roles only
        </button>
        <button
          type="button"
          className={verifiedOnly ? "chip is-on" : "chip"}
          onClick={() => setVerifiedOnly((value) => !value)}
        >
          Verified only
        </button>
        <span className="toolbar__count">
          {rows.length} of {contacts.length}
        </span>
      </div>

      <Card flushBody>
        {rows.length === 0 ? (
          <EmptyState icon={Users} title="No contacts match these filters" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Company</th>
                  <th>Country</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Sources</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((contact) => {
                  const company = companyById.get(contact.companyId);
                  return (
                    <tr key={contact.id}>
                      <td>
                        <div className="table__primary">
                          {contact.name ?? <span style={{ color: "var(--c-text-muted)" }}>Shared inbox</span>}
                        </div>
                        <div className="table__sub">{contact.email}</div>
                      </td>
                      <td>
                        <div className="table__primary">{company?.name}</div>
                        <div className="table__sub">{company?.domain}</div>
                      </td>
                      <td>
                        <span className="flag">
                          <span className="flag__code">{company?.countryCode}</span>
                        </span>
                      </td>
                      <td>
                        <div>{contact.designation ?? contact.roleCategory ?? "—"}</div>
                        {contact.rolePriority === "high" && (
                          <div className="table__sub" style={{ color: "var(--c-green-ink)" }}>
                            buying role
                          </div>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={contact.status} />
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {contact.sources.map((source) => (
                            <Badge key={source} tone="neutral">
                              {source}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div className="table__actions">
                          <Button
                            variant={contact.verified ? "ghost" : "secondary"}
                            onClick={() => void toggleVerified(contact)}
                            title={contact.verified ? "Mark unverified" : "Mark verified"}
                          >
                            <CheckCircle2
                              size={16}
                              strokeWidth={2}
                              color={contact.verified ? "var(--c-green-ink)" : undefined}
                            />
                            {contact.verified ? "Verified" : "Verify"}
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => void toggleDnc(contact)}
                            title={contact.doNotContact ? "Allow contact" : "Mark do-not-contact"}
                          >
                            <ShieldOff
                              size={16}
                              strokeWidth={2}
                              color={contact.doNotContact ? "var(--c-danger)" : undefined}
                            />
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
    </div>
  );
}
