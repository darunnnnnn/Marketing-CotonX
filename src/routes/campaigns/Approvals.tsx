import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { repo } from "../../lib/domain/repository";
import { buildPlan, summarise } from "../../lib/campaign/engine";
import { CAMPAIGN_KIND_LABELS } from "../../lib/domain/types";
import type { Campaign, Company, Contact, Suppression, Template } from "../../lib/domain/types";
import "../../styles/table.css";

/** Stands in for the signed-in user until auth lands. */
const APPROVER = "marketing@cotonex.test";

export function Approvals() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [suppressions, setSuppressions] = useState<Suppression[]>([]);

  const load = () => {
    void repo.listCampaigns().then(setCampaigns);
    void repo.listContacts().then(setContacts);
    void repo.listCompanies().then(setCompanies);
    void repo.listTemplates().then(setTemplates);
    void repo.listSuppressions().then(setSuppressions);
  };

  useEffect(load, []);

  const pending = useMemo(
    () => campaigns.filter((campaign) => campaign.status === "pending_approval"),
    [campaigns],
  );

  const decide = async (campaign: Campaign, approve: boolean) => {
    await repo.saveCampaign({
      ...campaign,
      status: approve ? "approved" : "draft",
      approvedBy: approve ? APPROVER : undefined,
      approvedAt: approve ? new Date().toISOString() : undefined,
    });
    load();
  };

  return (
    <div className="page">
      <p className="page__lead">
        Nothing sends without a person approving it. The approver sees the exact
        audience, the exact content, and the exclusions before deciding.
      </p>

      {pending.length === 0 ? (
        <Card flushBody>
          <EmptyState icon={ShieldCheck} title="Nothing awaiting approval" hint="Campaigns submitted for review appear here." />
        </Card>
      ) : (
        pending.map((campaign) => {
          const plan = companies.length
            ? buildPlan(campaign, contacts, companies, templates, suppressions)
            : null;
          const stats = plan ? summarise(plan) : null;

          return (
            <Card
              key={campaign.id}
              title={<Link to={`/campaigns/${campaign.id}`}>{campaign.name}</Link>}
              action={<Badge tone="amber">Pending approval</Badge>}
            >
              <div className="split">
                <div>
                  <div className="kv">
                    <span className="kv__k">Type</span>
                    <span className="kv__v">{CAMPAIGN_KIND_LABELS[campaign.kind]}</span>
                  </div>
                  <div className="kv">
                    <span className="kv__k">Countries</span>
                    <span className="kv__v">{campaign.countryCodes.join(", ")}</span>
                  </div>
                  <div className="kv">
                    <span className="kv__k">Steps</span>
                    <span className="kv__v">{campaign.steps.length}</span>
                  </div>
                  <div className="kv">
                    <span className="kv__k">Recipients in this run</span>
                    <span className="kv__v">{stats?.willSend ?? 0}</span>
                  </div>
                  <div className="kv">
                    <span className="kv__k">Excluded</span>
                    <span className="kv__v">{stats?.skipped ?? 0}</span>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
                  <Button variant="primary" onClick={() => void decide(campaign, true)}>
                    <CheckCircle2 size={16} strokeWidth={2} />
                    Approve
                  </Button>
                  <Button onClick={() => void decide(campaign, false)}>
                    <XCircle size={16} strokeWidth={2} />
                    Send back to draft
                  </Button>
                  <Link to={`/campaigns/${campaign.id}`} className="btn btn--ghost">
                    Review the full plan
                  </Link>
                </div>
              </div>
            </Card>
          );
        })
      )}

      <Card title="Recently decided" flushBody>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Status</th>
                <th>Approved by</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {campaigns
                .filter((campaign) => campaign.approvedAt)
                .sort((a, b) => (b.approvedAt ?? "").localeCompare(a.approvedAt ?? ""))
                .map((campaign) => (
                  <tr key={campaign.id}>
                    <td>
                      <Link to={`/campaigns/${campaign.id}`} className="table__primary">
                        {campaign.name}
                      </Link>
                    </td>
                    <td>
                      <Badge tone="green">{campaign.status}</Badge>
                    </td>
                    <td>{campaign.approvedBy}</td>
                    <td className="table__sub">
                      {new Date(campaign.approvedAt!).toLocaleString("en-GB")}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
