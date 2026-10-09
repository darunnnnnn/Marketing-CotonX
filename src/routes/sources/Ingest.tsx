import { Fragment, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { FileUp, Info, Inbox, ShieldCheck } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { StatTile } from "../../components/ui/StatTile";
import { classifyAll, makeContext, summarise } from "../../lib/ingestion/classify";
import { parseMbox } from "../../lib/ingestion/mbox";
import { EXCLUSION_LABELS } from "../../lib/ingestion/types";
import type { Classification, Verdict } from "../../lib/ingestion/types";
import { STATUS_LABELS } from "../../lib/domain/types";
import { lookupByEmail } from "../../lib/enrichment";
import { repo } from "../../lib/domain/repository";
import type { Company, Contact } from "../../lib/domain/types";
import "../../styles/table.css";

const VERDICT_TONE: Record<Verdict, "green" | "amber" | "neutral"> = {
  buyer: "green",
  review: "amber",
  not_buyer: "neutral",
};

const VERDICT_LABEL: Record<Verdict, string> = {
  buyer: "Buyer",
  review: "Needs review",
  not_buyer: "Not a buyer",
};

export function Ingest() {
  const [ownAddresses, setOwnAddresses] = useState("sales@cotonex.com\nmerch1@cotonex.com");
  const [results, setResults] = useState<Classification[] | null>(null);
  const [filter, setFilter] = useState<Verdict | "all">("all");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [imported, setImported] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const context = useMemo(
    () => makeContext(ownAddresses.split(/[\n,;]+/).map((line) => line.trim()).filter(Boolean)),
    [ownAddresses],
  );

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setFileName(file.name);
    setImported(0);

    /* Parsing happens entirely in the browser — mailbox history never leaves
       the machine during this step. */
    const threads = parseMbox(await file.text());
    setResults(classifyAll(threads, context));
    setBusy(false);
  };

  const totals = results ? summarise(results) : null;
  const shown = results?.filter((result) => filter === "all" || result.verdict === filter) ?? [];

  const importAccepted = async () => {
    if (!results) return;
    const accepted = results.filter((result) => result.verdict === "buyer" && result.counterparty);
    const now = new Date().toISOString();
    const companies: Company[] = [];
    const contacts: Contact[] = [];

    for (const result of accepted) {
      const email = result.counterparty!.email;
      const guess = lookupByEmail(email);
      const domain = email.split("@")[1];
      const companyId = `mbox-${domain}`;

      companies.push({
        id: companyId,
        name: result.extracted.company ?? guess.record.companyName?.value ?? domain,
        domain,
        countryCode: guess.record.countryCode?.value ?? "",
        country: guess.record.country?.value ?? "",
        verified: false,
        sources: ["gmail"],
        createdAt: now,
      });

      contacts.push({
        id: `mbox-${email}`,
        companyId,
        name: result.extracted.name ?? result.counterparty!.name,
        email,
        phone: result.extracted.phone,
        designation: result.extracted.designation,
        roleCategory: guess.record.roleCategory?.value,
        rolePriority: result.extracted.designation ? "high" : "medium",
        preferredLanguage: "en",
        /* Status comes from the thread shape, not a default. */
        status: result.status,
        lastTouchAt: result.lastAt,
        sequencePosition: {},
        verified: false,
        sources: ["gmail"],
        doNotContact: false,
        callConsent: false,
        createdAt: now,
      });
    }

    await repo.addCompanies(companies);
    await repo.addContacts(contacts);
    setImported(contacts.length);
  };

  return (
    <div className="page">
      <p className="page__lead">
        Turns three years of mailbox history into buyer records. Export each
        mailbox from <a href="https://takeout.google.com" target="_blank" rel="noreferrer noopener">Google Takeout</a>{" "}
        (Mail only, mbox format) and load the file here. No API access, no
        Workspace domain, and nothing is uploaded — parsing and classification
        both run in this browser.
      </p>

      <Card title="Your own addresses">
        <p className="table__sub" style={{ marginBottom: "var(--s-3)" }}>
          One per line. This is how the classifier tells your team&rsquo;s
          messages from the buyer&rsquo;s — the single most important signal it has.
        </p>
        <textarea
          className="toolbar__search"
          style={{ width: "100%", minHeight: 90, borderRadius: "var(--r-md)", fontFamily: "monospace" }}
          value={ownAddresses}
          onChange={(event) => setOwnAddresses(event.target.value)}
          spellCheck={false}
        />
      </Card>

      <Card title="Load a mailbox export">
        <input type="file" accept=".mbox,.txt,message/rfc822" onChange={(event) => void onFile(event)} />
        {fileName && (
          <p className="table__sub" style={{ marginTop: "var(--s-3)" }}>
            {busy ? "Parsing…" : `${fileName} — ${totals?.total ?? 0} threads`}
          </p>
        )}
      </Card>

      {totals && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--s-4)" }}>
            <StatTile icon={Inbox} label="Threads" value={totals.total} caption="in this export" tone="blue" />
            <StatTile icon={ShieldCheck} label="Buyers" value={totals.byVerdict.buyer} caption="auto-accepted" tone="green" />
            <StatTile icon={Info} label="To review" value={totals.byVerdict.review} caption="need a human" tone="amber" />
            <StatTile icon={Inbox} label="Discarded" value={totals.byVerdict.not_buyer} caption="not buyers" tone="rose" />
          </div>

          {totals.byExclusion.size > 0 && (
            <Card title="Why threads were discarded">
              {[...totals.byExclusion.entries()]
                .sort(([, a], [, b]) => b - a)
                .map(([reason, count]) => (
                  <div className="kv" key={reason}>
                    <span className="kv__k">{EXCLUSION_LABELS[reason]}</span>
                    <span className="kv__v">{count}</span>
                  </div>
                ))}
            </Card>
          )}

          <div className="toolbar">
            {(["all", "buyer", "review", "not_buyer"] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={filter === value ? "chip is-on" : "chip"}
                onClick={() => setFilter(value)}
              >
                {value === "all" ? "All" : VERDICT_LABEL[value]}
              </button>
            ))}
            <span className="toolbar__spacer" />
            {imported > 0 ? (
              <Badge tone="green">{imported} imported</Badge>
            ) : (
              <Button variant="primary" onClick={() => void importAccepted()} disabled={totals.byVerdict.buyer === 0}>
                <FileUp size={16} strokeWidth={2} />
                Import {totals.byVerdict.buyer} buyers
              </Button>
            )}
          </div>

          <Card flushBody>
            {shown.length === 0 ? (
              <EmptyState icon={Inbox} title="Nothing in this category" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Correspondent</th>
                      <th>Extracted</th>
                      <th className="table__num">Msgs</th>
                      <th>Status</th>
                      <th className="table__num">Score</th>
                      <th>Verdict</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {shown.slice(0, 100).map((result) => (
                      <Fragment key={result.threadId}>
                        <tr>
                          <td>
                            <div className="table__primary">
                              {result.extracted.name ?? result.counterparty?.name ?? result.counterparty?.email ?? "—"}
                            </div>
                            <div className="table__sub">{result.counterparty?.email}</div>
                          </td>
                          <td className="table__sub">
                            {result.extracted.designation && <div>{result.extracted.designation}</div>}
                            {result.extracted.phone && <div>{result.extracted.phone}</div>}
                            {result.extracted.company && <div>{result.extracted.company}</div>}
                            {!result.extracted.designation && !result.extracted.phone && !result.extracted.company && "—"}
                          </td>
                          <td className="table__num">{result.messageCount}</td>
                          <td className="table__sub">{STATUS_LABELS[result.status]}</td>
                          <td className="table__num">{result.score}</td>
                          <td>
                            <Badge tone={VERDICT_TONE[result.verdict]}>{VERDICT_LABEL[result.verdict]}</Badge>
                          </td>
                          <td>
                            <div className="table__actions">
                              <Button
                                variant="ghost"
                                onClick={() => setExpanded(expanded === result.threadId ? null : result.threadId)}
                              >
                                Why?
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {expanded === result.threadId && (
                          <tr>
                            <td colSpan={7} style={{ background: "var(--c-surface-sunken)" }}>
                              {result.signals.map((signal, index) => (
                                <div className="kv" key={`${signal.label}-${index}`}>
                                  <span className="kv__k">
                                    {signal.label}
                                    {signal.detail && (
                                      <span style={{ color: "var(--c-text-muted)" }}> — {signal.detail}</span>
                                    )}
                                  </span>
                                  <span
                                    className="kv__v"
                                    style={{
                                      color:
                                        signal.points > 0
                                          ? "var(--c-green-ink)"
                                          : signal.points < 0
                                            ? "var(--c-danger)"
                                            : "var(--c-text-muted)",
                                    }}
                                  >
                                    {signal.points > 0 ? `+${signal.points}` : signal.points}
                                  </span>
                                </div>
                              ))}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {!results && !busy && (
        <Card flushBody>
          <EmptyState
            icon={Inbox}
            title="No export loaded"
            hint="Every thread gets a verdict you can question — press Why? on any row to see exactly which signals produced it."
          />
        </Card>
      )}
    </div>
  );
}
