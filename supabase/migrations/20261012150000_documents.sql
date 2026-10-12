-- PASTILLE · Phase 4 · Documents (devis, factures, acomptes, avoirs), lignes, TVA,
-- taux de TVA et mentions légales de référence.
-- Les champs d'émission (numéro, empreintes, instantanés) sont posés ici et remplis en phase 5.

create type public.document_type as enum ('facture', 'devis', 'acompte', 'avoir');
create type public.document_status as enum (
  'brouillon',          -- modifiable
  'emis',               -- facture/acompte/avoir émis, numéro attribué, contenu figé
  'envoye',             -- émis et transmis au client
  'partiellement_paye',
  'paye',
  'annule',             -- annulé par un avoir total
  'accepte', 'refuse', 'expire', 'transforme'  -- devis
);

-- ---------------------------------------------------------------------------
-- Référentiels globaux : taux de TVA et mentions légales
-- ---------------------------------------------------------------------------

create table public.vat_rates (
  id uuid primary key default gen_random_uuid(),
  territory text not null check (territory in ('metropole', 'corse', 'dom')),
  label text not null check (length(label) <= 60),
  rate integer not null check (rate between 0 and 10000),
  valid_from date not null,
  valid_to date,
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to > valid_from)
);

insert into public.vat_rates (territory, label, rate, valid_from) values
  ('metropole', 'Taux normal', 2000, '2014-01-01'),
  ('metropole', 'Taux intermédiaire', 1000, '2014-01-01'),
  ('metropole', 'Taux réduit', 550, '2012-01-01'),
  ('metropole', 'Taux particulier', 210, '1990-01-01'),
  ('dom', 'Taux normal DOM', 850, '2000-01-01'),
  ('dom', 'Taux réduit DOM', 210, '2000-01-01');

-- Textes des mentions : modifiables par un administrateur de la plateforme sans redéploiement.
-- À faire valider par un expert-comptable avant la mise en vente.
create table public.legal_mentions (
  key text primary key check (key ~ '^[a-z_]+$'),
  text text not null check (length(text) between 1 and 600),
  applies_when text not null check (length(applies_when) <= 300),
  updated_at timestamptz not null default now()
);

insert into public.legal_mentions (key, text, applies_when) values
  ('franchise', 'TVA non applicable, art. 293 B du CGI', 'Entreprise en franchise en base de TVA'),
  ('non_assujetti', 'Opération non soumise à la TVA', 'Entreprise non assujettie'),
  ('livraison_intracom', 'Exonération de TVA, art. 262 ter I du CGI', 'Livraison de biens à une entreprise d''un autre État membre'),
  ('autoliquidation_ue', 'Autoliquidation, art. 283-2 du CGI et art. 196 de la directive 2006/112/CE', 'Prestation de services à une entreprise d''un autre État membre'),
  ('export', 'Exonération de TVA, art. 262 I du CGI', 'Livraison de biens hors de l''Union européenne'),
  ('services_hors_ue', 'TVA non applicable, art. 259-1 du CGI', 'Prestation de services à une entreprise hors UE'),
  ('autoliquidation_btp', 'Autoliquidation, art. 283-2 nonies du CGI', 'Sous-traitance dans le BTP'),
  ('debours', 'Débours, hors champ de la TVA', 'Frais refacturés à l''euro près au nom et pour le compte du client'),
  ('tva_debits', 'Option pour le paiement de la TVA d''après les débits', 'Entreprise ayant opté pour la TVA sur les débits'),
  ('indemnite_recouvrement', 'Indemnité forfaitaire pour frais de recouvrement en cas de retard de paiement : 40 € (art. L441-10 et D441-5 du Code de commerce)', 'Facture entre professionnels'),
  ('acompte', 'Facture d''acompte', 'Facture d''acompte sur devis ou commande'),
  ('avoir', 'Avoir se rapportant à la facture', 'Avoir, suivi du numéro de la facture d''origine');

revoke all on table public.vat_rates, public.legal_mentions from anon, authenticated;
grant select on table public.vat_rates, public.legal_mentions to authenticated;
alter table public.vat_rates enable row level security;
alter table public.legal_mentions enable row level security;
create policy vat_rates_select on public.vat_rates for select to authenticated using (true);
create policy legal_mentions_select on public.legal_mentions for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------------

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  type public.document_type not null,
  status public.document_status not null default 'brouillon',
  client_id uuid,

  -- Numérotation (attribuée à l'émission, jamais réutilisée)
  number text,
  sequence_key text,
  sequence_number integer,

  issue_date date not null default current_date,
  service_date date,
  service_period_start date,
  service_period_end date,
  due_date date,
  valid_until date,

  purchase_order text check (purchase_order is null or length(purchase_order) <= 100),
  subject text check (subject is null or length(subject) <= 200),
  public_notes text check (public_notes is null or length(public_notes) <= 2000),
  internal_notes text check (internal_notes is null or length(internal_notes) <= 2000),

  currency char(3) not null default 'EUR',
  language char(2) not null default 'fr' check (language in ('fr', 'en')),
  payment_terms public.payment_terms,
  early_payment_discount text check (early_payment_discount is null or length(early_payment_discount) <= 300),

  discount_kind public.discount_kind,
  discount_value bigint check (discount_value is null or discount_value >= 0),

  -- Totaux (centimes), recalculés à chaque enregistrement par le moteur
  total_lines_ht bigint not null default 0,
  discount_total bigint not null default 0,
  deposits_ht bigint not null default 0,
  total_ht bigint not null default 0,
  total_vat bigint not null default 0,
  total_ttc bigint not null default 0,
  amount_due bigint not null default 0,
  amount_paid bigint not null default 0,
  operation_category text check (operation_category is null or operation_category in ('biens', 'services', 'mixte')),

  -- Liens : avoir → facture, acompte → devis, facture → devis, solde → acomptes
  origin_document_id uuid,
  deducted_deposits jsonb not null default '[]'::jsonb,

  -- Instantanés et intégrité (phase 5)
  seller_snapshot jsonb,
  client_snapshot jsonb,
  content_hash text,
  previous_hash text,
  issued_at timestamptz,
  issued_by uuid references auth.users (id) on delete set null,
  sent_at timestamptz,
  accepted_at timestamptz,

  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (id, organization_id),
  unique (organization_id, type, number),
  foreign key (client_id, organization_id) references public.clients (id, organization_id),
  foreign key (origin_document_id, organization_id) references public.documents (id, organization_id),
  check (status = 'brouillon' or number is not null or type = 'devis'),
  check (type <> 'devis' or status in ('brouillon', 'envoye', 'accepte', 'refuse', 'expire', 'transforme')),
  check (type = 'devis' or status not in ('accepte', 'refuse', 'expire', 'transforme')),
  check (type <> 'avoir' or status = 'brouillon' or origin_document_id is not null),
  check (service_period_end is null or service_period_start is null or service_period_end >= service_period_start),
  check (discount_kind is distinct from 'pourcentage' or discount_value <= 10000)
);

create index documents_org_type_idx on public.documents (organization_id, type, issue_date desc);
create index documents_client_idx on public.documents (client_id, organization_id);
create index documents_origin_idx on public.documents (origin_document_id, organization_id);
create index documents_created_by_idx on public.documents (created_by);
create index documents_issued_by_idx on public.documents (issued_by);

create trigger documents_updated_at before update on public.documents
for each row execute function private.set_updated_at();
create trigger documents_organization_immuable before update on public.documents
for each row execute function private.organization_immuable();

create table public.document_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  document_id uuid not null,
  position integer not null,
  product_id uuid,
  designation text not null default '' check (length(designation) <= 300),
  description text check (description is null or length(description) <= 2000),
  quantity_milli bigint not null default 1000,
  unit text not null default 'unité' check (length(unit) <= 30),
  unit_price_cents bigint not null default 0,
  discount_kind public.discount_kind,
  discount_value bigint check (discount_value is null or discount_value >= 0),
  vat_category text not null default 'S' check (vat_category in ('S', 'Z', 'E', 'AE', 'K', 'G', 'O')),
  vat_rate integer not null default 2000 check (vat_rate between 0 and 10000),
  exemption_reason text check (exemption_reason is null or length(exemption_reason) <= 300),
  nature public.item_nature not null default 'service',
  line_net_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, position),
  foreign key (document_id, organization_id) references public.documents (id, organization_id) on delete cascade,
  foreign key (product_id, organization_id) references public.products (id, organization_id) on delete set null (product_id)
);

create index document_lines_document_idx on public.document_lines (document_id, organization_id);
create index document_lines_product_idx on public.document_lines (product_id, organization_id);
create trigger document_lines_updated_at before update on public.document_lines
for each row execute function private.set_updated_at();

create table public.document_vat_summary (
  organization_id uuid not null,
  document_id uuid not null,
  position integer not null,
  vat_category text not null check (vat_category in ('S', 'Z', 'E', 'AE', 'K', 'G', 'O')),
  vat_rate integer not null,
  base_cents bigint not null,
  vat_cents bigint not null,
  exemption_reason text,
  primary key (document_id, position),
  foreign key (document_id, organization_id) references public.documents (id, organization_id) on delete cascade
);

create index document_vat_summary_org_doc_idx on public.document_vat_summary (document_id, organization_id);

-- ---------------------------------------------------------------------------
-- Privilèges et RLS
-- Un document non brouillon n'est plus modifiable par l'API (garde complète en phase 5).
-- ---------------------------------------------------------------------------

revoke all on table public.documents, public.document_lines, public.document_vat_summary from anon, authenticated;
grant select, insert, update, delete on table public.documents, public.document_lines, public.document_vat_summary to authenticated;

alter table public.documents enable row level security;
alter table public.document_lines enable row level security;
alter table public.document_vat_summary enable row level security;

create function private.document_brouillon(doc uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.documents d where d.id = doc and d.status = 'brouillon');
$$;
revoke all on function private.document_brouillon(uuid) from public;
grant execute on function private.document_brouillon(uuid) to authenticated;

create policy documents_select on public.documents for select to authenticated using (private.is_member(organization_id));
create policy documents_insert on public.documents for insert to authenticated
  with check (private.peut_editer(organization_id) and status = 'brouillon' and number is null);
create policy documents_update on public.documents for update to authenticated
  using (private.peut_editer(organization_id) and status = 'brouillon')
  with check (private.peut_editer(organization_id) and status = 'brouillon' and number is null);
create policy documents_delete on public.documents for delete to authenticated
  using (private.peut_editer(organization_id) and status = 'brouillon');

create policy document_lines_select on public.document_lines for select to authenticated using (private.is_member(organization_id));
create policy document_lines_insert on public.document_lines for insert to authenticated
  with check (private.peut_editer(organization_id) and private.document_brouillon(document_id));
create policy document_lines_update on public.document_lines for update to authenticated
  using (private.peut_editer(organization_id) and private.document_brouillon(document_id))
  with check (private.peut_editer(organization_id) and private.document_brouillon(document_id));
create policy document_lines_delete on public.document_lines for delete to authenticated
  using (private.peut_editer(organization_id) and private.document_brouillon(document_id));

create policy document_vat_summary_select on public.document_vat_summary for select to authenticated using (private.is_member(organization_id));
create policy document_vat_summary_insert on public.document_vat_summary for insert to authenticated
  with check (private.peut_editer(organization_id) and private.document_brouillon(document_id));
create policy document_vat_summary_delete on public.document_vat_summary for delete to authenticated
  using (private.peut_editer(organization_id) and private.document_brouillon(document_id));
