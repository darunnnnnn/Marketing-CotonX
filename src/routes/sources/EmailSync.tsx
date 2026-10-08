import { AlertTriangle, Mail } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import "../../styles/table.css";

/** The ten mailboxes whose history seeds the database. */
const MAILBOXES = [
  { address: "sales@cotonex.test", owner: "Sales", state: "not_connected" },
  { address: "merch1@cotonex.test", owner: "Merchandiser", state: "not_connected" },
  { address: "merch2@cotonex.test", owner: "Merchandiser", state: "not_connected" },
  { address: "merch3@cotonex.test", owner: "Merchandiser", state: "not_connected" },
  { address: "export@cotonex.test", owner: "Export", state: "not_connected" },
];

const PIPELINE = [
  ["Fetch threads", "Pull every conversation in the chosen date range."],
  ["Drop internal mail", "Remove colleagues, vendors, newsletters and automated senders."],
  ["Identify buyers", "Classify remaining counterparties as buyer or not."],
  ["Read signatures", "Extract phone, designation and company from signature blocks."],
  ["Resolve identity", "Match against existing records; queue genuine ambiguity for a human."],
  ["Derive status", "Set conversation status from who wrote last and when."],
];

export function EmailSync() {
  return (
    <div className="page">
      <p className="page__lead">
        Three years of buyer conversations live in team inboxes rather than in
        any system. This is the ingestion that turns them into records.
      </p>

      <div className="notice notice--warn">
        <AlertTriangle size={16} strokeWidth={2} />
        <span>
          <strong>Not connected.</strong> Mailbox access is not yet available.
          Domain-wide delegation needs a Google Workspace domain; the mailboxes
          are currently personal Gmail accounts, which that mechanism cannot
          reach. Until that is resolved, use a Google Takeout export through{" "}
          <strong>Sources &rarr; Imports</strong> — it needs no API access and
          gives the same three years of history.
        </span>
      </div>

      <div className="split">
        <Card title="Mailboxes" flushBody>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Mailbox</th>
                  <th>Owner</th>
                  <th>Last sync</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {MAILBOXES.map((mailbox) => (
                  <tr key={mailbox.address}>
                    <td className="table__primary">{mailbox.address}</td>
                    <td>{mailbox.owner}</td>
                    <td className="table__sub">never</td>
                    <td>
                      <Badge tone="neutral">Not connected</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="What ingestion does">
          {PIPELINE.map(([step, description], index) => (
            <div key={step} style={{ display: "flex", gap: "var(--s-3)", padding: "var(--s-2) 0" }}>
              <span
                style={{
                  display: "grid",
                  placeItems: "center",
                  minWidth: 24,
                  height: 24,
                  borderRadius: "var(--r-full)",
                  background: "var(--c-surface-sunken)",
                  border: "1px solid var(--c-border)",
                  fontSize: "var(--fs-xs)",
                  fontWeight: 700,
                  color: "var(--c-text-secondary)",
                }}
              >
                {index + 1}
              </span>
              <div>
                <div style={{ fontWeight: 600 }}>{step}</div>
                <div className="table__sub">{description}</div>
              </div>
            </div>
          ))}
        </Card>
      </div>

      <Card title="Why a human reviews the result">
        <p style={{ color: "var(--c-text-secondary)", lineHeight: 1.6 }}>
          <Mail size={16} strokeWidth={2} style={{ verticalAlign: "-3px", marginRight: 6 }} />
          Three years of mixed correspondence will not classify perfectly. The
          first few hundred records go through the review queue, which both
          cleans the data and shows where the classifier is wrong so it can be
          corrected. Nothing imported from mail is campaign-eligible until a
          person has confirmed it.
        </p>
      </Card>
    </div>
  );
}
