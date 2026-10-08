import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Building2,
  CheckCircle2,
  Globe2,
  Mail,
  Megaphone,
  MessageSquareReply,
} from "lucide-react";
import { Card } from "../../components/ui/Card";
import { StatTile } from "../../components/ui/StatTile";
import { EmptyState } from "../../components/ui/EmptyState";
import { Badge } from "../../components/ui/Badge";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { repo } from "../../lib/domain/repository";
import type { CountrySegment } from "../../lib/domain/repository";
import { isInSendWindow, localTime } from "../../lib/domain/countries";
import { HUMAN_OWNED } from "../../lib/domain/types";
import type { Campaign, Company, Contact, Handoff } from "../../lib/domain/types";
import "./dashboard.css";
import "../../styles/table.css";

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function Dashboard() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [segments, setSegments] = useState<CountrySegment[]>([]);
  const [now] = useState(() => new Date());

  useEffect(() => {
    void repo.listContacts().then(setContacts);
    void repo.listCompanies().then(setCompanies);
    void repo.listCampaigns().then(setCampaigns);
    void repo.listHandoffs().then(setHandoffs);
    void repo.countrySegments().then(setSegments);
  }, []);

  const companyById = useMemo(() => new Map(companies.map((item) => [item.id, item])), [companies]);

  const needsReview = contacts.filter((contact) => !contact.verified);
  const openHandoffs = handoffs.filter((handoff) => !handoff.resolved);
  const running = campaigns.filter((campaign) => campaign.status === "running");
  const pending = campaigns.filter((campaign) => campaign.status === "pending_approval");
  const replied = contacts.filter((contact) => HUMAN_OWNED.includes(contact.status));
  const openMarkets = segments.filter((segment) => isInSendWindow(segment.code, now));

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
        <StatTile icon={Building2} label="Companies" value={companies.length} caption="in the database" tone="blue" to="/buyers/companies" />
        <StatTile icon={Mail} label="Contacts" value={contacts.length} caption="with an email" tone="violet" to="/buyers/contacts" />
        <StatTile icon={Globe2} label="Countries" value={segments.length} caption="segmented" tone="teal" to="/segments" />
        <StatTile icon={CheckCircle2} label="Needs review" value={needsReview.length} caption="unverified" tone="amber" to="/buyers/review" />
        <StatTile icon={Megaphone} label="Campaigns" value={running.length} caption="running now" tone="green" to="/campaigns" />
        <StatTile icon={MessageSquareReply} label="Replies" value={openHandoffs.length} caption="to hand off" tone="rose" to="/activity" />
      </div>

      <div className="panel-grid">
        <Card
          title="Waiting on the team"
          action={<Link to="/activity" className="card__action">Activity</Link>}
          flushBody
        >
          {openHandoffs.length === 0 ? (
            <EmptyState icon={MessageSquareReply} title="No buyers waiting" />
          ) : (
            <div className="row-list">
              {openHandoffs.slice(0, 5).map((handoff) => {
                const contact = contacts.find((item) => item.id === handoff.contactId);
                const company = contact ? companyById.get(contact.companyId) : undefined;
                const days = Math.round((now.getTime() - new Date(handoff.at).getTime()) / 86_400_000);
                return (
                  <div className="row" key={handoff.id}>
                    <div className="row__main">
                      <div className="row__title">{contact?.name ?? contact?.email}</div>
                      <div className="row__meta">
                        {company?.name} — {handoff.reason}
                      </div>
                    </div>
                    <Badge tone={days > 2 ? "rose" : "amber"}>{days}d</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card
          title="Needs review"
          action={<Link to="/buyers/review" className="card__action">Review queue</Link>}
          flushBody
        >
          {needsReview.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Everything is verified" />
          ) : (
            <div className="row-list">
              {needsReview.slice(0, 5).map((contact) => {
                const company = companyById.get(contact.companyId);
                return (
                  <div className="row" key={contact.id}>
                    <div className="row__main">
                      <div className="row__title">{contact.name ?? contact.email}</div>
                      <div className="row__meta">
                        {company?.name} · {company?.countryCode}
                      </div>
                    </div>
                    <StatusBadge status={contact.status} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card
          title="Markets open now"
          action={<Link to="/segments" className="card__action">Segments</Link>}
          flushBody
        >
          {openMarkets.length === 0 ? (
            <EmptyState icon={Globe2} title="All markets are outside their send window" hint="Queued messages are held until local working hours." />
          ) : (
            <div className="row-list">
              {openMarkets.slice(0, 6).map((segment) => (
                <div className="row" key={segment.code}>
                  <span className="flag__code">{segment.code}</span>
                  <div className="row__main">
                    <div className="row__title">{segment.name}</div>
                    <div className="row__meta">{segment.contactable} contactable</div>
                  </div>
                  <Badge tone="green" dot>
                    {localTime(segment.code, now)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {pending.length > 0 && (
        <Card
          title="Awaiting approval"
          action={<Link to="/campaigns/approvals" className="card__action">Approvals</Link>}
          flushBody
        >
          <div className="row-list">
            {pending.map((campaign) => (
              <div className="row" key={campaign.id}>
                <div className="row__main">
                  <Link to={`/campaigns/${campaign.id}`} className="row__title">
                    {campaign.name}
                  </Link>
                  <div className="row__meta">
                    {campaign.countryCodes.join(", ")} · {campaign.steps.length} steps
                  </div>
                </div>
                <Badge tone="amber">Pending</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <p className="table__sub" style={{ textAlign: "center" }}>
        {replied.length} buyers are owned by the sales team and excluded from every campaign.
      </p>
    </div>
  );
}
