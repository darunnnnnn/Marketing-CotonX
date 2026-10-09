import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Inbox, Play, Plus, RefreshCw, Trash2 } from "lucide-react";
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
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  /* With no project configured there is nothing to fetch, so the screen is
     already in its final state. */
  const [loaded, setLoaded] = useState(!configured);

  const load = useCallback(async () => {
    if (!configured) return;
    const [boxes, history] = await Promise.all([
      supabase.from("mailboxes").select("*").order("address"),
      supabase.from("mailbox_sync_runs").select("*").order("started_at", { ascending: false }).limit(10),
    ]);
    if (boxes.error) setProblem(boxes.error.message);
    setMailboxes((boxes.data as Mailbox[]) ?? []);
    setRuns((history.data as SyncRun[]) ?? []);
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
            Put the service account JSON key into the Edge Function secrets as{" "}
            <code>GOOGLE_SERVICE_ACCOUNT_KEY</code>.
          </li>
          <li>Register one mailbox above and press <strong>Dry run</strong>.</li>
          <li>
            A dry run classifies without writing anything, so it is the safe way
            to confirm delegation works and see what the classifier makes of
            real mail before any of it lands in the database.
          </li>
        </ol>
      </Card>
    </div>
  );
}
