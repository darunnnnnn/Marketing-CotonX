-- Unattended Gmail sync.
--
-- New buyer mail arrives every day, so ingestion has to run on its own rather
-- than when someone remembers to press a button.
--
-- Shape: pg_cron fires a dispatcher, which posts one asynchronous request per
-- enabled mailbox through pg_net. Nothing is awaited, so ten mailboxes cannot
-- add up to an Edge Function timeout, and one failing mailbox cannot stop the
-- others.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- --------------------------------------------------------------- config ----

-- The dispatcher needs the project URL and a service role key. Both are
-- secrets, so they live in Vault rather than in this file or in a table.
create or replace function set_sync_secret(secret_name text, secret_value text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if secret_name not in ('project_url', 'service_role_key') then
    raise exception 'Unknown secret %', secret_name;
  end if;

  -- Replace rather than accumulate, so rotating a key does not leave the old
  -- one readable.
  delete from vault.secrets where name = secret_name;
  perform vault.create_secret(secret_value, secret_name);
end;
$$;

comment on function set_sync_secret is
  'Stores the project URL and service role key the scheduled sync needs. Call it once per project: select set_sync_secret(''project_url'', ''https://<ref>.supabase.co''); and the same for service_role_key.';

revoke all on function set_sync_secret(text, text) from public, anon, authenticated;

-- ----------------------------------------------------------- dispatcher ----

create or replace function dispatch_gmail_sync(sync_mode text default 'incremental')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_url text;
  service_key text;
  mailbox record;
  dispatched integer := 0;
begin
  select decrypted_secret into project_url
    from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into service_key
    from vault.decrypted_secrets where name = 'service_role_key';

  if project_url is null or service_key is null then
    raise exception
      'Scheduled sync is not configured. Run set_sync_secret for project_url and service_role_key.';
  end if;

  for mailbox in
    select address from public.mailboxes
    -- A mailbox left in 'running' is either mid-sync or crashed; either way,
    -- starting a second run against it would double-count and race.
    where enabled and status <> 'running'
    order by coalesce(last_synced_at, 'epoch'::timestamptz)
  loop
    perform extensions.net.http_post(
      url := project_url || '/functions/v1/gmail-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object(
        'mailbox', mailbox.address,
        'mode', sync_mode,
        'maxThreads', case when sync_mode = 'backfill' then 500 else 200 end
      ),
      timeout_milliseconds := 120000
    );
    dispatched := dispatched + 1;
  end loop;

  return dispatched;
end;
$$;

comment on function dispatch_gmail_sync is
  'Posts one asynchronous sync request per enabled mailbox. Returns how many were dispatched. Oldest sync first, so a mailbox cannot be starved.';

revoke all on function dispatch_gmail_sync(text) from public, anon;
-- Operators may trigger a sync from the UI; the RLS helper decides who that is.
grant execute on function dispatch_gmail_sync(text) to authenticated;

-- ------------------------------------------------------------- schedule ----

-- Hourly rather than once a day: a buyer who replies in the morning should not
-- wait until tomorrow to appear, and an incremental run only asks Gmail what
-- changed since the last cursor, so the cost is small.
select cron.schedule(
  'gmail-sync-hourly',
  '7 * * * *',
  $$select public.dispatch_gmail_sync('incremental')$$
);

-- A mailbox whose history cursor expired falls back to a date-bounded query,
-- so a weekly sweep also repairs anything the hourly runs missed.
select cron.schedule(
  'gmail-sync-weekly-sweep',
  '15 3 * * 0',
  $$select public.dispatch_gmail_sync('backfill')$$
);

-- ------------------------------------------------------------ stuck runs ----

-- An Edge Function that dies mid-run leaves its mailbox marked 'running', and
-- the dispatcher skips those - so without this, one crash stops that mailbox
-- syncing forever.
create or replace function release_stuck_mailboxes()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  released integer;
begin
  with stuck as (
    update public.mailboxes
       set status = 'error',
           last_error = 'Sync did not report back; released automatically.'
     where status = 'running'
       and coalesce(last_synced_at, created_at) < now() - interval '30 minutes'
    returning 1
  )
  select count(*) into released from stuck;

  update public.mailbox_sync_runs
     set finished_at = now(),
         error = 'Sync did not report back; released automatically.'
   where finished_at is null
     and started_at < now() - interval '30 minutes';

  return released;
end;
$$;

revoke all on function release_stuck_mailboxes() from public, anon;

select cron.schedule(
  'release-stuck-mailboxes',
  '*/20 * * * *',
  $$select public.release_stuck_mailboxes()$$
);

-- ---------------------------------------------------------- readable view ----

-- cron.job is not readable by the app's roles, so expose just what the UI
-- needs to show the schedule.
create or replace view sync_schedule
with (security_invoker = true)
as
select jobname as name,
       schedule,
       active
from cron.job
where jobname like 'gmail-sync%' or jobname = 'release-stuck-mailboxes';

grant select on sync_schedule to authenticated;
