import { useEffect, useState } from "react";
import { Clock, Globe2 } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { repo } from "../../lib/domain/repository";
import type { CountrySegment } from "../../lib/domain/repository";
import { COUNTRY_BY_CODE, isInSendWindow, localTime, nextSendSlot } from "../../lib/domain/countries";
import "../../styles/table.css";

/** Ticks once a minute so the local-time column stays honest. */
function useMinute() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

export function Segments() {
  const [segments, setSegments] = useState<CountrySegment[]>([]);
  const now = useMinute();

  useEffect(() => {
    void repo.countrySegments().then(setSegments);
  }, []);

  const totalContacts = segments.reduce((sum, segment) => sum + segment.contacts, 0);

  return (
    <div className="page">
      <p className="page__lead">
        The database split by country, with each market&rsquo;s current local time and
        whether it is inside its sending window right now. Campaigns are built per
        country for this reason — the same message sent at the wrong local hour
        performs very differently.
      </p>

      <Card flushBody>
        {segments.length === 0 ? (
          <EmptyState icon={Globe2} title="No countries yet" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Country</th>
                  <th className="table__num">Companies</th>
                  <th className="table__num">Contacts</th>
                  <th className="table__num">Verified</th>
                  <th className="table__num">Contactable</th>
                  <th className="table__num">Replied</th>
                  <th>Share</th>
                  <th>Local time</th>
                  <th>Send window</th>
                </tr>
              </thead>
              <tbody>
                {segments.map((segment) => {
                  const profile = COUNTRY_BY_CODE.get(segment.code);
                  const open = isInSendWindow(segment.code, now);
                  const next = nextSendSlot(segment.code, now);
                  const share = totalContacts ? (segment.contacts / totalContacts) * 100 : 0;

                  return (
                    <tr key={segment.code}>
                      <td>
                        <span className="flag">
                          <span className="flag__code">{segment.code}</span>
                          <span className="table__primary">{segment.name}</span>
                        </span>
                      </td>
                      <td className="table__num">{segment.companies}</td>
                      <td className="table__num">{segment.contacts}</td>
                      <td className="table__num">{segment.verified}</td>
                      <td className="table__num">{segment.contactable}</td>
                      <td className="table__num">{segment.replied}</td>
                      <td style={{ minWidth: 110 }}>
                        <div className="meter">
                          <div className="meter__fill" style={{ width: `${share}%` }} />
                        </div>
                        <div className="table__sub">{share.toFixed(0)}%</div>
                      </td>
                      <td>
                        <span className="flag">
                          <Clock size={14} strokeWidth={2} color="var(--c-text-muted)" />
                          {localTime(segment.code, now)}
                        </span>
                        <div className="table__sub">{profile?.timeZone}</div>
                      </td>
                      <td>
                        {open ? (
                          <Badge tone="green" dot>
                            Open now
                          </Badge>
                        ) : (
                          <>
                            <Badge tone="neutral">Closed</Badge>
                            <div className="table__sub">
                              opens{" "}
                              {new Intl.DateTimeFormat("en-GB", {
                                weekday: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false,
                                timeZone: profile?.timeZone,
                              }).format(next)}
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
    </div>
  );
}
