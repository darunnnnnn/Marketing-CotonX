-- Row level security policies.
--
-- Shape: any signed-in employee may read the buyer database; only ceo and
-- marketing may change it. Nothing is readable anonymously - this is a
-- company's commercial contact list, not public data.
--
-- auth.uid() is wrapped in a scalar subquery throughout so Postgres evaluates
-- it once per statement rather than once per row.

-- ------------------------------------------------------------- profiles ----

create policy "signed-in users read all profiles"
  on profiles for select
  to authenticated
  using (true);

create policy "users update their own profile"
  on profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Only the CEO assigns roles, and nobody escalates their own.
create policy "ceo manages profiles"
  on profiles for all
  to authenticated
  using (current_app_role() = 'ceo')
  with check (current_app_role() = 'ceo');

-- --------------------------------------------- buyer data: read for all ----

create policy "signed-in users read companies"
  on companies for select to authenticated using (true);

create policy "signed-in users read contacts"
  on contacts for select to authenticated using (true);

create policy "signed-in users read merge candidates"
  on merge_candidates for select to authenticated using (true);

create policy "signed-in users read templates"
  on templates for select to authenticated using (true);

create policy "signed-in users read campaigns"
  on campaigns for select to authenticated using (true);

create policy "signed-in users read sequence steps"
  on sequence_steps for select to authenticated using (true);

create policy "signed-in users read outreach events"
  on outreach_events for select to authenticated using (true);

create policy "signed-in users read the send queue"
  on send_queue for select to authenticated using (true);

create policy "signed-in users read suppressions"
  on suppressions for select to authenticated using (true);

create policy "signed-in users read handoffs"
  on handoffs for select to authenticated using (true);

-- -------------------------------------- buyer data: write for operators ----

create policy "operators write companies"
  on companies for all to authenticated
  using (can_write()) with check (can_write());

create policy "operators write contacts"
  on contacts for all to authenticated
  using (can_write()) with check (can_write());

create policy "operators write merge candidates"
  on merge_candidates for all to authenticated
  using (can_write()) with check (can_write());

create policy "operators write templates"
  on templates for all to authenticated
  using (can_write()) with check (can_write());

create policy "operators write sequence steps"
  on sequence_steps for all to authenticated
  using (can_write()) with check (can_write());

create policy "operators write the send queue"
  on send_queue for all to authenticated
  using (can_write()) with check (can_write());

create policy "operators write suppressions"
  on suppressions for all to authenticated
  using (can_write()) with check (can_write());

-- Anyone signed in can close out a handoff; that is sales work, not admin.
create policy "signed-in users resolve handoffs"
  on handoffs for update to authenticated
  using (true) with check (true);

create policy "operators create handoffs"
  on handoffs for insert to authenticated
  with check (can_write());

-- ------------------------------------------------------------ campaigns ----

create policy "operators create campaigns"
  on campaigns for insert to authenticated
  with check (can_write());

create policy "operators delete campaigns"
  on campaigns for delete to authenticated
  using (can_write() and status in ('draft', 'pending_approval'));

-- Requirement 17: approval is a second pair of eyes. Marketing may edit and
-- submit; only the CEO may move a campaign into an approved state. The
-- WITH CHECK clause is what actually stops a submitter approving their own work.
create policy "operators edit campaigns"
  on campaigns for update
  to authenticated
  using (can_write())
  with check (
    can_write()
    and (
      status in ('draft', 'pending_approval')
      or current_app_role() = 'ceo'
    )
  );

-- -------------------------------------------------------------- events ----

-- Events are an append-only audit trail. Nobody edits or deletes history,
-- so there is deliberately no update or delete policy.
create policy "operators append outreach events"
  on outreach_events for insert to authenticated
  with check (can_write());

-- ---------------------------------------------------------------- notes ----

comment on policy "operators edit campaigns" on campaigns is
  'Marketing may edit a draft or submit it for approval. Only the CEO can move a campaign past pending_approval, so nobody approves their own campaign.';

comment on table outreach_events is
  'Append-only. No update or delete policy exists by design: this is the audit trail behind every claim about what was sent to a buyer.';

comment on function handle_buyer_reply is
  'Requirement 20, enforced in the database. A replied event cancels queued sends, suppresses the address, and raises a handoff - whatever wrote the event.';
