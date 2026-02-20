create index if not exists clients_workspace_id_idx
on public.clients(workspace_id);

create index if not exists invoices_client_id_idx
on public.invoices(client_id);

create index if not exists invoice_contacts_invoice_id_idx
on public.invoice_contacts(invoice_id);

create index if not exists message_events_invoice_id_idx
on public.message_events(invoice_id);

create index if not exists payments_workspace_id_idx
on public.payments(workspace_id);

create index if not exists audit_logs_workspace_id_idx
on public.audit_logs(workspace_id);

drop index if exists public.workspace_members_workspace_user_idx;

drop policy if exists workspaces_insert_authenticated on public.workspaces;
create policy workspaces_insert_authenticated
  on public.workspaces
  for insert
  to authenticated
  with check ((select auth.uid()) is not null);

drop policy if exists workspaces_delete_owner on public.workspaces;
create policy workspaces_delete_owner
  on public.workspaces
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = workspaces.id
        and wm.user_id = (select auth.uid())
        and wm.role = 'owner'
    )
  );

drop policy if exists workspace_members_insert_bootstrap_or_admin on public.workspace_members;
create policy workspace_members_insert_bootstrap_or_admin
  on public.workspace_members
  for insert
  to authenticated
  with check (
    (
      user_id = (select auth.uid())
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

drop policy if exists workspace_members_delete_owner on public.workspace_members;
create policy workspace_members_delete_owner
  on public.workspace_members
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = (select auth.uid())
        and wm.role = 'owner'
    )
  );
