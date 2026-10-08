import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Clock } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { repo } from "../../lib/domain/repository";
import { buildPlan } from "../../lib/campaign/engine";
import type { PlanRow } from "../../lib/campaign/engine";
import { COUNTRIES, COUNTRY_BY_CODE, isInSendWindow, localTime } from "../../lib/domain/countries";
import type { Campaign, Company, Contact, Suppression, Template } from "../../lib/domain/types";
import "../../styles/table.css";

type QueuedRow = PlanRow & { campaignName: string };

export function Schedule() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [suppressions, setSuppressions] = useState<Suppression[]>([]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    void repo.listCampaigns().then(setCampaigns);
    void repo.listContacts().then(setContacts);
    void repo.listCompanies().then(setCompanies);
    void repo.listTemplates().then(setTemplates);
    void repo.listSuppressions().then(setSuppressions);
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  /* Only campaigns that have cleared approval may put anything in the queue. */
  const queue = useMemo<QueuedRow[]>(() => {
    if (companies.length === 0) return [];
    const live = campaigns.filter((campaign) =>
      ["approved", "scheduled", "running"].includes(campaign.status),
    );
    return live
      .flatMap((campaign) =>
        buildPlan(campaign, contacts, companies, templates, suppressions, now).rows.map((row) => ({
          ...row,
          campaignName: campaign.name,
        })),
      )
      .sort((a, b) => a.sendAt.getTime() - b.sendAt.getTime());
  }, [campaigns, contacts, companies, templates, suppressions, now]);

  const byCountry = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of queue) {
      counts.set(row.company.countryCode, (counts.get(row.company.countryCode) ?? 0) + 1);
    }
    return counts;
  }, [queue]);

  const openMarkets = COUNTRIES.filter((country) => isInSendWindow(country.code, now));

  return (
    <div className="page">
      <p className="page__lead">
        The outbound queue. Every message is held until the recipient&rsquo;s own
        working hours — a German buyer is written to in German office time, not
        whenever the job happens to run.
      </p>

      <div className="split">
        <Card
          title="Queued"
          action={<Badge tone={queue.length ? "violet" : "neutral"}>{queue.length}</Badge>}
          flushBody
        >
          {queue.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="The queue is empty"
              hint="Only approved campaigns with contacts due right now put messages in the queue."
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Recipient</th>
                    <th>Campaign</th>
                    <th>Step</th>
                    <th>Country</th>
                    <th>Their local time now</th>
                    <th>Releases at</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((row) => {
                    const profile = COUNTRY_BY_CODE.get(row.company.countryCode);
                    const open = isInSendWindow(row.company.countryCode, now);
                    return (
                      <tr key={`${row.campaignName}-${row.contact.id}`}>
                        <td>
                          <div className="table__primary">{row.contact.name ?? row.contact.email}</div>
                          <div className="table__sub">{row.company.name}</div>
                        </td>
                        <td>{row.campaignName}</td>
                        <td>
                          <Badge tone="violet">{row.step.order}</Badge>
                        </td>
                        <td>
                          <span className="flag__code">{row.company.countryCode}</span>
                        </td>
                        <td>
                          <span className="flag">
                            <Clock size={14} strokeWidth={2} color="var(--c-text-muted)" />
                            {localTime(row.company.countryCode, now)}
                          </span>
                        </td>
                        <td>
                          {open ? (
                            <Badge tone="green" dot>
                              Window open
                            </Badge>
                          ) : (
                            <>
                              <Badge tone="amber">Held</Badge>
                              <div className="table__sub">
                                {new Intl.DateTimeFormat("en-GB", {
                                  weekday: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: false,
                                  timeZone: profile?.timeZone,
                                }).format(row.sendAt)}{" "}
                                local
                              </div>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="stack">
          <Card title="Markets open right now">
            {openMarkets.length === 0 ? (
              <p className="table__sub">
                No target market is inside its sending window. Everything waits.
              </p>
            ) : (
              openMarkets.map((country) => (
                <div className="kv" key={country.code}>
                  <span className="kv__k">
                    <span className="flag__code">{country.code}</span> {country.name}
                  </span>
                  <span className="kv__v">{localTime(country.code, now)}</span>
                </div>
              ))
            )}
          </Card>

          <Card title="Queue by country">
            {byCountry.size === 0 ? (
              <p className="table__sub">Nothing queued.</p>
            ) : (
              [...byCountry.entries()]
                .sort(([, a], [, b]) => b - a)
                .map(([code, count]) => (
                  <div className="kv" key={code}>
                    <span className="kv__k">
                      <span className="flag__code">{code}</span>{" "}
                      {COUNTRY_BY_CODE.get(code)?.name ?? code}
                    </span>
                    <span className="kv__v">{count}</span>
                  </div>
                ))
            )}
          </Card>

          <Card title="Send windows">
            <p style={{ fontSize: "var(--fs-sm)", color: "var(--c-text-secondary)", lineHeight: 1.6 }}>
              Windows are mid-morning local time on working days, when business
              mail is most likely to be read. The UAE window follows a
              Sunday&ndash;Thursday week. Daylight saving is handled by the
              browser&rsquo;s timezone database rather than by fixed offsets.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
