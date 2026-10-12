-- PASTILLE · Phase 1 · Fondations
-- Profils, organisations (tenants) et adhésions avec rôles.
-- Toutes les tables ont RLS activé. Les privilèges sont accordés colonne par colonne
-- pour que l'API ne puisse modifier que ce qui doit l'être.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.member_role as enum ('owner', 'admin', 'billing', 'viewer', 'accountant');

create type public.vat_regime as enum ('franchise', 'reel_simplifie', 'reel_normal', 'non_assujetti');

-- ---------------------------------------------------------------------------
-- Utilitaires
-- ---------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Doit rester aligné sur apps/web/src/lib/slug.ts
create function private.slugify(texte text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  s text;
begin
  s := lower(coalesce(texte, ''));
  s := translate(
    s,
    'àáâãäåāçćčèéêëēėęîïíīìñńôöòóōõśšûüùúūÿýžźżďť',
    'aaaaaaaccceeeeeeeiiiiinnoooooossuuuuuyyzzzdt'
  );
  s := regexp_replace(s, '[^a-z0-9]+', '-', 'g');
  s := regexp_replace(s, '^-+|-+$', '', 'g');
  s := regexp_replace(left(s, 48), '-+$', '', 'g');
  if length(s) < 2 then
    s := regexp_replace('org-' || s, '-+$', '', 'g');
  end if;
  return s;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profils (1 ligne par utilisateur auth)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text check (full_name is null or length(full_name) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create function private.handle_new_user()
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
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Organisations (tenant)
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 2 and 60),
  name text not null check (length(trim(name)) between 1 and 200),

  -- Identité légale (complétée à l'onboarding, phase 3)
  legal_form text check (legal_form is null or length(legal_form) <= 80),
  share_capital_cents bigint check (share_capital_cents is null or share_capital_cents >= 0),
  siren text check (siren is null or siren ~ '^[0-9]{9}$'),
  siret text check (siret is null or siret ~ '^[0-9]{14}$'),
  vat_number text check (vat_number is null or vat_number ~ '^[A-Z]{2}[0-9A-Z]{2,13}$'),
  naf_code text check (naf_code is null or naf_code ~ '^[0-9]{2}\.?[0-9]{2}[A-Z]$'),
  registration text check (registration is null or length(registration) <= 120),
  address_line1 text check (address_line1 is null or length(address_line1) <= 200),
  address_line2 text check (address_line2 is null or length(address_line2) <= 200),
  postal_code text check (postal_code is null or length(postal_code) <= 20),
  city text check (city is null or length(city) <= 120),
  country_code char(2) not null default 'FR' check (country_code ~ '^[A-Z]{2}$'),

  -- Fiscalité
  vat_regime public.vat_regime,
  vat_on_debits boolean not null default false,

  -- Banque
  iban text check (iban is null or iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$'),
  bic text check (bic is null or bic ~ '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$'),

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizations_updated_at
before update on public.organizations
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Adhésions
-- ---------------------------------------------------------------------------

create table public.memberships (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index memberships_user_id_idx on public.memberships (user_id);

create trigger memberships_updated_at
before update on public.memberships
for each row execute function private.set_updated_at();

-- Une organisation garde toujours au moins un propriétaire.
create function private.protect_last_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner' or new.organization_id <> old.organization_id)
     and exists (select 1 from public.organizations o where o.id = old.organization_id)
     and not exists (
       select 1 from public.memberships m
       where m.organization_id = old.organization_id
         and m.role = 'owner'
         and m.user_id <> old.user_id
     )
  then
    raise exception 'Une organisation doit garder au moins un propriétaire.'
      using errcode = 'P0001', hint = 'Nommez un autre propriétaire avant.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger memberships_protect_last_owner
before update or delete on public.memberships
for each row execute function private.protect_last_owner();

-- ---------------------------------------------------------------------------
-- Fonctions d'autorisation (security definer : pas de récursion RLS)
-- ---------------------------------------------------------------------------

create function private.is_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = org and m.user_id = (select auth.uid())
  );
$$;

create function private.has_role(org uuid, roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = org
      and m.user_id = (select auth.uid())
      and m.role = any (roles)
  );
$$;

create function private.shares_organization(other_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = other_user
  );
$$;

revoke all on function private.is_member(uuid) from public;
revoke all on function private.has_role(uuid, public.member_role[]) from public;
revoke all on function private.shares_organization(uuid) from public;
revoke all on function private.slugify(text) from public;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.has_role(uuid, public.member_role[]) to authenticated;
grant execute on function private.shares_organization(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Création d'organisation : seule voie d'insertion, crée l'adhésion propriétaire
-- ---------------------------------------------------------------------------

create function public.create_organization(p_name text)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  base text;
  candidat text;
  n integer := 1;
  org public.organizations;
  -- Segments d'URL utilisés par l'application : une organisation ne peut pas les prendre.
  reserves text[] := array[
    'admin', 'aide', 'api', 'app', 'auth', 'bienvenue', 'cgu', 'cgv', 'confidentialite', 'connexion',
    'inscription', 'legal', 'mentions-legales', 'mot-de-passe', 'reforme', 'signer', 'static', 'systeme', 'tarifs'
  ];
begin
  if uid is null then
    raise exception 'Authentification requise.' using errcode = '42501';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Le nom de l''entreprise est obligatoire.' using errcode = '22023';
  end if;
  if (select count(*) from public.memberships m where m.user_id = uid and m.role = 'owner') >= 20 then
    raise exception 'Nombre maximal d''entreprises atteint.' using errcode = 'P0001';
  end if;

  base := private.slugify(p_name);
  candidat := base;
  while candidat = any (reserves) or exists (select 1 from public.organizations o where o.slug = candidat) loop
    n := n + 1;
    candidat := left(base, 44) || '-' || n;
  end loop;

  insert into public.organizations (slug, name, created_by)
  values (candidat, trim(p_name), uid)
  returning * into org;

  insert into public.memberships (organization_id, user_id, role)
  values (org.id, uid, 'owner');

  return org;
end;
$$;

revoke all on function public.create_organization(text) from public;
revoke all on function public.create_organization(text) from anon;
grant execute on function public.create_organization(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Privilèges : rien pour anon, colonnes explicites pour authenticated
-- ---------------------------------------------------------------------------

revoke all on table public.profiles, public.organizations, public.memberships from anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (full_name) on table public.profiles to authenticated;

grant select on table public.organizations to authenticated;
grant update (
  name, legal_form, share_capital_cents, siren, siret, vat_number, naf_code, registration,
  address_line1, address_line2, postal_code, city, country_code,
  vat_regime, vat_on_debits, iban, bic
) on table public.organizations to authenticated;

grant select, delete on table public.memberships to authenticated;
grant insert (organization_id, user_id, role) on table public.memberships to authenticated;
grant update (role) on table public.memberships to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;

-- Profils : le sien, et ceux des personnes avec qui on partage une organisation.
create policy profiles_select on public.profiles
for select to authenticated
using (id = (select auth.uid()) or private.shares_organization(id));

create policy profiles_update on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Organisations : lecture par les membres, modification par propriétaires et admins.
-- Pas d'insert (passer par create_organization) ni de delete (conservation fiscale).
create policy organizations_select on public.organizations
for select to authenticated
using (private.is_member(id));

create policy organizations_update on public.organizations
for update to authenticated
using (private.has_role(id, array['owner', 'admin']::public.member_role[]))
with check (private.has_role(id, array['owner', 'admin']::public.member_role[]));

-- Adhésions : visibles par les membres de la même organisation.
create policy memberships_select on public.memberships
for select to authenticated
using (private.is_member(organization_id));

-- Ajout : propriétaires et admins ; seul un propriétaire peut ajouter un propriétaire.
create policy memberships_insert on public.memberships
for insert to authenticated
with check (
  private.has_role(organization_id, array['owner', 'admin']::public.member_role[])
  and (role <> 'owner' or private.has_role(organization_id, array['owner']::public.member_role[]))
);

-- Changement de rôle : idem, et un admin ne peut pas toucher à un propriétaire.
create policy memberships_update on public.memberships
for update to authenticated
using (
  private.has_role(organization_id, array['owner', 'admin']::public.member_role[])
  and (role <> 'owner' or private.has_role(organization_id, array['owner']::public.member_role[]))
)
with check (
  private.has_role(organization_id, array['owner', 'admin']::public.member_role[])
  and (role <> 'owner' or private.has_role(organization_id, array['owner']::public.member_role[]))
);

-- Retrait : propriétaires et admins (sauf propriétaires pour un admin), ou départ volontaire.
create policy memberships_delete on public.memberships
for delete to authenticated
using (
  user_id = (select auth.uid())
  or (
    private.has_role(organization_id, array['owner', 'admin']::public.member_role[])
    and (role <> 'owner' or private.has_role(organization_id, array['owner']::public.member_role[]))
  )
);
