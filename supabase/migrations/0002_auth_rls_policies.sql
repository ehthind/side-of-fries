create index if not exists workspace_members_workspace_user_idx
on public.workspace_members(workspace_id, user_id);

create unique index if not exists workspace_members_workspace_user_unique_idx
on public.workspace_members(workspace_id, user_id)
where user_id is not null;

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_admin(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  );
$$;

create or replace function public.bootstrap_workspace_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  insert into public.workspace_members (
    workspace_id,
    user_id,
    email,
    role
  )
  values (
    new.id,
    auth.uid(),
    coalesce(nullif(auth.jwt() ->> 'email', ''), 'unknown@example.com'),
    'owner'
  )
  on conflict do nothing;

  return new;
end;
$$;

grant execute on function public.is_workspace_member(uuid) to authenticated, anon;
grant execute on function public.is_workspace_admin(uuid) to authenticated, anon;

drop trigger if exists on_workspace_created_add_owner on public.workspaces;
create trigger on_workspace_created_add_owner
  after insert on public.workspaces
  for each row
  execute function public.bootstrap_workspace_owner();

drop policy if exists workspaces_read_own on public.workspaces;
drop policy if exists workspaces_select_member on public.workspaces;
drop policy if exists workspaces_insert_authenticated on public.workspaces;
drop policy if exists workspaces_update_admin on public.workspaces;
drop policy if exists workspaces_delete_owner on public.workspaces;

create policy workspaces_select_member
  on public.workspaces
  for select
  to authenticated
  using (public.is_workspace_member(id));

create policy workspaces_insert_authenticated
  on public.workspaces
  for insert
  to authenticated
  with check (auth.uid() is not null);

create policy workspaces_update_admin
  on public.workspaces
  for update
  to authenticated
  using (public.is_workspace_admin(id))
  with check (public.is_workspace_admin(id));

create policy workspaces_delete_owner
  on public.workspaces
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = workspaces.id
        and wm.user_id = auth.uid()
        and wm.role = 'owner'
    )
  );

drop policy if exists workspace_members_select_member on public.workspace_members;
drop policy if exists workspace_members_insert_bootstrap_or_admin on public.workspace_members;
drop policy if exists workspace_members_update_admin on public.workspace_members;
drop policy if exists workspace_members_delete_owner on public.workspace_members;

create policy workspace_members_select_member
  on public.workspace_members
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy workspace_members_insert_bootstrap_or_admin
  on public.workspace_members
  for insert
  to authenticated
  with check (
    (
      user_id = auth.uid()
      and role = 'owner'
      and not exists (
        select 1
        from public.workspace_members existing
        where existing.workspace_id = workspace_members.workspace_id
      )
    )
    or (
      public.is_workspace_admin(workspace_id)
      and role in ('admin', 'member')
    )
  );

create policy workspace_members_update_admin
  on public.workspace_members
  for update
  to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

create policy workspace_members_delete_owner
  on public.workspace_members
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and wm.role = 'owner'
    )
  );

drop policy if exists clients_workspace_access on public.clients;
create policy clients_workspace_access
  on public.clients
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists invoices_workspace_access on public.invoices;
create policy invoices_workspace_access
  on public.invoices
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists invoice_contacts_workspace_access on public.invoice_contacts;
create policy invoice_contacts_workspace_access
  on public.invoice_contacts
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.invoices i
      where i.id = invoice_contacts.invoice_id
        and public.is_workspace_member(i.workspace_id)
    )
  )
  with check (
    exists (
      select 1
      from public.invoices i
      where i.id = invoice_contacts.invoice_id
        and public.is_workspace_member(i.workspace_id)
    )
  );

drop policy if exists escalation_policies_workspace_access on public.escalation_policies;
create policy escalation_policies_workspace_access
  on public.escalation_policies
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists escalation_runs_workspace_access on public.escalation_runs;
create policy escalation_runs_workspace_access
  on public.escalation_runs
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.invoices i
      where i.id = escalation_runs.invoice_id
        and public.is_workspace_member(i.workspace_id)
    )
  )
  with check (
    exists (
      select 1
      from public.invoices i
      where i.id = escalation_runs.invoice_id
        and public.is_workspace_member(i.workspace_id)
    )
  );

drop policy if exists escalation_steps_workspace_access on public.escalation_steps;
create policy escalation_steps_workspace_access
  on public.escalation_steps
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.escalation_runs r
      join public.invoices i on i.id = r.invoice_id
      where r.id = escalation_steps.run_id
        and public.is_workspace_member(i.workspace_id)
    )
  )
  with check (
    exists (
      select 1
      from public.escalation_runs r
      join public.invoices i on i.id = r.invoice_id
      where r.id = escalation_steps.run_id
        and public.is_workspace_member(i.workspace_id)
    )
  );

drop policy if exists message_templates_workspace_access on public.message_templates;
create policy message_templates_workspace_access
  on public.message_templates
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists message_events_workspace_access on public.message_events;
create policy message_events_workspace_access
  on public.message_events
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.invoices i
      where i.id = message_events.invoice_id
        and public.is_workspace_member(i.workspace_id)
    )
  )
  with check (
    exists (
      select 1
      from public.invoices i
      where i.id = message_events.invoice_id
        and public.is_workspace_member(i.workspace_id)
    )
  );

drop policy if exists legal_packets_workspace_access on public.legal_packets;
create policy legal_packets_workspace_access
  on public.legal_packets
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.invoices i
      where i.id = legal_packets.invoice_id
        and public.is_workspace_member(i.workspace_id)
    )
  )
  with check (
    exists (
      select 1
      from public.invoices i
      where i.id = legal_packets.invoice_id
        and public.is_workspace_member(i.workspace_id)
    )
  );

drop policy if exists payments_workspace_access on public.payments;
create policy payments_workspace_access
  on public.payments
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists audit_logs_workspace_access on public.audit_logs;
create policy audit_logs_workspace_access
  on public.audit_logs
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
