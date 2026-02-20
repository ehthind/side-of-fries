create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  plan text not null default 'trial',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid,
  email text not null,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  primary_email text,
  primary_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  invoice_number text not null,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'USD',
  issue_date date,
  due_date date not null,
  status text not null default 'new' check (status in ('new', 'at_risk', 'in_recovery', 'paused', 'paid', 'closed_unresolved')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists invoices_workspace_invoice_number_idx
on public.invoices(workspace_id, invoice_number);

create table if not exists public.invoice_contacts (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms')),
  value text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.escalation_policies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade unique,
  send_email boolean not null default true,
  send_sms boolean not null default true,
  days_between_steps integer not null default 4 check (days_between_steps between 1 and 30),
  require_approval boolean not null default true,
  tone text not null default 'conservative' check (tone in ('conservative', 'balanced', 'assertive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.escalation_runs (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade unique,
  state text not null default 'new' check (state in ('new', 'awaiting_approval', 'scheduled', 'paused', 'completed')),
  current_stage text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.escalation_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.escalation_runs(id) on delete cascade,
  stage text not null check (stage in ('polite_nudge', 'firm_follow_up', 'collections_warning', 'small_claims_template')),
  channel text not null check (channel in ('email', 'sms')),
  status text not null default 'drafted' check (status in ('drafted', 'awaiting_approval', 'scheduled', 'sent', 'acknowledged', 'failed')),
  preview_body text,
  scheduled_for timestamptz,
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique(run_id, stage, channel)
);

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  stage text not null check (stage in ('polite_nudge', 'firm_follow_up', 'collections_warning', 'small_claims_template')),
  channel text not null check (channel in ('email', 'sms')),
  body text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, stage, channel)
);

create table if not exists public.message_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  stage text,
  channel text not null check (channel in ('email', 'sms')),
  direction text not null check (direction in ('outbound', 'inbound')),
  body text not null,
  provider_message_id text,
  delivery_state text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.legal_packets (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade unique,
  jurisdiction text not null,
  content text not null,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.clients enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_contacts enable row level security;
alter table public.escalation_policies enable row level security;
alter table public.escalation_runs enable row level security;
alter table public.escalation_steps enable row level security;
alter table public.message_templates enable row level security;
alter table public.message_events enable row level security;
alter table public.legal_packets enable row level security;
alter table public.payments enable row level security;
alter table public.audit_logs enable row level security;

-- Base policy placeholder (service role bypasses RLS).
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'workspaces'
      and policyname = 'workspaces_read_own'
  ) then
    create policy workspaces_read_own
      on public.workspaces
      for select
      using (true);
  end if;
end $$;
