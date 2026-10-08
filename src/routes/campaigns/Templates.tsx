import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { repo } from "../../lib/domain/repository";
import { CAMPAIGN_KIND_LABELS } from "../../lib/domain/types";
import type { Template } from "../../lib/domain/types";
import "../../styles/table.css";

const MERGE_FIELDS = [
  ["contact_name", "Full name, or a polite fallback when unknown"],
  ["first_name", "First name only"],
  ["company_name", "The buyer's company"],
  ["country", "Their country"],
  ["designation", "Job title"],
  ["last_touch_date", "When we last wrote to them"],
];

export function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    void repo.listTemplates().then((items) => {
      setTemplates(items);
      setSelected(items[0]?.id ?? null);
    });
  }, []);

  const active = templates.find((template) => template.id === selected);

  return (
    <div className="page">
      <p className="page__lead">
        The five content types the system sends: introduction, category,
        collection, capability proof and follow-up. Each exists per language,
        so a German buyer gets German.
      </p>

      <div className="split">
        <Card title="Preview">
          {!active ? (
            <EmptyState icon={Mail} title="No template selected" />
          ) : (
            <>
              <div className="kv">
                <span className="kv__k">Name</span>
                <span className="kv__v">{active.name}</span>
              </div>
              <div className="kv">
                <span className="kv__k">Type</span>
                <span className="kv__v">{CAMPAIGN_KIND_LABELS[active.kind]}</span>
              </div>
              <div className="kv">
                <span className="kv__k">Channel / language</span>
                <span className="kv__v">
                  {active.channel} · {active.language.toUpperCase()}
                </span>
              </div>
              {active.subject && (
                <div className="kv">
                  <span className="kv__k">Subject</span>
                  <span className="kv__v">{active.subject}</span>
                </div>
              )}
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
                {active.body}
              </pre>
              {active.attachments.length > 0 && (
                <div style={{ marginTop: "var(--s-4)", display: "flex", gap: "var(--s-2)" }}>
                  {active.attachments.map((file) => (
                    <Badge key={file} tone="blue">
                      {file}
                    </Badge>
                  ))}
                </div>
              )}
            </>
          )}
        </Card>

        <div className="stack">
          <Card title="Templates" flushBody>
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  {templates.map((template) => (
                    <tr
                      key={template.id}
                      onClick={() => setSelected(template.id)}
                      style={{
                        cursor: "pointer",
                        background: template.id === selected ? "var(--c-brand-50)" : undefined,
                      }}
                    >
                      <td>
                        <div className="table__primary">{template.name}</div>
                        <div className="table__sub">{CAMPAIGN_KIND_LABELS[template.kind]}</div>
                      </td>
                      <td>
                        <Badge tone="neutral">{template.language.toUpperCase()}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Merge fields">
            {MERGE_FIELDS.map(([field, description]) => (
              <div className="kv" key={field}>
                <span className="kv__k">
                  <code>{`{{${field}}}`}</code>
                </span>
                <span className="kv__v" style={{ fontWeight: 400, fontSize: "var(--fs-sm)" }}>
                  {description}
                </span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
