import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { AlertTriangle, ArrowDown, ArrowUp, Plus, Save, Send, Trash2 } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { repo } from "../../lib/domain/repository";
import { buildPlan, summarise } from "../../lib/campaign/engine";
import { COUNTRIES } from "../../lib/domain/countries";
import {
  CAMPAIGN_KIND_LABELS,
  STATUS_LABELS,
} from "../../lib/domain/types";
import type {
  Campaign,
  CampaignKind,
  Channel,
  Company,
  Contact,
  ContactStatus,
  SequenceStep,
  Suppression,
  Template,
} from "../../lib/domain/types";
import "../../styles/table.css";

const KINDS = Object.keys(CAMPAIGN_KIND_LABELS) as CampaignKind[];
const STATUSES = Object.keys(STATUS_LABELS) as ContactStatus[];
const CHANNELS: Channel[] = ["email", "whatsapp", "sms", "voice"];

/** Statuses a human owns — offering them as campaign entry would break the rule. */
const UNSELECTABLE: ContactStatus[] = ["buyer_replied", "enquiry_received", "active_lead"];

let stepCounter = 0;
const newStepId = () => `step-${Date.now().toString(36)}-${(stepCounter += 1)}`;

function blank(): Campaign {
  return {
    id: `camp-${Date.now().toString(36)}`,
    name: "",
    kind: "introduction",
    channel: "email",
    status: "draft",
    countryCodes: [],
    targetStatuses: ["never_contacted"],
    steps: [],
    createdAt: new Date().toISOString(),
  };
}

export function CampaignEditor() {
  const { id } = useParams();
  const navigate = useNavigate();

  /* A new campaign needs no fetch, so seed it synchronously; only an
     existing one is loaded in an effect. */
  const [draft, setDraft] = useState<Campaign | null>(() => (id ? null : blank()));
  const [templates, setTemplates] = useState<Template[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [suppressions, setSuppressions] = useState<Suppression[]>([]);

  useEffect(() => {
    void repo.listTemplates().then(setTemplates);
    void repo.listContacts().then(setContacts);
    void repo.listCompanies().then(setCompanies);
    void repo.listSuppressions().then(setSuppressions);

    if (id) void repo.getCampaign(id).then((found) => setDraft(found ?? blank()));
  }, [id]);

  const patch = (changes: Partial<Campaign>) =>
    setDraft((current) => (current ? { ...current, ...changes } : current));

  const problems = useMemo(() => {
    if (!draft) return [];
    const list: string[] = [];
    if (!draft.name.trim()) list.push("Give the campaign a name.");
    if (draft.countryCodes.length === 0) list.push("Pick at least one country.");
    if (draft.targetStatuses.length === 0) list.push("Pick at least one entry status.");
    if (draft.steps.length === 0) list.push("Add at least one step.");
    if (draft.steps.some((step) => !step.templateId)) list.push("Every step needs a template.");
    const firstStep = [...draft.steps].sort((a, b) => a.order - b.order)[0];
    if (firstStep && firstStep.delayDays !== 0) {
      list.push("The first step should send immediately — set its wait to 0 days.");
    }
    return list;
  }, [draft]);

  /* Live audience count, so the size of the send is visible while editing. */
  const preview = useMemo(() => {
    if (!draft || companies.length === 0 || draft.steps.length === 0) return null;
    return summarise(buildPlan(draft, contacts, companies, templates, suppressions));
  }, [draft, contacts, companies, templates, suppressions]);

  if (!draft) return null;

  const usableTemplates = templates.filter((template) => template.channel === draft.channel);

  const addStep = () => {
    const order = draft.steps.length + 1;
    const step: SequenceStep = {
      id: newStepId(),
      order,
      channel: draft.channel,
      kind: order === 1 ? draft.kind : "follow_up",
      templateId: usableTemplates[0]?.id ?? "",
      delayDays: order === 1 ? 0 : 7,
    };
    patch({ steps: [...draft.steps, step] });
  };

  const updateStep = (stepId: string, changes: Partial<SequenceStep>) =>
    patch({
      steps: draft.steps.map((step) => (step.id === stepId ? { ...step, ...changes } : step)),
    });

  const removeStep = (stepId: string) =>
    patch({
      steps: draft.steps
        .filter((step) => step.id !== stepId)
        .map((step, index) => ({ ...step, order: index + 1 })),
    });

  const moveStep = (stepId: string, direction: -1 | 1) => {
    const ordered = [...draft.steps].sort((a, b) => a.order - b.order);
    const index = ordered.findIndex((step) => step.id === stepId);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    patch({ steps: ordered.map((step, position) => ({ ...step, order: position + 1 })) });
  };

  const toggleCountry = (code: string) =>
    patch({
      countryCodes: draft.countryCodes.includes(code)
        ? draft.countryCodes.filter((item) => item !== code)
        : [...draft.countryCodes, code],
    });

  const toggleStatus = (status: ContactStatus) =>
    patch({
      targetStatuses: draft.targetStatuses.includes(status)
        ? draft.targetStatuses.filter((item) => item !== status)
        : [...draft.targetStatuses, status],
    });

  const save = async (status: Campaign["status"]) => {
    await repo.saveCampaign({ ...draft, status });
    navigate(status === "pending_approval" ? "/campaigns/approvals" : `/campaigns/${draft.id}`);
  };

  return (
    <div className="page">
      <div className="row-between">
        <h2 style={{ fontSize: "var(--fs-xl)" }}>{id ? "Edit campaign" : "New campaign"}</h2>
        <div style={{ display: "flex", gap: "var(--s-2)" }}>
          <Button onClick={() => void save("draft")} disabled={!draft.name.trim()}>
            <Save size={16} strokeWidth={2} />
            Save draft
          </Button>
          <Button variant="primary" onClick={() => void save("pending_approval")} disabled={problems.length > 0}>
            <Send size={16} strokeWidth={2} />
            Submit for approval
          </Button>
        </div>
      </div>

      {problems.length > 0 && (
        <div className="notice notice--warn">
          <AlertTriangle size={16} strokeWidth={2} />
          <span>
            <strong>Before this can be submitted:</strong>
            <ul style={{ margin: "var(--s-2) 0 0", paddingLeft: "1.1em", listStyle: "disc" }}>
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </span>
        </div>
      )}

      <div className="split">
        <div className="stack">
          <Card title="Basics">
            <label style={{ display: "block", marginBottom: "var(--s-4)" }}>
              <div className="kv__k" style={{ marginBottom: "var(--s-2)" }}>Name</div>
              <input
                className="toolbar__search"
                style={{ width: "100%" }}
                value={draft.name}
                placeholder="Germany — Spring collection"
                onChange={(event) => patch({ name: event.target.value })}
              />
            </label>

            <div style={{ display: "flex", gap: "var(--s-4)", flexWrap: "wrap" }}>
              <label>
                <div className="kv__k" style={{ marginBottom: "var(--s-2)" }}>Type</div>
                <select
                  className="toolbar__select"
                  value={draft.kind}
                  onChange={(event) => patch({ kind: event.target.value as CampaignKind })}
                >
                  {KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {CAMPAIGN_KIND_LABELS[kind]}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <div className="kv__k" style={{ marginBottom: "var(--s-2)" }}>Channel</div>
                <select
                  className="toolbar__select"
                  value={draft.channel}
                  onChange={(event) => {
                    const channel = event.target.value as Channel;
                    /* Templates are per channel, so switching invalidates them. */
                    patch({
                      channel,
                      steps: draft.steps.map((step) => ({ ...step, channel, templateId: "" })),
                    });
                  }}
                >
                  {CHANNELS.map((channel) => (
                    <option key={channel} value={channel} disabled={channel !== "email"}>
                      {channel}
                      {channel !== "email" ? " (not yet available)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Card>

          <Card title="Countries" action={<Badge tone="violet">{draft.countryCodes.length}</Badge>}>
            <div className="chips">
              {COUNTRIES.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  className={draft.countryCodes.includes(country.code) ? "chip is-on" : "chip"}
                  onClick={() => toggleCountry(country.code)}
                >
                  {country.code} {country.name}
                </button>
              ))}
            </div>
          </Card>

          <Card title="Who enters this campaign">
            <p className="table__sub" style={{ marginBottom: "var(--s-3)" }}>
              Contacts already part way through resume at their own next step
              regardless of these statuses — this only controls who joins.
            </p>
            <div className="chips">
              {STATUSES.map((status) => {
                const blocked = UNSELECTABLE.includes(status);
                return (
                  <button
                    key={status}
                    type="button"
                    className={draft.targetStatuses.includes(status) ? "chip is-on" : "chip"}
                    onClick={() => toggleStatus(status)}
                    disabled={blocked}
                    title={blocked ? "Owned by the sales team — never campaigned to" : undefined}
                    style={blocked ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
                  >
                    {STATUS_LABELS[status]}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card
            title="Sequence"
            action={
              <Button onClick={addStep} disabled={usableTemplates.length === 0}>
                <Plus size={16} strokeWidth={2} />
                Add step
              </Button>
            }
            flushBody
          >
            {draft.steps.length === 0 ? (
              <p className="table__sub" style={{ padding: "var(--s-6)" }}>
                No steps yet.{" "}
                {usableTemplates.length === 0
                  ? `There are no ${draft.channel} templates to choose from.`
                  : "Add the first one — it sends immediately when a contact enters."}
              </p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Type</th>
                      <th>Template</th>
                      <th>Wait</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {[...draft.steps]
                      .sort((a, b) => a.order - b.order)
                      .map((step, index, all) => (
                        <tr key={step.id}>
                          <td className="table__primary">{step.order}</td>
                          <td>
                            <select
                              className="toolbar__select"
                              value={step.kind}
                              onChange={(event) =>
                                updateStep(step.id, { kind: event.target.value as CampaignKind })
                              }
                            >
                              {KINDS.map((kind) => (
                                <option key={kind} value={kind}>
                                  {CAMPAIGN_KIND_LABELS[kind]}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              className="toolbar__select"
                              value={step.templateId}
                              onChange={(event) => updateStep(step.id, { templateId: event.target.value })}
                            >
                              <option value="">Choose a template…</option>
                              {usableTemplates.map((template) => (
                                <option key={template.id} value={template.id}>
                                  {template.name} ({template.language.toUpperCase()})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            {index === 0 ? (
                              <span className="table__sub">immediately</span>
                            ) : (
                              <span className="flag">
                                <input
                                  type="number"
                                  min={1}
                                  max={120}
                                  value={step.delayDays}
                                  className="toolbar__select"
                                  style={{ width: 80 }}
                                  onChange={(event) =>
                                    updateStep(step.id, {
                                      delayDays: Math.max(1, Number(event.target.value) || 1),
                                    })
                                  }
                                />
                                days
                              </span>
                            )}
                          </td>
                          <td>
                            <div className="table__actions">
                              <Button
                                variant="ghost"
                                onClick={() => moveStep(step.id, -1)}
                                disabled={index === 0}
                                title="Move earlier"
                              >
                                <ArrowUp size={16} strokeWidth={2} />
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() => moveStep(step.id, 1)}
                                disabled={index === all.length - 1}
                                title="Move later"
                              >
                                <ArrowDown size={16} strokeWidth={2} />
                              </Button>
                              <Button variant="ghost" onClick={() => removeStep(step.id)} title="Remove">
                                <Trash2 size={16} strokeWidth={2} color="var(--c-danger)" />
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
        </div>

        <div className="stack">
          <Card title="Audience right now">
            {!preview ? (
              <p className="table__sub">Add a country and a step to see the audience.</p>
            ) : (
              <>
                <div className="kv">
                  <span className="kv__k">Would send to</span>
                  <span className="kv__v">{preview.willSend}</span>
                </div>
                <div className="kv">
                  <span className="kv__k">Countries reached</span>
                  <span className="kv__v">{preview.countries}</span>
                </div>
                <div className="kv">
                  <span className="kv__k">Excluded</span>
                  <span className="kv__v">{preview.skipped}</span>
                </div>
                <p className="table__sub" style={{ marginTop: "var(--s-3)" }}>
                  Counted live as you edit. The full breakdown is on the campaign
                  page once saved.
                </p>
              </>
            )}
          </Card>

          <Card title="How sending works">
            <ul
              style={{
                listStyle: "disc",
                paddingLeft: "1.1em",
                fontSize: "var(--fs-sm)",
                color: "var(--c-text-secondary)",
                lineHeight: 1.7,
              }}
            >
              <li>Step 1 goes out when a contact enters the campaign.</li>
              <li>Later steps wait their own number of days after the previous send.</li>
              <li>Each message is held until the recipient&rsquo;s local working hours.</li>
              <li>A reply stops the whole sequence for that buyer, permanently.</li>
              <li>Nothing leaves until a second person approves the campaign.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
