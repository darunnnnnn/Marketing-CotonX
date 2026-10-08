import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  Eye,
  MailWarning,
  MessageSquareReply,
  Send,
  StopCircle,
  UserCheck,
} from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { StatTile } from "../../components/ui/StatTile";
import { repo } from "../../lib/domain/repository";
import { applyReply } from "../../lib/campaign/engine";
import type { Campaign, Company, Contact, Handoff, OutreachEvent, OutreachEventType } from "../../lib/domain/types";
import type { Tone } from "../../components/ui/StatTile";
import "../../styles/table.css";

/* Module scope: ids are generated in event handlers, never during render. */
let idCounter = 0;
const nextId = (prefix: string) => `${prefix}-${(idCounter += 1)}`;

const EVENT_TONE: Record<OutreachEventType, Tone | "neutral"> = {
  queued: "neutral",
  sent: "blue",
  delivered: "blue",
  opened: "violet",
  clicked: "teal",
  replied: "green",
  bounced: "rose",
  complained: "rose",
  unsubscribed: "amber",
  stopped: "amber",
};

export function Activity() {
  const [events, setEvents] = useState<OutreachEvent[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [filter, setFilter] = useState<OutreachEventType | "">("");
  /* Captured once so the waiting-days column is stable across re-renders. */
  const [now] = useState(() => Date.now());

  const load = () => {
    void repo.listEvents().then(setEvents);
    void repo.listContacts().then(setContacts);
    void repo.listCompanies().then(setCompanies);
    void repo.listCampaigns().then(setCampaigns);
    void repo.listHandoffs().then(setHandoffs);
  };

  useEffect(load, []);

  const contactById = useMemo(() => new Map(contacts.map((item) => [item.id, item])), [contacts]);
  const companyById = useMemo(() => new Map(companies.map((item) => [item.id, item])), [companies]);
  const campaignById = useMemo(() => new Map(campaigns.map((item) => [item.id, item])), [campaigns]);

  const counts = useMemo(() => {
    const tally: Partial<Record<OutreachEventType, number>> = {};
    for (const event of events) {
      tally[event.type] = (tally[event.type] ?? 0) + 1;
    }
    return tally;
  }, [events]);

  const sent = counts.sent ?? 0;
  const openRate = sent ? Math.round(((counts.opened ?? 0) / sent) * 100) : 0;
  const replyRate = sent ? Math.round(((counts.replied ?? 0) / sent) * 100) : 0;

  const rows = filter ? events.filter((event) => event.type === filter) : events;
  const openHandoffs = handoffs.filter((handoff) => !handoff.resolved);

  /* Lets the reply-stop rule be demonstrated without a live inbox. */
  const simulateReply = async (contactId: string, campaignId?: string) => {
    const contact = contactById.get(contactId);
    if (!contact) return;
    const outcome = applyReply(contact, new Date(), { campaignId });
    await repo.updateContact(contact.id, {
      status: outcome.contact.status,
      lastReplyAt: outcome.contact.lastReplyAt,
    });
    for (const event of outcome.events) {
      await repo.addEvent({ ...event, id: nextId(`sim-${event.type}`) });
    }
    await repo.addSuppression({ ...outcome.suppression, id: nextId("sup") });
    await repo.addHandoff({ ...outcome.handoff, id: nextId("handoff") });
    load();
  };

  const resolve = async (id: string) => {
    await repo.resolveHandoff(id);
    load();
  };

  return (
    <div className="page">
      <p className="page__lead">
        Every send, open, reply and stop, per buyer. This is the history that
        makes follow-ups sensible and tells the team who is worth calling.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--s-4)" }}>
        <StatTile icon={Send} label="Sent" value={sent} caption="messages" tone="blue" />
        <StatTile icon={Eye} label="Open rate" value={`${openRate}%`} caption="of sent" tone="violet" />
        <StatTile icon={MessageSquareReply} label="Reply rate" value={`${replyRate}%`} caption="of sent" tone="green" />
        <StatTile icon={StopCircle} label="Stopped" value={counts.stopped ?? 0} caption="handed to sales" tone="amber" />
        <StatTile icon={MailWarning} label="Bounced" value={counts.bounced ?? 0} caption="bad addresses" tone="rose" />
      </div>

      <Card
        title="Open handoffs"
        action={<Badge tone={openHandoffs.length ? "green" : "neutral"}>{openHandoffs.length}</Badge>}
        flushBody
      >
        {openHandoffs.length === 0 ? (
          <EmptyState icon={UserCheck} title="No buyers waiting for a reply from the team" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Buyer</th>
                  <th>Company</th>
                  <th>What they said</th>
                  <th>Waiting</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {openHandoffs.map((handoff) => {
                  const contact = contactById.get(handoff.contactId);
                  const company = contact ? companyById.get(contact.companyId) : undefined;
                  const days = Math.round((now - new Date(handoff.at).getTime()) / 86_400_000);
                  return (
                    <tr key={handoff.id}>
                      <td>
                        <div className="table__primary">{contact?.name ?? contact?.email}</div>
                        <div className="table__sub">{contact?.email}</div>
                      </td>
                      <td>
                        <div>{company?.name}</div>
                        <div className="table__sub">
                          <span className="flag__code">{company?.countryCode}</span>
                        </div>
                      </td>
                      <td>{handoff.reason}</td>
                      <td>
                        <Badge tone={days > 2 ? "rose" : "amber"}>{days}d</Badge>
                      </td>
                      <td>
                        <div className="table__actions">
                          <Button variant="primary" onClick={() => void resolve(handoff.id)}>
                            <CheckCircle2 size={16} strokeWidth={2} />
                            Mark handled
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="toolbar">
        <button type="button" className={filter === "" ? "chip is-on" : "chip"} onClick={() => setFilter("")}>
          All events
        </button>
        {(Object.keys(EVENT_TONE) as OutreachEventType[])
          .filter((type) => counts[type])
          .map((type) => (
            <button
              key={type}
              type="button"
              className={filter === type ? "chip is-on" : "chip"}
              onClick={() => setFilter(type)}
            >
              {type} ({counts[type]})
            </button>
          ))}
        <span className="toolbar__spacer" />
        <span className="toolbar__count">{rows.length} events</span>
      </div>

      <Card flushBody>
        {rows.length === 0 ? (
          <EmptyState icon={BarChart3} title="No events" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Event</th>
                  <th>Buyer</th>
                  <th>Campaign</th>
                  <th>Detail</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 60).map((event) => {
                  const contact = contactById.get(event.contactId);
                  const company = contact ? companyById.get(contact.companyId) : undefined;
                  return (
                    <tr key={event.id}>
                      <td className="table__sub">
                        {new Date(event.at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                      </td>
                      <td>
                        <Badge tone={EVENT_TONE[event.type]}>{event.type}</Badge>
                      </td>
                      <td>
                        <div className="table__primary">{contact?.name ?? contact?.email}</div>
                        <div className="table__sub">{company?.name}</div>
                      </td>
                      <td className="table__sub">
                        {event.campaignId ? campaignById.get(event.campaignId)?.name : "—"}
                      </td>
                      <td className="table__sub">{event.detail ?? "—"}</td>
                      <td>
                        <div className="table__actions">
                          {event.type === "sent" && contact && (
                            <Button variant="ghost" onClick={() => void simulateReply(contact.id, event.campaignId)}>
                              Simulate reply
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="notice notice--info">
        <MessageSquareReply size={16} strokeWidth={2} />
        <span>
          <strong>Try the reply-stop rule.</strong> Use &ldquo;Simulate reply&rdquo; on any
          sent event. The contact moves to <em>buyer replied</em>, a stop event is
          written, they are added to the suppression list, and they immediately
          vanish from every campaign send plan. In production this is triggered by
          the inbound mail webhook instead of a button.
        </span>
      </div>
    </div>
  );
}
