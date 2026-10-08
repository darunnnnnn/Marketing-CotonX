import { Building2, CheckCircle2, Globe2, Mail, MessageSquareReply, Megaphone } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { StatTile } from "../../components/ui/StatTile";
import { EmptyState } from "../../components/ui/EmptyState";
import { Badge } from "../../components/ui/Badge";
import "./dashboard.css";

/* Phase 0 shell: figures are zeroed placeholders. They bind to Supabase in Phase 1. */
const stats = [
  { icon: Building2, label: "Companies", value: 0, caption: "in the database", tone: "blue" as const, to: "/buyers/companies" },
  { icon: Mail, label: "Contacts", value: 0, caption: "with an email", tone: "violet" as const, to: "/buyers/contacts" },
  { icon: Globe2, label: "Countries", value: 0, caption: "segmented", tone: "teal" as const, to: "/segments" },
  { icon: CheckCircle2, label: "Verified", value: 0, caption: "awaiting review", tone: "green" as const, to: "/buyers/review" },
  { icon: Megaphone, label: "Campaigns", value: 0, caption: "running now", tone: "amber" as const, to: "/campaigns" },
  { icon: MessageSquareReply, label: "Replies", value: 0, caption: "to hand off", tone: "rose" as const, to: "/activity" },
];

const setup = [
  { label: "Project scaffold + design system", hint: "React 19, Vite 8, Supabase client", done: true },
  { label: "Buyer database schema", hint: "Phase 1 — companies, contacts, sources, status", done: false },
  { label: "Gmail ingestion", hint: "Phase 2 — 10 mailboxes, 3 years of history", done: false },
  { label: "Country segmentation + review UI", hint: "Phase 3", done: false },
  { label: "Apollo and other sources", hint: "Phase 4", done: false },
  { label: "Campaign engine", hint: "Phase 5 — sequences, approvals, timezone scheduling", done: false },
];

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function Dashboard() {
  const now = new Date();
  const dateLabel = now
    .toLocaleDateString("en-GB", { weekday: "long", month: "long", day: "numeric" })
    .toUpperCase();

  return (
    <div className="dashboard">
      <section className="hero">
        <p className="hero__date">{dateLabel}</p>
        <h2 className="hero__greeting">{greeting(now.getHours())}, Team!</h2>
        <p className="hero__sub">Here is where buyer outreach stands today.</p>
        <blockquote className="hero__quote">
          <p>Great things are done by a series of small things brought together.</p>
          <footer>— Vincent van Gogh</footer>
        </blockquote>
      </section>

      <div className="stat-grid">
        {stats.map((stat) => (
          <StatTile key={stat.label} {...stat} />
        ))}
      </div>

      <div className="panel-grid">
        <Card title="Needs Attention" action={<button className="card__action">All contacts</button>} flushBody>
          <EmptyState
            icon={CheckCircle2}
            title="Nothing to review yet"
            hint="Items appear here once Gmail ingestion starts producing buyer records."
          />
        </Card>

        <Card title="Recent Replies" action={<button className="card__action">Activity</button>} flushBody>
          <EmptyState
            icon={MessageSquareReply}
            title="No replies yet"
            hint="When a buyer replies, their campaign stops and they are handed to the sales team."
          />
        </Card>

        <Card title="Build Progress" action={<Badge tone="violet">Phase 0</Badge>}>
          <ul className="setup-list">
            {setup.map((item, index) => (
              <li
                key={item.label}
                className={["setup-item", item.done && "setup-item--done"].filter(Boolean).join(" ")}
              >
                <span className="setup-item__step">{item.done ? "✓" : index + 1}</span>
                <div>
                  <div className="setup-item__label">{item.label}</div>
                  <div className="setup-item__hint">{item.hint}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
