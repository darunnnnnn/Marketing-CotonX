import { useEffect, useMemo, useState } from "react";
import { Building2, ExternalLink } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { repo } from "../../lib/domain/repository";
import type { Company, Contact } from "../../lib/domain/types";
import "../../styles/table.css";

export function Companies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");

  useEffect(() => {
    void repo.listCompanies().then(setCompanies);
    void repo.listContacts().then(setContacts);
  }, []);

  const contactCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const contact of contacts) {
      counts.set(contact.companyId, (counts.get(contact.companyId) ?? 0) + 1);
    }
    return counts;
  }, [contacts]);

  const countries = useMemo(
    () => [...new Set(companies.map((company) => company.countryCode))].sort(),
    [companies],
  );

  const rows = companies.filter((company) => {
    if (country && company.countryCode !== country) return false;
    if (!search) return true;
    const needle = search.toLowerCase();
    return [company.name, company.domain, company.city, company.industry]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });

  return (
    <div className="page">
      <p className="page__lead">
        Companies are the parent record — contacts hang off them, and country
        segmentation works at this level.
      </p>

      <div className="toolbar">
        <input
          className="toolbar__search"
          placeholder="Search company, domain, city or industry"
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
        <span className="toolbar__count">
          {rows.length} of {companies.length}
        </span>
      </div>

      <Card flushBody>
        {rows.length === 0 ? (
          <EmptyState icon={Building2} title="No companies match these filters" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Country</th>
                  <th>Industry</th>
                  <th className="table__num">Staff</th>
                  <th className="table__num">Contacts</th>
                  <th>Sources</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((company) => (
                  <tr key={company.id}>
                    <td>
                      <div className="table__primary">{company.name}</div>
                      <div className="table__sub">
                        {company.website ? (
                          <a
                            href={company.website}
                            target="_blank"
                            rel="noreferrer noopener"
                            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                          >
                            {company.domain}
                            <ExternalLink size={12} strokeWidth={2} />
                          </a>
                        ) : (
                          company.domain
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="flag">
                        <span className="flag__code">{company.countryCode}</span>
                        {company.city ?? company.country}
                      </span>
                    </td>
                    <td>{company.industry ?? "—"}</td>
                    <td className="table__num">{company.employeeCount ?? "—"}</td>
                    <td className="table__num">{contactCount.get(company.id) ?? 0}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {company.sources.map((source) => (
                          <Badge key={source} tone="neutral">
                            {source}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td>
                      {company.verified ? (
                        <Badge tone="green">Verified</Badge>
                      ) : (
                        <Badge tone="amber">Needs review</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
