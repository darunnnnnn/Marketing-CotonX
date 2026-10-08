import { useState } from "react";
import { Database, Download, Info, Lock, Search } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { BUYER_PRESET, search, toDomain } from "../../lib/sources/apollo";
import type { ApolloResponse } from "../../lib/sources/apollo";
import { repo } from "../../lib/domain/repository";
import { COUNTRIES } from "../../lib/domain/countries";
import "../../styles/table.css";

export function Apollo() {
  const [countryCode, setCountryCode] = useState("DE");
  const [titles, setTitles] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ApolloResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [imported, setImported] = useState<string[]>([]);

  const run = async (nextPage = 1) => {
    setLoading(true);
    setPage(nextPage);
    const response = await search({
      countryCode,
      preset: BUYER_PRESET,
      titleFilter: titles.length ? titles : undefined,
      page: nextPage,
      perPage: 10,
    });
    setResult(response);
    setLoading(false);
  };

  const toggleTitle = (title: string) =>
    setTitles((current) =>
      current.includes(title) ? current.filter((item) => item !== title) : [...current, title],
    );

  const importHit = async (externalId: string) => {
    const hit = result?.hits.find((item) => item.externalId === externalId);
    if (!hit?.email) return;
    const { company, contact } = toDomain(hit);
    await repo.addCompanies([company]);
    await repo.addContacts([contact]);
    setImported((current) => [...current, externalId]);
  };

  const importAll = async () => {
    const usable = result?.hits.filter((hit) => hit.email && !imported.includes(hit.externalId)) ?? [];
    await repo.addCompanies(usable.map((hit) => toDomain(hit).company));
    await repo.addContacts(usable.map((hit) => toDomain(hit).contact));
    setImported((current) => [...current, ...usable.map((hit) => hit.externalId)]);
  };

  return (
    <div className="page">
      <p className="page__lead">
        New buyer discovery. The targeting rules below are fixed — only the
        country changes — so every search looks for the same kind of person:
        the people who actually place home textile orders.
      </p>

      <Card title="Search">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-3)", alignItems: "center" }}>
          <select
            className="toolbar__select"
            value={countryCode}
            onChange={(event) => setCountryCode(event.target.value)}
          >
            {COUNTRIES.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
          <Button variant="primary" onClick={() => void run(1)} disabled={loading}>
            <Search size={16} strokeWidth={2} />
            {loading ? "Searching…" : "Find buyers"}
          </Button>
        </div>

        <div style={{ marginTop: "var(--s-5)" }}>
          <div className="kv__k" style={{ marginBottom: "var(--s-2)" }}>
            Target roles — none selected means the full preset
          </div>
          <div className="chips">
            {BUYER_PRESET.titles.map((title) => (
              <button
                key={title}
                type="button"
                className={titles.includes(title) ? "chip is-on" : "chip"}
                onClick={() => toggleTitle(title)}
              >
                {title}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: "var(--s-5)" }}>
          <div className="kv__k" style={{ marginBottom: "var(--s-2)" }}>Industries</div>
          <div className="chips">
            {BUYER_PRESET.industries.map((industry) => (
              <Badge key={industry} tone="violet">
                {industry}
              </Badge>
            ))}
          </div>
        </div>
      </Card>

      {result?.sample && (
        <div className="notice notice--info">
          <Info size={16} strokeWidth={2} />
          <span>
            <strong>Sample results.</strong> No Apollo key is configured, so these
            rows are generated locally to exercise the mapping and the import
            path. Add <code>APOLLO_API_KEY</code> to the Edge Function secrets and
            deploy <code>apollo-search</code> to switch to live data — no front-end
            change is needed.
          </span>
        </div>
      )}

      {result && (
        <Card
          title="Results"
          action={
            <div style={{ display: "flex", gap: "var(--s-2)", alignItems: "center" }}>
              <span className="toolbar__count">
                page {result.page} of ~{Math.ceil(result.total / 10)} · {result.total} matches
              </span>
              <Button onClick={() => void importAll()}>
                <Download size={16} strokeWidth={2} />
                Import page
              </Button>
            </div>
          }
          flushBody
        >
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Designation</th>
                  <th>Company</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th className="table__num">Staff</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {result.hits.map((hit) => (
                  <tr key={hit.externalId}>
                    <td className="table__primary">{hit.personName}</td>
                    <td>{hit.title}</td>
                    <td>
                      <div>{hit.companyName}</div>
                      <div className="table__sub">{hit.companyDomain}</div>
                    </td>
                    <td>
                      {hit.email ? (
                        <>
                          <div>{hit.email}</div>
                          <Badge tone={hit.emailStatus === "verified" ? "green" : "amber"}>
                            {hit.emailStatus}
                          </Badge>
                        </>
                      ) : (
                        <span className="flag" style={{ color: "var(--c-text-muted)" }}>
                          <Lock size={14} strokeWidth={2} />
                          locked
                        </span>
                      )}
                    </td>
                    <td>{hit.phone ?? "—"}</td>
                    <td className="table__num">{hit.employeeCount}</td>
                    <td>
                      <div className="table__actions">
                        {imported.includes(hit.externalId) ? (
                          <Badge tone="green">Imported</Badge>
                        ) : (
                          <Button
                            onClick={() => void importHit(hit.externalId)}
                            disabled={!hit.email}
                            title={hit.email ? "Add to the database" : "Email locked — costs a credit to reveal"}
                          >
                            Import
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="row-between" style={{ padding: "var(--s-4) var(--s-5)" }}>
            <span className="toolbar__count">
              {result.creditsUsed} credits would be consumed by this page
            </span>
            <div style={{ display: "flex", gap: "var(--s-2)" }}>
              <Button onClick={() => void run(Math.max(1, page - 1))} disabled={page === 1 || loading}>
                Previous
              </Button>
              <Button onClick={() => void run(page + 1)} disabled={loading}>
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}

      {!result && (
        <Card flushBody>
          <EmptyState
            icon={Database}
            title="Pick a country and search"
            hint="Imported people land unverified in the review queue — Apollo's own verification only means the address resolves, not that the person is the right target."
          />
        </Card>
      )}
    </div>
  );
}
