-- Phase 1: the buyer intelligence and outreach schema.
--
-- Mirrors src/lib/domain/types.ts. Channel-agnostic by construction: campaigns,
-- steps and events all carry a channel so WhatsApp, SMS and voice reuse the
-- engine rather than forking it.
--
-- Every table has RLS enabled. Policies live in the next migration, so no
-- table is ever briefly readable while this one runs.

-- ----------------------------------------------------------- extensions ----

-- citext: email comparison must be case-insensitive, or the same buyer gets
-- stored twice and campaigned to twice.
-- pg_trgm: fuzzy company-name search in the contacts and companies screens.
create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------- enums ----

create type contact_status as enum (
  'never_contacted',
  'introduction_sent',
  'conversation_started',
  'buyer_replied',
  'waiting_for_buyer',
  'no_reply',
  'follow_up_required',
  'enquiry_received',
  'active_lead'
);

create type role_priority as enum ('high', 'medium', 'low');

create type source_id as enum ('email', 'dns', 'gmail', 'apollo', 'website', 'linkedin', 'manual');

create type channel as enum ('email', 'whatsapp', 'sms', 'voice');

create type campaign_kind as enum ('introduction', 'category', 'collection', 'proof', 'follow_up', 'event');

create type campaign_status as enum (
  'draft',
  'pending_approval',
  'approved',
  'scheduled',
  'running',
  'paused',
  'done'
);

create type outreach_event_type as enum (
  'queued',
  'sent',
  'delivered',
  'opened',
  'clicked',
  'replied',
  'bounced',
  'complained',
  'unsubscribed',
  'stopped'
);

create type suppression_scope as enum ('email', 'domain');

create type suppression_reason as enum ('unsubscribe', 'bounce', 'complaint', 'manual', 'human_owned');

create type queue_status as enum ('queued', 'held', 'sent', 'cancelled');

create type app_role as enum ('ceo', 'marketing', 'merchandiser', 'viewer');

-- ------------------------------------------------------------- utilities ----

create or replace function set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------- users ----

-- Mirrors auth.users so the app can carry a role without touching the auth schema.
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role app_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- Role lookup used by policies. SECURITY DEFINER so it can read profiles
-- without the policy on profiles recursing into itself.
create or replace function current_app_role()
returns app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

create or replace function can_write()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_app_role() in ('ceo', 'marketing');
$$;

-- ------------------------------------------------------------- companies ----

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text unique,
  website text,
  country_code text not null,
  country text not null,
  city text,
  industry text,
  employee_count integer check (employee_count is null or employee_count >= 0),
  verified boolean not null default false,
  sources source_id[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_country_code_format check (country_code ~ '^[A-Z]{2}$')
);

create index companies_country_code_idx on companies (country_code);
create index companies_verified_idx on companies (verified) where not verified;
create index companies_name_trgm_idx on companies using gin (name extensions.gin_trgm_ops);

create trigger companies_updated_at
  before update on companies
  for each row execute function set_updated_at();

-- -------------------------------------------------------------- contacts ----

create table contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text,
  email extensions.citext not null unique,
  phone text,
  designation text,
  role_category text,
  role_priority role_priority not null default 'medium',
  linkedin text,
  preferred_language text not null default 'en',
  status contact_status not null default 'never_contacted',
  last_touch_at timestamptz,
  last_reply_at timestamptz,
  -- campaign_id -> zero-based index of the next step owed to this contact.
  sequence_position jsonb not null default '{}'::jsonb,
  verified boolean not null default false,
  sources source_id[] not null default '{}',
  do_not_contact boolean not null default false,
  call_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contacts_sequence_position_is_object check (jsonb_typeof(sequence_position) = 'object')
);

create index contacts_company_id_idx on contacts (company_id);
create index contacts_status_idx on contacts (status);
create index contacts_role_priority_idx on contacts (role_priority) where role_priority = 'high';
create index contacts_sequence_position_idx on contacts using gin (sequence_position);
-- The campaign engine's hot path: eligible, reachable contacts.
create index contacts_campaignable_idx on contacts (company_id, status)
  where verified and not do_not_contact;

create trigger contacts_updated_at
  before update on contacts
  for each row execute function set_updated_at();

-- ------------------------------------------------------- merge candidates ----

create table merge_candidates (
  id uuid primary key default gen_random_uuid(),
  reason text not null,
  score numeric(4, 3) not null check (score between 0 and 1),
  contact_a uuid not null references contacts (id) on delete cascade,
  contact_b uuid not null references contacts (id) on delete cascade,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint merge_candidates_distinct check (contact_a <> contact_b),
  -- Ordered pair, so (a,b) and (b,a) cannot both be queued.
  constraint merge_candidates_ordered check (contact_a < contact_b),
  unique (contact_a, contact_b)
);

create index merge_candidates_open_idx on merge_candidates (created_at) where resolved_at is null;

-- ------------------------------------------------------------- templates ----

create table templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind campaign_kind not null,
  channel channel not null default 'email',
  language text not null default 'en',
  subject text not null default '',
  body text not null,
  attachments text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index templates_kind_channel_idx on templates (kind, channel, language);

create trigger templates_updated_at
  before update on templates
  for each row execute function set_updated_at();

-- ------------------------------------------------------------- campaigns ----

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind campaign_kind not null,
  channel channel not null default 'email',
  status campaign_status not null default 'draft',
  country_codes text[] not null default '{}',
  target_statuses contact_status[] not null default '{never_contacted}',
  approved_by uuid references profiles (id) on delete set null,
  approved_at timestamptz,
  scheduled_from timestamptz,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Requirement 17: an approved campaign must carry who approved it.
  constraint campaigns_approval_is_recorded check (
    status in ('draft', 'pending_approval')
    or (approved_by is not null and approved_at is not null)
  ),
  -- Requirement 20: a campaign can never target a buyer the sales team owns.
  constraint campaigns_never_target_human_owned check (
    not (target_statuses && array['buyer_replied', 'enquiry_received', 'active_lead']::contact_status[])
  )
);

create index campaigns_status_idx on campaigns (status);
create index campaigns_country_codes_idx on campaigns using gin (country_codes);

create trigger campaigns_updated_at
  before update on campaigns
  for each row execute function set_updated_at();

-- --------------------------------------------------------- sequence steps ----

create table sequence_steps (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  step_order integer not null check (step_order >= 1),
  channel channel not null default 'email',
  kind campaign_kind not null,
  template_id uuid not null references templates (id) on delete restrict,
  delay_days integer not null default 0 check (delay_days between 0 and 365),
  created_at timestamptz not null default now(),
  unique (campaign_id, step_order)
);

create index sequence_steps_campaign_idx on sequence_steps (campaign_id, step_order);

-- The first step must send immediately; later steps must wait.
create or replace function check_step_delay()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.step_order = 1 and new.delay_days <> 0 then
    raise exception 'The first step of a sequence must have delay_days = 0';
  end if;
  if new.step_order > 1 and new.delay_days < 1 then
    raise exception 'Steps after the first must wait at least one day';
  end if;
  return new;
end;
$$;

create trigger sequence_steps_delay
  before insert or update on sequence_steps
  for each row execute function check_step_delay();

-- -------------------------------------------------------- outreach events ----

create table outreach_events (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts (id) on delete cascade,
  campaign_id uuid references campaigns (id) on delete set null,
  step_id uuid references sequence_steps (id) on delete set null,
  channel channel not null default 'email',
  type outreach_event_type not null,
  detail text,
  provider_message_id text,
  occurred_at timestamptz not null default now()
);

create index outreach_events_contact_idx on outreach_events (contact_id, occurred_at desc);
create index outreach_events_campaign_idx on outreach_events (campaign_id, occurred_at desc);
create index outreach_events_type_idx on outreach_events (type, occurred_at desc);
-- Providers retry webhooks, so the same delivery must not log twice.
create unique index outreach_events_provider_dedupe_idx
  on outreach_events (provider_message_id, type)
  where provider_message_id is not null;

-- ----------------------------------------------------------- send queue ----

create table send_queue (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts (id) on delete cascade,
  campaign_id uuid not null references campaigns (id) on delete cascade,
  step_id uuid not null references sequence_steps (id) on delete cascade,
  channel channel not null default 'email',
  send_at_utc timestamptz not null,
  status queue_status not null default 'queued',
  held_reason text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  -- A contact can only be queued once per step.
  unique (contact_id, step_id)
);

create index send_queue_due_idx on send_queue (send_at_utc) where status = 'queued';

-- ----------------------------------------------------------- suppressions ----

create table suppressions (
  id uuid primary key default gen_random_uuid(),
  value extensions.citext not null,
  scope suppression_scope not null default 'email',
  reason suppression_reason not null,
  created_at timestamptz not null default now(),
  unique (value, scope)
);

-- -------------------------------------------------------------- handoffs ----

create table handoffs (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts (id) on delete cascade,
  campaign_id uuid references campaigns (id) on delete set null,
  reason text not null,
  resolved boolean not null default false,
  resolved_by uuid references profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- Requirement 20: one open handoff per buyer, never a stack of duplicates.
create unique index handoffs_one_open_per_contact_idx
  on handoffs (contact_id)
  where not resolved;

create index handoffs_open_idx on handoffs (created_at desc) where not resolved;

-- ------------------------------------------------------ the reply-stop rule ----

-- The rule enforced in the database, not only in application code: a reply
-- halts every queued message for that buyer, suppresses them, and raises a
-- handoff. Whatever writes the reply - webhook, import, or a person - the
-- consequences follow.
create or replace function handle_buyer_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_email extensions.citext;
begin
  if new.type <> 'replied' then
    return new;
  end if;

  select email into target_email from public.contacts where id = new.contact_id;

  update public.contacts
     set status = 'buyer_replied',
         last_reply_at = new.occurred_at
   where id = new.contact_id
     and status not in ('enquiry_received', 'active_lead');

  update public.send_queue
     set status = 'cancelled',
         held_reason = 'Buyer replied - sequence halted'
   where contact_id = new.contact_id
     and status in ('queued', 'held');

  insert into public.suppressions (value, scope, reason)
  values (target_email, 'email', 'human_owned')
  on conflict (value, scope) do nothing;

  insert into public.handoffs (contact_id, campaign_id, reason)
  values (
    new.contact_id,
    new.campaign_id,
    coalesce(nullif(new.detail, ''), 'Buyer replied - needs a human response')
  )
  on conflict (contact_id) where not resolved
  do update set reason = excluded.reason;

  insert into public.outreach_events (contact_id, campaign_id, channel, type, detail)
  values (
    new.contact_id,
    new.campaign_id,
    new.channel,
    'stopped',
    'Buyer replied - sequence halted, handed to sales'
  );

  return new;
end;
$$;

create trigger outreach_events_buyer_reply
  after insert on outreach_events
  for each row execute function handle_buyer_reply();

-- --------------------------------------------------------------- new user ----

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ------------------------------------------------------------------- RLS ----

-- Enabled here with no policies, so every table denies by default until the
-- policy migration runs.
alter table profiles enable row level security;
alter table companies enable row level security;
alter table contacts enable row level security;
alter table merge_candidates enable row level security;
alter table templates enable row level security;
alter table campaigns enable row level security;
alter table sequence_steps enable row level security;
alter table outreach_events enable row level security;
alter table send_queue enable row level security;
alter table suppressions enable row level security;
alter table handoffs enable row level security;
