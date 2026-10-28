import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Clock, Inbox, Play, Plus, RefreshCw, Trash2, Zap } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { supabase } from "../../lib/supabase";
import type { Tone } from "../../components/ui/StatTile";
import "../../styles/table.css";

/**
 * The Gmail API ingestion route. Unlike Mailbox Ingest, which parses a Takeout
 * file in the browser, this manages scheduled server-side sync — so it talks
 * to the real database rather than the in-memory seed data.
 */

type Mailbox = {
  id: string;
  address: string;
  display_name: string | null;
  enabled: boolean;
  status: "idle" | "running" | "error" | "disabled";
  last_history_id: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  threads_seen: number;
  threads_classified: number;
  buyers_found: number;
};

type SyncRun = {
  id: string;
  mailbox_id: string;
  mode: string;
  started_at: string;
  finished_at: string | null;
  threads_seen: number;
  buyers: number;
  needs_review: number;
  discarded: number;
  error: string | null;
};

type ScheduleRow = {
  name: string;
  schedule: string;
  active: boolean;
};

/**
 * sync_schedule is a view, and the generated types only cover tables. Narrowed
 * here rather than loosening the client, so every other query stays checked.
 */
async function readSchedule(): Promise<ScheduleRow[]> {
  const query = supabase as unknown as {
    from: (view: string) => {
      select: (columns: string) => PromiseLike<{ data: ScheduleRow[] | null }>;
    };
  };
  const { data } = await query.from("sync_schedule").select("*");
  return data ?? [];
}

/** Same reason as readSchedule: the function postdates the generated types. */
async function dispatchSync(): Promise<{ error?: string }> {
  const client = supabase as unknown as {
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => PromiseLike<{ error: { message: string } | null }>;
  };
  const { error } = await client.rpc("dispatch_gmail_sync", { sync_mode: "incremental" });
  return error ? { error: error.message } : {};
}

/** Turns the cron expressions this project uses into plain English. */
const SCHEDULE_LABELS: Record<string, string> = {
  "gmail-sync-hourly": "Every hour",
  "gmail-sync-weekly-sweep": "Sundays, as a repair sweep",
  "release-stuck-mailboxes": "Every 20 minutes",
};

const STATUS_TONE: Record<Mailbox["status"], Tone | "neutral"> = {
  idle: "green",
  running: "blue",
  error: "rose",
  disabled: "neutral",
};

const configured = Boolean(import.meta.env.VITE_SUPABASE_URL);

export function EmailSync() {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  /* With no project configured there is nothing to fetch, so the screen is
     already in its final state. */
  const [loaded, setLoaded] = useState(!configured);

  const load = useCallback(async () => {
    if (!configured) return;
    const [boxes, history, jobs] = await Promise.all([
      supabase.from("mailboxes").select("*").order("address"),
      supabase.from("mailbox_sync_runs").select("*").order("started_at", { ascending: false }).limit(10),
      /* Absent on a project without the scheduling migration; not an error. */
      readSchedule(),
    ]);
    if (boxes.error) setProblem(boxes.error.message);
    setMailboxes((boxes.data as Mailbox[]) ?? []);
    setRuns((history.data as SyncRun[]) ?? []);
    setSchedule(jobs);
    setLoaded(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    /* Guarded so a response arriving after navigation cannot write to a
       component that is no longer mounted. */
    void (async () => {
      if (cancelled) return;
      await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const addMailbox = async () => {
    const value = address.trim().toLowerCase();
    if (!value) return;
    setProblem(null);
    const { error } = await supabase.from("mailboxes").insert({ address: value });
    if (error) setProblem(error.message);
    else setAddress("");
    await load();
  };

  const removeMailbox = async (id: string) => {
    await supabase.from("mailboxes").delete().eq("id", id);
    await load();
  };

  /* Same dispatcher the hourly schedule calls, so the manual button and the
     automatic run cannot drift apart. */
  const syncAllNow = async () => {
    setBusy("all");
    setProblem(null);
    const { error } = await dispatchSync();
    if (error) setProblem(error);
    setBusy(null);
    await load();
  };

  const sync = async (mailbox: Mailbox, mode: "backfill" | "incremental", dryRun: boolean) => {
    setBusy(mailbox.id);
    setProblem(null);
    try {
      const { data, error } = await supabase.functions.invoke("gmail-sync", {
        body: { mailbox: mailbox.address, mode, dryRun, maxThreads: mode === "backfill" ? 500 : 200 },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
      await load();
    }
  };

  if (!configured) {
    return (
      <div className="page">
        <div className="notice notice--warn">
          <AlertTriangle size={16} strokeWidth={2} />
          <span>
            No Supabase project is configured in this environment. Add{" "}
            <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to{" "}
            <code>.env.local</code>. The Takeout route under{" "}
            <strong>Sources &rarr; Mailbox Ingest</strong> needs none of this and works now.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <p className="page__lead">
        Server-side ingestion through the Gmail API, using domain-wide
        delegation on <strong>cotonex.com</strong>. Read-only scope: this can
        read mail and nothing else. A backfill walks three years of history; an
        incremental run asks Gmail only what changed since last time, so a daily
        sync costs a fraction of the first one.
      </p>

      {problem && (
        <div className="notice notice--stop">
          <AlertTriangle size={16} strokeWidth={2} />
          <span>{problem}</span>
        </div>
      )}

      <Card
        title="Automatic sync"
        action={
          <Badge tone={schedule.some((job) => job.active) ? "green" : "amber"}>
            {schedule.some((job) => job.active) ? "scheduled" : "not scheduled"}
          </Badge>
        }
      >
        {schedule.length === 0 ? (
          <p className="table__sub">
            No schedule found. Apply the latest migration, then store the two
            secrets the dispatcher needs (see Setup below).
          </p>
        ) : (
          <>
            {schedule.map((job) => (
              <div className="kv" key={job.name}>
                <span className="kv__k">
                  <Clock size={14} strokeWidth={2} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                  {SCHEDULE_LABELS[job.name] ?? job.name}
                  <span style={{ color: "var(--c-text-muted)" }}> — {job.schedule}</span>
                </span>
                <span className="kv__v">
                  <Badge tone={job.active ? "green" : "neutral"}>{job.active ? "on" : "paused"}</Badge>
                </span>
              </div>
            ))}
            <div style={{ marginTop: "var(--s-4)" }}>
              <Button variant="primary" onClick={() => void syncAllNow()} disabled={busy === "all"}>
                <Zap size={16} strokeWidth={2} />
                {busy === "all" ? "Dispatching…" : "Sync every mailbox now"}
              </Button>
            </div>
            <p className="table__sub" style={{ marginTop: "var(--s-3)" }}>
              Each mailbox is dispatched as its own request, so one failing
              mailbox cannot stop the others and ten of them cannot add up to a
              timeout. A mailbox mid-sync is skipped rather than started twice.
            </p>
          </>
        )}
      </Card>

      <Card title="Mailboxes">
        <div style={{ display: "flex", gap: "var(--s-3)", flexWrap: "wrap" }}>
          <input
            className="toolbar__search"
            placeholder="merchandiser@cotonex.com"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && void addMailbox()}
            spellCheck={false}
          />
          <Button variant="primary" onClick={() => void addMailbox()} disabled={!address.trim()}>
            <Plus size={16} strokeWidth={2} />
            Register
          </Button>
        </div>
        <p className="table__sub" style={{ marginTop: "var(--s-3)" }}>
          Every registered address counts as internal when classifying, so a
          colleague on a thread is never mistaken for the buyer.
        </p>
      </Card>

      <Card
        title="Sync state"
        action={
          <Button onClick={() => void load()}>
            <RefreshCw size={16} strokeWidth={2} />
            Refresh
          </Button>
        }
        flushBody
      >
        {!loaded ? (
          <EmptyState title="Loading…" />
        ) : mailboxes.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No mailboxes registered"
            hint="Add the team's addresses above, then run a backfill on one to confirm delegation works before doing the rest."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Mailbox</th>
                  <th>Status</th>
                  <th>Last sync</th>
                  <th className="table__num">Threads</th>
                  <th className="table__num">Buyers</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {mailboxes.map((mailbox) => (
                  <tr key={mailbox.id}>
                    <td>
                      <div className="table__primary">{mailbox.address}</div>
                      {mailbox.last_error && (
                        <div className="table__sub" style={{ color: "var(--c-danger)" }}>
                          {mailbox.last_error}
                        </div>
                      )}
                    </td>
                    <td>
                      <Badge tone={STATUS_TONE[mailbox.status]} dot={mailbox.status === "running"}>
                        {mailbox.status}
                      </Badge>
                      {mailbox.last_history_id && (
                        <div className="table__sub">incremental ready</div>
                      )}
                    </td>
                    <td className="table__sub">
                      {mailbox.last_synced_at
                        ? new Date(mailbox.last_synced_at).toLocaleString("en-GB")
                        : "never"}
                    </td>
                    <td className="table__num">{mailbox.threads_classified}</td>
                    <td className="table__num">{mailbox.buyers_found}</td>
                    <td>
                      <div className="table__actions">
                        <Button
                          variant="ghost"
                          disabled={busy === mailbox.id}
                          onClick={() => void sync(mailbox, "backfill", true)}
                          title="Classify without writing anything"
                        >
                          Dry run
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={busy === mailbox.id}
                          onClick={() => void sync(mailbox, "backfill", false)}
                        >
                          <Play size={16} strokeWidth={2} />
                          Backfill
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={busy === mailbox.id || !mailbox.last_history_id}
                          onClick={() => void sync(mailbox, "incremental", false)}
                          title={mailbox.last_history_id ? "Sync changes only" : "Run a backfill first"}
                        >
                          <RefreshCw size={16} strokeWidth={2} />
                        </Button>
                        <Button variant="ghost" onClick={() => void removeMailbox(mailbox.id)}>
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

      {runs.length > 0 && (
        <Card title="Recent runs" flushBody>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Mode</th>
                  <th className="table__num">Threads</th>
                  <th className="table__num">Buyers</th>
                  <th className="table__num">Review</th>
                  <th className="table__num">Discarded</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td className="table__sub">{new Date(run.started_at).toLocaleString("en-GB")}</td>
                    <td>
                      <Badge tone="neutral">{run.mode}</Badge>
                    </td>
                    <td className="table__num">{run.threads_seen}</td>
                    <td className="table__num">{run.buyers}</td>
                    <td className="table__num">{run.needs_review}</td>
                    <td className="table__num">{run.discarded}</td>
                    <td>
                      {run.error ? (
                        <Badge tone="rose">failed</Badge>
                      ) : run.finished_at ? (
                        <Badge tone="green">done</Badge>
                      ) : (
                        <Badge tone="blue" dot>
                          running
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title="Setup">
        <ol
          style={{
            listStyle: "decimal",
            paddingLeft: "1.2em",
            fontSize: "var(--fs-sm)",
            color: "var(--c-text-secondary)",
            lineHeight: 1.8,
          }}
        >
          <li>
            Admin console &rarr; Security &rarr; Access and data control &rarr; API controls &rarr;
            Manage Domain Wide Delegation. Add client ID{" "}
            <code>110856894278450739134</code> with scope{" "}
            <code>https://www.googleapis.com/auth/gmail.readonly</code> and nothing else.
          </li>
          <li>
            Put the service account JSON into the Edge Function secrets as{" "}
            <code>GOOGLE_SERVICE_ACCOUNT_KEY</code>.
          </li>
          <li>
            Give the scheduler what it needs, in the SQL editor:
            <pre
              style={{
                marginTop: "var(--s-2)",
                padding: "var(--s-3)",
                background: "var(--c-surface-sunken)",
                borderRadius: "var(--r-sm)",
                fontSize: "var(--fs-xs)",
                overflowX: "auto",
              }}
            >
{`select set_sync_secret('project_url', 'https://<ref>.supabase.co');
select set_sync_secret('service_role_key', '<service role key>');`}
            </pre>
          </li>
          <li>Register the mailboxes above, then press <strong>Dry run</strong> on one.</li>
          <li>
            A dry run classifies without writing anything, so it is the safe way
            to confirm delegation works before any mail lands in the database.
          </li>
          <li>
            Once a backfill has run, the hourly schedule takes over on its own.
          </li>
        </ol>
      </Card>
    </div>
  );
}
