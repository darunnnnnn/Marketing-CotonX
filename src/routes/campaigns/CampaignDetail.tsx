import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { AlertTriangle, ArrowRight, Clock, Send, ShieldCheck } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { repo } from "../../lib/domain/repository";
import { buildPlan, render, SKIP_LABELS, summarise } from "../../lib/campaign/engine";
import type { Plan, SkipReason } from "../../lib/campaign/engine";
import { sendingBlockers } from "../../lib/sending/provider";
import { CAMPAIGN_KIND_LABELS } from "../../lib/domain/types";
import type { Campaign, Company, Contact, Suppression, Template } from "../../lib/domain/types";
import { COUNTRY_BY_CODE, formatInZone } from "../../lib/domain/countries";
import "../../styles/table.css";

export function CampaignDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [suppressions, setSuppressions] = useState<Suppression[]>([]);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    void repo.getCampaign(id).then((value) => setCampaign(value ?? null));
    void repo.listContacts().then(setContacts);
    void repo.listCompanies().then(setCompanies);
    void repo.listTemplates().then(setTemplates);
    void repo.listSuppressions().then(setSuppressions);
  }, [id]);

  const plan: Plan | null = useMemo(() => {
    if (!campaign || companies.length === 0) return null;
    return buildPlan(campaign, contacts, companies, templates, suppressions);
  }, [campaign, contacts, companies, templates, suppressions]);

  const stats = plan ? summarise(plan) : null;
  const blockers = sendingBlockers();

  const submit = async () => {
    if (!campaign) return;
    await repo.saveCampaign({ ...campaign, status: "pending_approval" });
    navigate("/campaigns/approvals");
  };

  /* Only an approved campaign can start, and only once sending is unblocked. */
  const start = async () => {
    if (!campaign || blockers.length > 0) return;
    const updated: Campaign = {
      ...campaign,
      status: "running",
      scheduledFrom: new Date().toISOString(),
    };
    await repo.saveCampaign(updated);
    setCampaign(updated);
  };

  if (!campaign) {
    return (
      <Card flushBody>
        <EmptyState title="Campaign not found" />
      </Card>
    );
  }

  const previewRow = plan?.rows.find((row) => row.contact.id === preview);
  const rendered =
    previewRow?.template && render(previewRow.template, previewRow.contact, previewRow.company);

  return (
    <div className="page">
      <div className="row-between">
        <div>
          <h2 style={{ fontSize: "var(--fs-xl)" }}>{campaign.name}</h2>
          <p className="table__sub">
            {CAMPAIGN_KIND_LABELS[campaign.kind]} · {campaign.channel} ·{" "}
            {campaign.countryCodes.join(", ")}
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--s-2)" }}>
          <Link to={`/campaigns/${campaign.id}/edit`} className="btn btn--secondary">
            Edit
          </Link>
          {campaign.status === "draft" && (
            <Button variant="primary" onClick={() => void submit()}>
              <Send size={16} strokeWidth={2} />
              Submit for approval
            </Button>
          )}
          {campaign.status === "approved" && (
            <Button variant="primary" onClick={() => void start()} disabled={blockers.length > 0}>
              <Send size={16} strokeWidth={2} />
              Start campaign
            </Button>
          )}
        </div>
      </div>

      {blockers.length > 0 && (
        <div className="notice notice--warn">
          <AlertTriangle size={16} strokeWidth={2} />
          <span>
            <strong>Sending is blocked.</strong>
            <ul style={{ margin: "var(--s-2) 0 0", paddingLeft: "1.1em", listStyle: "disc" }}>
              {blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          </span>
        </div>
      )}

      <div className="split">
        <div className="stack">
          <Card title="Sequence" flushBody>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Step</th>
                    <th>Type</th>
                    <th>Template</th>
                    <th>Wait</th>
                    <th className="table__num">Due now</th>
                  </tr>
                </thead>
                <tbody>
                  {[...campaign.steps]
                    .sort((a, b) => a.order - b.order)
                    .map((step) => {
                      const template = templates.find((item) => item.id === step.templateId);
                      return (
                        <tr key={step.id}>
                          <td className="table__primary">{step.order}</td>
                          <td>
                            <Badge tone="violet">{CAMPAIGN_KIND_LABELS[step.kind]}</Badge>
                          </td>
                          <td>
                            <div>{template?.name ?? "—"}</div>
                            <div className="table__sub">{template?.subject}</div>
                          </td>
                          <td>{step.delayDays === 0 ? "immediately" : `${step.delayDays} days`}</td>
                          <td className="table__num">{stats?.byStep.get(step.id) ?? 0}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card
            title="Send plan"
            action={
              <Badge tone={plan?.rows.length ? "green" : "neutral"}>
                {plan?.rows.length ?? 0} would send
              </Badge>
            }
            flushBody
          >
            {!plan || plan.rows.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="Nobody is due right now"
                hint="Either everyone has finished the sequence, is waiting out a delay, or has been handed to the sales team."
              />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Contact</th>
                      <th>Country</th>
                      <th>Status</th>
                      <th>Step</th>
                      <th>Sends at (their time)</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {plan.rows.map((row) => (
                      <tr key={row.contact.id}>
                        <td>
                          <div className="table__primary">{row.contact.name ?? row.contact.email}</div>
                          <div className="table__sub">{row.company.name}</div>
                        </td>
                        <td>
                          <span className="flag__code">{row.company.countryCode}</span>
                        </td>
                        <td>
                          <StatusBadge status={row.contact.status} />
                        </td>
                        <td>
                          <Badge tone="violet">{row.step.order}</Badge>{" "}
                          {CAMPAIGN_KIND_LABELS[row.step.kind]}
                        </td>
                        <td>
                          <div>{formatInZone(row.company.countryCode, row.sendAt)}</div>
                          <div className="table__sub">
                            {COUNTRY_BY_CODE.get(row.company.countryCode)?.timeZone}
                          </div>
                        </td>
                        <td>
                          <div className="table__actions">
                            <Button variant="ghost" onClick={() => setPreview(row.contact.id)}>
                              Preview
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {rendered && previewRow && (
            <Card
              title={`Preview — ${previewRow.contact.email}`}
              action={
                <button className="card__action" onClick={() => setPreview(null)}>
                  Close
                </button>
              }
            >
              <div className="kv">
                <span className="kv__k">Subject</span>
                <span className="kv__v">{rendered.subject}</span>
              </div>
              <pre
                style={{
                  marginTop: "var(--s-4)",
                  whiteSpace: "pre-wrap",
                  fontFamily: "var(--f-sans)",
                  fontSize: "var(--fs-md)",
                  lineHeight: 1.6,
                  color: "var(--c-text-secondary)",
                }}
              >
                {rendered.body}
              </pre>
              {previewRow.template!.attachments.length > 0 && (
                <div style={{ marginTop: "var(--s-4)", display: "flex", gap: "var(--s-2)" }}>
                  {previewRow.template!.attachments.map((file) => (
                    <Badge key={file} tone="blue">
                      {file}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="stack">
          <Card title="Audience">
            <div className="kv">
              <span className="kv__k">Will send</span>
              <span className="kv__v">{stats?.willSend ?? 0}</span>
            </div>
            <div className="kv">
              <span className="kv__k">Countries reached</span>
              <span className="kv__v">{stats?.countries ?? 0}</span>
            </div>
            <div className="kv">
              <span className="kv__k">Excluded</span>
              <span className="kv__v">{stats?.skipped ?? 0}</span>
            </div>
          </Card>

          <Card title="Why contacts were excluded" flushBody>
            <div style={{ padding: "0 var(--s-6) var(--s-5)" }}>
              {Object.entries(plan?.tally ?? {}).length === 0 ? (
                <p className="table__sub" style={{ paddingTop: "var(--s-4)" }}>
                  Nobody was excluded.
                </p>
              ) : (
                Object.entries(plan!.tally)
                  .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
                  .map(([reason, count]) => (
                    <div className="kv" key={reason}>
                      <span className="kv__k">{SKIP_LABELS[reason as SkipReason]}</span>
                      <span className="kv__v">{count}</span>
                    </div>
                  ))
              )}
            </div>
          </Card>

          <Card title="Guardrails">
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
              <p className="notice notice--stop" style={{ padding: "var(--s-3) var(--s-4)" }}>
                <ShieldCheck size={16} strokeWidth={2} />
                <span>
                  Anyone who has replied is removed from this plan automatically and
                  cannot be re-added. A live sales conversation is never interrupted
                  by an automated message.
                </span>
              </p>
              <p className="notice notice--info" style={{ padding: "var(--s-3) var(--s-4)" }}>
                <ArrowRight size={16} strokeWidth={2} />
                <span>
                  Each contact resumes at their own next step, so this campaign can be
                  re-run against the same country without repeating earlier messages.
                </span>
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
