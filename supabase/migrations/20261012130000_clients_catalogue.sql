-- PASTILLE · Phase 3 · Clients, contacts, catalogue, prix par client, réglages de facturation.
-- Chaque table porte organization_id ; les clés étrangères composites (id, organization_id)
-- empêchent de rattacher une ligne à un objet d'une autre organisation.

create type public.client_kind as enum ('b2b', 'b2c', 'b2g', 'ue', 'hors_ue');
create type public.item_nature as enum ('bien', 'service', 'debours');
create type public.discount_kind as enum ('pourcentage', 'montant');
create type public.payment_terms as enum ('reception', '15j', '30j', '30jfm', '45jfm', '60j');

-- ---------------------------------------------------------------------------
-- Utilitaires communs
-- ---------------------------------------------------------------------------

-- Une ligne ne change jamais d'organisation.
create function private.organization_immuable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id <> old.organization_id then
    raise exception 'Une donnée ne peut pas changer d''organisation.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create function private.peut_editer(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role(org, array['owner', 'admin', 'billing']::public.member_role[]);
$$;

revoke all on function private.peut_editer(uuid) from public;
grant execute on function private.peut_editer(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Réglages de facturation de l'organisation
-- ---------------------------------------------------------------------------

alter table public.organizations
  add column default_payment_terms public.payment_terms not null default '30j',
  add column late_penalty_terms text not null default 'Taux d''intérêt appliqué par la BCE à son opération de refinancement la plus récente, majoré de 10 points'
    check (length(late_penalty_terms) <= 400),
  add column early_payment_discount text not null default 'Pas d''escompte pour paiement anticipé'
    check (length(early_payment_discount) <= 300),
  add column invoice_number_format text not null default 'F-{AAAA}-{NNNN}'
    check (invoice_number_format ~ '\{N+\}' and length(invoice_number_format) <= 40),
  add column quote_number_format text not null default 'D-{AAAA}-{NNNN}'
    check (quote_number_format ~ '\{N+\}' and length(quote_number_format) <= 40),
  add column credit_number_format text not null default 'A-{AAAA}-{NNNN}'
    check (credit_number_format ~ '\{N+\}' and length(credit_number_format) <= 40),
  add column accent_color text not null default '#1F3A5F' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column invoice_template text not null default 'papeterie' check (invoice_template in ('galet', 'papeterie', 'classique')),
  add column invoice_font text not null default 'grotesque' check (invoice_font in ('grotesque', 'serif')),
  add column logo_path text check (logo_path is null or length(logo_path) <= 300),
  add column footer_text text check (footer_text is null or length(footer_text) <= 600),
  add column terms_text text check (terms_text is null or length(terms_text) <= 20000),
  add column onboarding_completed_at timestamptz;

create index organizations_created_by_idx on public.organizations (created_by);

grant update (
  default_payment_terms, late_penalty_terms, early_payment_discount,
  invoice_number_format, quote_number_format, credit_number_format,
  accent_color, invoice_template, invoice_font, logo_path, footer_text, terms_text, onboarding_completed_at
) on table public.organizations to authenticated;

-- ---------------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------------

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind public.client_kind not null,
  name text not null check (length(trim(name)) between 1 and 200),
  legal_form text check (legal_form is null or length(legal_form) <= 80),
  siren text check (siren is null or siren ~ '^[0-9]{9}$'),
  siret text check (siret is null or siret ~ '^[0-9]{14}$'),
  vat_number text check (vat_number is null or vat_number ~ '^[A-Z]{2}[0-9A-Z]{2,13}$'),
  einvoice_address text check (einvoice_address is null or length(einvoice_address) <= 100),
  service_code text check (service_code is null or length(service_code) <= 100),

  billing_line1 text check (billing_line1 is null or length(billing_line1) <= 200),
  billing_line2 text check (billing_line2 is null or length(billing_line2) <= 200),
  billing_postal_code text check (billing_postal_code is null or length(billing_postal_code) <= 20),
  billing_city text check (billing_city is null or length(billing_city) <= 120),
  billing_country char(2) not null default 'FR' check (billing_country ~ '^[A-Z]{2}$'),

  shipping_different boolean not null default false,
  shipping_line1 text check (shipping_line1 is null or length(shipping_line1) <= 200),
  shipping_line2 text check (shipping_line2 is null or length(shipping_line2) <= 200),
  shipping_postal_code text check (shipping_postal_code is null or length(shipping_postal_code) <= 20),
  shipping_city text check (shipping_city is null or length(shipping_city) <= 120),
  shipping_country char(2) check (shipping_country is null or shipping_country ~ '^[A-Z]{2}$'),

  -- Réglages commerciaux propres au client
  default_vat_category text check (default_vat_category is null or default_vat_category in ('S', 'Z', 'E', 'AE', 'K', 'G', 'O')),
  default_vat_rate integer check (default_vat_rate is null or default_vat_rate between 0 and 10000),
  exemption_reason text check (exemption_reason is null or length(exemption_reason) <= 300),
  default_discount_kind public.discount_kind,
  default_discount_value integer check (default_discount_value is null or default_discount_value >= 0),
  payment_terms public.payment_terms,
  early_payment_discount text check (early_payment_discount is null or length(early_payment_discount) <= 300),
  currency char(3) not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  language char(2) not null default 'fr' check (language in ('fr', 'en')),
  purchase_order_required boolean not null default false,
  custom_mentions text check (custom_mentions is null or length(custom_mentions) <= 1000),
  reminders_enabled boolean not null default true,
  notes text check (notes is null or length(notes) <= 5000),

  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  check (kind <> 'b2b' or siren is not null),
  check (
    (default_discount_kind is null and default_discount_value is null)
    or (default_discount_kind is not null and default_discount_value is not null)
  ),
  check (default_discount_kind is distinct from 'pourcentage' or default_discount_value <= 10000)
);

create index clients_organization_name_idx on public.clients (organization_id, name);
create unique index clients_organization_siren_idx on public.clients (organization_id, siren)
  where siren is not null and archived_at is null;

create trigger clients_updated_at before update on public.clients
for each row execute function private.set_updated_at();
create trigger clients_organization_immuable before update on public.clients
for each row execute function private.organization_immuable();

create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 200),
  email text check (email is null or (length(email) <= 254 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')),
  phone text check (phone is null or length(phone) <= 40),
  role text check (role is null or length(role) <= 100),
  receives_invoices boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, organization_id) references public.clients (id, organization_id) on delete cascade
);

create index client_contacts_client_idx on public.client_contacts (client_id);
create index client_contacts_org_client_idx on public.client_contacts (client_id, organization_id);
create trigger client_contacts_updated_at before update on public.client_contacts
for each row execute function private.set_updated_at();
create trigger client_contacts_organization_immuable before update on public.client_contacts
for each row execute function private.organization_immuable();

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 200),
  description text check (description is null or length(description) <= 2000),
  reference text check (reference is null or length(reference) <= 60),
  unit text not null default 'unité' check (length(unit) between 1 and 30),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  vat_category text not null default 'S' check (vat_category in ('S', 'Z', 'E', 'AE', 'K', 'G', 'O')),
  vat_rate integer not null default 2000 check (vat_rate between 0 and 10000),
  nature public.item_nature not null default 'service',
  category text check (category is null or length(category) <= 60),
  accounting_account text check (accounting_account is null or accounting_account ~ '^[0-9A-Z]{3,12}$'),
  favorite boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  check (vat_category <> 'S' or vat_rate > 0),
  check (nature <> 'debours' or vat_category = 'O')
);

create index products_organization_name_idx on public.products (organization_id, name);
create trigger products_updated_at before update on public.products
for each row execute function private.set_updated_at();
create trigger products_organization_immuable before update on public.products
for each row execute function private.organization_immuable();

create table public.client_prices (
  organization_id uuid not null,
  client_id uuid not null,
  product_id uuid not null,
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (client_id, product_id),
  foreign key (client_id, organization_id) references public.clients (id, organization_id) on delete cascade,
  foreign key (product_id, organization_id) references public.products (id, organization_id) on delete cascade
);

create index client_prices_product_idx on public.client_prices (product_id, organization_id);
create index client_prices_client_org_idx on public.client_prices (client_id, organization_id);
create trigger client_prices_updated_at before update on public.client_prices
for each row execute function private.set_updated_at();
create trigger client_prices_organization_immuable before update on public.client_prices
for each row execute function private.organization_immuable();

-- ---------------------------------------------------------------------------
-- Privilèges et RLS : lecture par les membres, écriture par propriétaire, admin, facturation
-- ---------------------------------------------------------------------------

revoke all on table public.clients, public.client_contacts, public.products, public.client_prices from anon, authenticated;
grant select, insert, update, delete on table public.clients, public.client_contacts, public.products, public.client_prices to authenticated;

alter table public.clients enable row level security;
alter table public.client_contacts enable row level security;
alter table public.products enable row level security;
alter table public.client_prices enable row level security;

create policy clients_select on public.clients for select to authenticated using (private.is_member(organization_id));
create policy clients_insert on public.clients for insert to authenticated with check (private.peut_editer(organization_id));
create policy clients_update on public.clients for update to authenticated
  using (private.peut_editer(organization_id)) with check (private.peut_editer(organization_id));
create policy clients_delete on public.clients for delete to authenticated using (private.peut_editer(organization_id));

create policy client_contacts_select on public.client_contacts for select to authenticated using (private.is_member(organization_id));
create policy client_contacts_insert on public.client_contacts for insert to authenticated with check (private.peut_editer(organization_id));
create policy client_contacts_update on public.client_contacts for update to authenticated
  using (private.peut_editer(organization_id)) with check (private.peut_editer(organization_id));
create policy client_contacts_delete on public.client_contacts for delete to authenticated using (private.peut_editer(organization_id));

create policy products_select on public.products for select to authenticated using (private.is_member(organization_id));
create policy products_insert on public.products for insert to authenticated with check (private.peut_editer(organization_id));
create policy products_update on public.products for update to authenticated
  using (private.peut_editer(organization_id)) with check (private.peut_editer(organization_id));
create policy products_delete on public.products for delete to authenticated using (private.peut_editer(organization_id));

create policy client_prices_select on public.client_prices for select to authenticated using (private.is_member(organization_id));
create policy client_prices_insert on public.client_prices for insert to authenticated with check (private.peut_editer(organization_id));
create policy client_prices_update on public.client_prices for update to authenticated
  using (private.peut_editer(organization_id)) with check (private.peut_editer(organization_id));
create policy client_prices_delete on public.client_prices for delete to authenticated using (private.peut_editer(organization_id));

-- ---------------------------------------------------------------------------
-- Logos (Supabase Storage) : dossier = identifiant de l'organisation
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 1048576, array['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'])
on conflict (id) do nothing;

create policy logos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'logos'
    and private.has_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin']::public.member_role[])
  );
create policy logos_update on storage.objects for update to authenticated
  using (
    bucket_id = 'logos'
    and private.has_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin']::public.member_role[])
  );
create policy logos_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'logos'
    and private.has_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin']::public.member_role[])
  );
