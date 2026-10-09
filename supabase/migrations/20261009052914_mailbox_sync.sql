-- Mailbox ingestion state for the Gmail API route.
--
-- The Takeout route needs none of this: a person uploads a file and the work
-- happens in their browser. The API route runs unattended, so it needs to know
-- which mailboxes to read, where each one got to, and what happened last time.

create type mailbox_sync_status as enum ('idle', 'running', 'error', 'disabled');

create table mailboxes (
  id uuid primary key default gen_random_uuid(),
  address extensions.citext not null unique,
  display_name text,
  -- Impersonation is per mailbox, so one failure must not stop the others.
  enabled boolean not null default true,
  status mailbox_sync_status not null default 'idle',
  -- Gmail's incremental cursor. Null means a full backfill has not run yet.
  last_history_id text,
  last_synced_at timestamptz,
  last_error text,
  -- Running totals, so the UI can show progress without counting rows.
  threads_seen integer not null default 0,
  threads_classified integer not null default 0,
  buyers_found integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mailboxes_address_is_email check (address ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

create trigger mailboxes_updated_at
  before update on mailboxes
  for each row execute function set_updated_at();

-- One row per sync attempt. Keeps a history of what each run did, which is
-- what you want when someone asks why a buyer was or was not picked up.
create table mailbox_sync_runs (
  id uuid primary key default gen_random_uuid(),
  mailbox_id uuid not null references mailboxes (id) on delete cascade,
  mode text not null check (mode in ('backfill', 'incremental')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  threads_seen integer not null default 0,
  buyers integer not null default 0,
  needs_review integer not null default 0,
  discarded integer not null default 0,
  error text
);

create index mailbox_sync_runs_mailbox_idx on mailbox_sync_runs (mailbox_id, started_at desc);

-- Which thread produced which contact, and why. Without this a classification
-- is an opinion with no evidence behind it; with it, every buyer record can be
-- traced back to the conversation and the signals that created it.
create table ingested_threads (
  id uuid primary key default gen_random_uuid(),
  mailbox_id uuid references mailboxes (id) on delete set null,
  -- Gmail thread id, or the mbox union-find key.
  external_id text not null,
  source source_id not null default 'gmail',
  contact_id uuid references contacts (id) on delete set null,
  counterparty_email extensions.citext,
  verdict text not null check (verdict in ('buyer', 'review', 'not_buyer')),
  score integer not null,
  excluded_reason text,
  -- The scoring breakdown, kept verbatim so a verdict can be explained later.
  signals jsonb not null default '[]'::jsonb,
  message_count integer not null default 0,
  first_message_at timestamptz,
  last_message_at timestamptz,
  -- A human overruling the classifier. Null means nobody has looked.
  reviewed_verdict text check (reviewed_verdict in ('buyer', 'not_buyer')),
  reviewed_by uuid references profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source, external_id)
);

create index ingested_threads_verdict_idx on ingested_threads (verdict);
create index ingested_threads_counterparty_idx on ingested_threads (counterparty_email);
create index ingested_threads_review_queue_idx on ingested_threads (created_at desc)
  where verdict = 'review' and reviewed_verdict is null;

-- Reviewed threads are the training set for a classifier later. Worth saying
-- out loud so nobody treats this table as disposable.
comment on table ingested_threads is
  'Every classified thread with the signals that produced its verdict. Human corrections in reviewed_verdict are labelled data - the training set for a statistical classifier once enough threads have been reviewed.';

comment on column mailboxes.last_history_id is
  'Gmail historyId cursor. Incremental sync asks only for changes since this point, so a daily run costs a fraction of the backfill. Gmail expires these after about a week of inactivity, in which case the sync falls back to a date-bounded query.';

alter table mailboxes enable row level security;
alter table mailbox_sync_runs enable row level security;
alter table ingested_threads enable row level security;

create policy "signed-in users read mailboxes"
  on mailboxes for select to authenticated using (true);

create policy "operators manage mailboxes"
  on mailboxes for all to authenticated
  using (can_write()) with check (can_write());

create policy "signed-in users read sync runs"
  on mailbox_sync_runs for select to authenticated using (true);

create policy "signed-in users read ingested threads"
  on ingested_threads for select to authenticated using (true);

-- Anyone signed in may correct a classification; that is the review queue's
-- whole purpose and it should not need an operator role.
create policy "signed-in users review ingested threads"
  on ingested_threads for update to authenticated
  using (true) with check (true);

create policy "operators write ingested threads"
  on ingested_threads for insert to authenticated
  with check (can_write());
