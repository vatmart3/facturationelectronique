-- PASTILLE · Phase 9 · Plateforme agréée : transmission, cycle de vie, réception, e-reporting

-- Réglages de l'organisation auprès de sa plateforme agréée.
alter table public.organizations
  add column pa_provider text not null default 'simulee' check (pa_provider in ('simulee', 'afnor')),
  add column pa_account_id text check (pa_account_id is null or length(pa_account_id) <= 120),
  add column pa_auto_transmit boolean not null default false,
  add column pa_mandate_at timestamptz,
  -- Fréquence de l'e-reporting : décade (réel normal), mois (réel simplifié), bimestre (franchise).
  add column ereporting_frequency text not null default 'mois' check (ereporting_frequency in ('decade', 'mois', 'bimestre'));

grant update (pa_provider, pa_account_id, pa_auto_transmit, pa_mandate_at, ereporting_frequency) on table public.organizations to authenticated;

-- ---------------------------------------------------------------------------
-- Transmissions des factures émises et cycle de vie
-- ---------------------------------------------------------------------------

create table public.einvoice_transmissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  document_id uuid not null,
  provider text not null,
  flow_id text,
  format text not null check (format in ('factur-x', 'cii', 'ubl')),
  -- Code du cycle de vie (200 déposée … 213 rejetée) et libellé.
  status_code integer not null default 200,
  status_label text not null default 'Déposée',
  history jsonb not null default '[]'::jsonb,
  error text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  sent_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (document_id, organization_id) references public.documents (id, organization_id) on delete restrict
);

create index einvoice_transmissions_document_idx on public.einvoice_transmissions (document_id, organization_id);
create index einvoice_transmissions_flow_idx on public.einvoice_transmissions (provider, flow_id);
create index einvoice_transmissions_created_by_idx on public.einvoice_transmissions (created_by);
create trigger einvoice_transmissions_updated_at before update on public.einvoice_transmissions
for each row execute function private.set_updated_at();

revoke all on table public.einvoice_transmissions from anon, authenticated;
grant select, insert, update on table public.einvoice_transmissions to authenticated;
alter table public.einvoice_transmissions enable row level security;
create policy einvoice_transmissions_select on public.einvoice_transmissions for select to authenticated using (private.is_member(organization_id));
create policy einvoice_transmissions_insert on public.einvoice_transmissions for insert to authenticated with check (private.peut_editer(organization_id));
create policy einvoice_transmissions_update on public.einvoice_transmissions for update to authenticated
  using (private.peut_editer(organization_id)) with check (private.peut_editer(organization_id));

-- ---------------------------------------------------------------------------
-- Factures reçues des fournisseurs
-- ---------------------------------------------------------------------------

create table public.received_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null,
  flow_id text not null,
  format text not null check (format in ('factur-x', 'cii', 'ubl')),
  type_code text not null default '380',
  number text not null check (length(number) <= 60),
  issue_date date not null,
  due_date date,
  seller_name text not null check (length(seller_name) <= 200),
  seller_siren text,
  seller_vat text,
  currency char(3) not null default 'EUR',
  total_ht bigint not null,
  total_vat bigint not null,
  total_ttc bigint not null,
  amount_due bigint not null,
  vat_breakdown jsonb not null default '[]'::jsonb,
  lines jsonb not null default '[]'::jsonb,
  xml text not null,
  status text not null default 'a_traiter' check (status in ('a_traiter', 'approuvee', 'refusee', 'litige', 'payee')),
  status_code integer not null default 203,
  motive text check (motive is null or length(motive) <= 500),
  history jsonb not null default '[]'::jsonb,
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, flow_id)
);

create index received_invoices_org_idx on public.received_invoices (organization_id, received_at desc);
create trigger received_invoices_updated_at before update on public.received_invoices
for each row execute function private.set_updated_at();

revoke all on table public.received_invoices from anon, authenticated;
grant select, insert on table public.received_invoices to authenticated;
-- Seuls le statut et son motif évoluent : le contenu reçu reste celui du fournisseur.
grant update (status, status_code, motive, history) on table public.received_invoices to authenticated;
alter table public.received_invoices enable row level security;
create policy received_invoices_select on public.received_invoices for select to authenticated using (private.is_member(organization_id));
create policy received_invoices_insert on public.received_invoices for insert to authenticated with check (private.peut_editer(organization_id));
create policy received_invoices_update on public.received_invoices for update to authenticated
  using (private.peut_editer(organization_id)) with check (private.peut_editer(organization_id));

-- ---------------------------------------------------------------------------
-- E-reporting (transactions B2C / internationales et paiements)
-- ---------------------------------------------------------------------------

create table public.ereporting_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null check (kind in ('transactions', 'paiements')),
  period_start date not null,
  period_end date not null,
  provider text not null,
  flow_id text,
  status text not null default 'depose' check (status in ('depose', 'accepte', 'rejete')),
  summary jsonb not null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  sent_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (organization_id, kind, period_start, period_end)
);

create index ereporting_reports_created_by_idx on public.ereporting_reports (created_by);

revoke all on table public.ereporting_reports from anon, authenticated;
grant select, insert on table public.ereporting_reports to authenticated;
alter table public.ereporting_reports enable row level security;
create policy ereporting_reports_select on public.ereporting_reports for select to authenticated using (private.is_member(organization_id));
create policy ereporting_reports_insert on public.ereporting_reports for insert to authenticated with check (private.peut_editer(organization_id));
