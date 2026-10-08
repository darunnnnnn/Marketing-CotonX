import { AlertTriangle, CheckCircle2, Circle, KeyRound } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { PROVIDER_OPTIONS, activeProvider, sendingBlockers } from "../../lib/sending/provider";
import "../../styles/table.css";

/**
 * Every external credential the system needs, where it goes, and what stays
 * broken until it is supplied. Values are never entered here — secrets belong
 * in Supabase Edge Function secrets, not in a browser form and not in the
 * repository.
 */
const CREDENTIALS = [
  {
    key: "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY",
    where: ".env.local",
    unlocks: "Persistence. Until then all data is in browser memory and resets on reload.",
    set: Boolean(import.meta.env.VITE_SUPABASE_URL),
  },
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    where: "Edge Function secrets",
    unlocks: "Server-side writes from scheduled jobs and webhooks.",
    set: false,
  },
  {
    key: "APOLLO_API_KEY",
    where: "Edge Function secrets",
    unlocks: "Live Apollo search. Results are generated locally without it.",
    set: false,
  },
  {
    key: "Email provider API key",
    where: "Edge Function secrets",
    unlocks: "Actual sending. Currently every send is simulated.",
    set: false,
  },
  {
    key: "Sending domain + SPF / DKIM / DMARC",
    where: "DNS",
    unlocks: "Deliverability. Without an authenticated domain, campaigns land in spam.",
    set: false,
  },
  {
    key: "Gmail access (Workspace delegation or Takeout export)",
    where: "Google Cloud / Admin console",
    unlocks: "Three years of existing buyer conversations.",
    set: false,
  },
];

export function Settings() {
  const blockers = sendingBlockers();
  const ready = CREDENTIALS.filter((item) => item.set).length;

  return (
    <div className="page">
      <p className="page__lead">
        What the system still needs from the outside world. Nothing here is a
        form — credentials live in environment variables and Edge Function
        secrets so they never reach the browser or the repository.
      </p>

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

      <Card
        title="Credentials"
        action={
          <Badge tone={ready === CREDENTIALS.length ? "green" : "amber"}>
            {ready} of {CREDENTIALS.length} configured
          </Badge>
        }
        flushBody
      >
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Credential</th>
                <th>Lives in</th>
                <th>Unlocks</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {CREDENTIALS.map((item) => (
                <tr key={item.key}>
                  <td>
                    <span className="flag">
                      <KeyRound size={14} strokeWidth={2} color="var(--c-text-muted)" />
                      <code className="table__primary">{item.key}</code>
                    </span>
                  </td>
                  <td className="table__sub">{item.where}</td>
                  <td className="table__sub">{item.unlocks}</td>
                  <td>
                    {item.set ? (
                      <Badge tone="green">
                        <CheckCircle2 size={12} strokeWidth={2.5} /> Set
                      </Badge>
                    ) : (
                      <Badge tone="neutral">
                        <Circle size={12} strokeWidth={2.5} /> Not set
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Email provider" action={<Badge tone="amber">{activeProvider.capability.label}</Badge>}>
        <p className="table__sub" style={{ marginBottom: "var(--s-4)" }}>
          {activeProvider.capability.notes}
        </p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Option</th>
                <th>Webhooks</th>
                <th>Needs a verified domain</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {PROVIDER_OPTIONS.map((option) => (
                <tr key={option.id}>
                  <td className="table__primary">{option.label}</td>
                  <td>{option.supportsWebhooks ? "yes" : "no"}</td>
                  <td>{option.requiresVerifiedDomain ? "yes" : "no"}</td>
                  <td className="table__sub">{option.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="table__sub" style={{ marginTop: "var(--s-4)" }}>
          All three sit behind the same <code>EmailProvider</code> interface, so
          the choice is one line in <code>src/lib/sending/provider.ts</code> and
          affects nothing else.
        </p>
      </Card>

      <Card title="Edge Functions still to deploy" flushBody>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Function</th>
                <th>Does</th>
                <th>Client side</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="table__primary">apollo-search</td>
                <td className="table__sub">Holds the Apollo key and proxies the search.</td>
                <td><Badge tone="green">written</Badge></td>
              </tr>
              <tr>
                <td className="table__primary">verify-domain</td>
                <td className="table__sub">MX lookup — browsers cannot query DNS.</td>
                <td><Badge tone="neutral">not started</Badge></td>
              </tr>
              <tr>
                <td className="table__primary">inbound-reply</td>
                <td className="table__sub">Provider webhook that triggers the reply-stop rule.</td>
                <td><Badge tone="green">logic written</Badge></td>
              </tr>
              <tr>
                <td className="table__primary">drain-queue</td>
                <td className="table__sub">Scheduled job that releases messages in their send window.</td>
                <td><Badge tone="green">logic written</Badge></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
