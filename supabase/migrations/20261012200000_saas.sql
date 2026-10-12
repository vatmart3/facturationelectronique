-- PASTILLE · Phase 10 · Produit SaaS : abonnements et essai, limites des offres,
-- invitations, administrateurs de la plateforme, annonces, journal des erreurs.

-- ---------------------------------------------------------------------------
-- Abonnements (Stripe Billing). Écrits uniquement par le webhook Stripe (clé service).
-- ---------------------------------------------------------------------------

create table public.subscriptions (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  plan text not null default 'pro' check (plan in ('solo', 'pro', 'studio')),
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'unpaid')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  updated_at timestamptz not null default now()
);

revoke all on table public.subscriptions from anon, authenticated;
grant select on table public.subscriptions to authenticated;
alter table public.subscriptions enable row level security;
create policy subscriptions_select on public.subscriptions for select to authenticated using (private.is_member(organization_id));

-- Essai de 14 jours, sans carte, sur l'offre Pro, dès la création de l'entreprise.
create function private.ouvrir_essai()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.subscriptions (organization_id, plan, status, trial_ends_at)
  values (new.id, 'pro', 'trialing', now() + interval '14 days')
  on conflict (organization_id) do nothing;
  return null;
end;
$$;

create trigger organizations_essai after insert on public.organizations
for each row execute function private.ouvrir_essai();

-- Entreprises existantes : un essai qui commence aujourd'hui.
insert into public.subscriptions (organization_id, plan, status, trial_ends_at)
select o.id, 'pro', 'trialing', now() + interval '14 days' from public.organizations o
on conflict (organization_id) do nothing;

/** Offre en vigueur de l'organisation, ou null si l'essai est terminé et rien n'est payé. */
create function private.offre(org uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.plan from public.subscriptions s
  where s.organization_id = org
    and (s.status in ('active', 'past_due') or (s.status = 'trialing' and s.trial_ends_at > now()));
$$;

create function private.offre_au_moins(org uuid, niveau text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.est_service() or coalesce(
    array_position(array['solo', 'pro', 'studio'], private.offre(org)) >= array_position(array['solo', 'pro', 'studio'], niveau),
    false);
$$;

revoke all on function private.offre(uuid) from public;
revoke all on function private.offre_au_moins(uuid, text) from public;
grant execute on function private.offre(uuid), private.offre_au_moins(uuid, text) to authenticated;

-- Paywall doux : sans abonnement actif, tout reste consultable et téléchargeable
-- (conservation légale), mais plus rien ne se crée ni ne s'émet.
create or replace function private.peut_editer(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.est_service()
    or (private.has_role(org, array['owner', 'admin', 'billing']::public.member_role[]) and private.offre(org) is not null);
$$;

-- Fonctions de l'offre Pro : plateforme agréée, e-reporting, récurrences.
drop policy einvoice_transmissions_insert on public.einvoice_transmissions;
create policy einvoice_transmissions_insert on public.einvoice_transmissions for insert to authenticated
  with check (private.peut_editer(organization_id) and private.offre_au_moins(organization_id, 'pro'));
drop policy ereporting_reports_insert on public.ereporting_reports;
create policy ereporting_reports_insert on public.ereporting_reports for insert to authenticated
  with check (private.peut_editer(organization_id) and private.offre_au_moins(organization_id, 'pro'));
drop policy recurring_insert on public.recurring_invoices;
create policy recurring_insert on public.recurring_invoices for insert to authenticated
  with check (private.peut_editer(organization_id) and private.offre_au_moins(organization_id, 'pro'));

-- Nombre d'utilisateurs par offre : Solo 1, Pro 3, Studio 10.
create function private.limite_membres()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan text := coalesce(private.offre(new.organization_id), 'solo');
  limite integer := case plan when 'studio' then 10 when 'pro' then 3 else 1 end;
begin
  if (select count(*) from public.memberships m where m.organization_id = new.organization_id) >= limite then
    raise exception 'L''offre % est limitée à % utilisateur(s).', initcap(plan), limite using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger memberships_limite before insert on public.memberships
for each row execute function private.limite_membres();

-- ---------------------------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------------------------

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 320),
  role public.member_role not null check (role <> 'owner'),
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid references auth.users (id) on delete set null default auth.uid(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index invitations_org_idx on public.invitations (organization_id);
create index invitations_invited_by_idx on public.invitations (invited_by);
create unique index invitations_en_attente on public.invitations (organization_id, lower(email)) where accepted_at is null;

revoke all on table public.invitations from anon, authenticated;
grant select, insert, delete on table public.invitations to authenticated;
alter table public.invitations enable row level security;
create policy invitations_select on public.invitations for select to authenticated
  using (private.has_role(organization_id, array['owner', 'admin']::public.member_role[]));
create policy invitations_insert on public.invitations for insert to authenticated
  with check (private.has_role(organization_id, array['owner', 'admin']::public.member_role[]) and private.offre(organization_id) is not null);
create policy invitations_delete on public.invitations for delete to authenticated
  using (private.has_role(organization_id, array['owner', 'admin']::public.member_role[]));

/** Aperçu d'une invitation (page publique d'acceptation). */
create function public.invitation(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('organisation', o.name, 'email', i.email, 'role', i.role, 'expiree', i.expires_at < now(), 'acceptee', i.accepted_at is not null)
  from public.invitations i join public.organizations o on o.id = i.organization_id
  where i.token = p_token;
$$;
revoke all on function public.invitation(uuid) from public;
grant execute on function public.invitation(uuid) to anon, authenticated;

/** Accepte une invitation : l'email du compte connecté doit être celui invité. */
create function public.accepter_invitation(p_token uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.invitations;
  email_compte text;
  slug text;
begin
  select * into i from public.invitations where token = p_token for update;
  if not found then
    raise exception 'Invitation introuvable.' using errcode = 'P0002';
  end if;
  if i.accepted_at is not null then
    raise exception 'Cette invitation a déjà été utilisée.' using errcode = '55000';
  end if;
  if i.expires_at < now() then
    raise exception 'Cette invitation a expiré : demandez-en une nouvelle.' using errcode = '55000';
  end if;
  select u.email into email_compte from auth.users u where u.id = (select auth.uid());
  if email_compte is null or lower(email_compte) <> lower(i.email) then
    raise exception 'Connectez-vous avec l''adresse %, à laquelle l''invitation a été envoyée.', i.email using errcode = '42501';
  end if;
  insert into public.memberships (organization_id, user_id, role)
  values (i.organization_id, (select auth.uid()), i.role)
  on conflict (organization_id, user_id) do nothing;
  update public.invitations set accepted_at = now() where id = i.id;
  perform private.auditer(i.organization_id, 'membre.invite_accepte', 'membre', (select auth.uid()), jsonb_build_object('role', i.role));
  select o.slug into slug from public.organizations o where o.id = i.organization_id;
  return slug;
end;
$$;
revoke all on function public.accepter_invitation(uuid) from public, anon;
grant execute on function public.accepter_invitation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Administrateurs de la plateforme, annonces, journal des erreurs
-- ---------------------------------------------------------------------------

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
revoke all on table public.platform_admins from anon, authenticated;
grant select on table public.platform_admins to authenticated;
alter table public.platform_admins enable row level security;
-- Chacun peut seulement savoir s'il est lui-même administrateur.
create policy platform_admins_self on public.platform_admins for select to authenticated using (user_id = (select auth.uid()));

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 120),
  body text not null check (length(body) between 1 and 600),
  level text not null default 'info' check (level in ('info', 'important')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
revoke all on table public.announcements from anon, authenticated;
grant select on table public.announcements to authenticated;
alter table public.announcements enable row level security;
create policy announcements_actives on public.announcements for select to authenticated
  using (starts_at <= now() and (ends_at is null or ends_at > now()));

create table public.error_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations (id) on delete set null,
  kind text not null check (kind in ('pdf', 'facturx', 'email', 'plateforme', 'stripe', 'autre')),
  message text not null check (length(message) <= 2000),
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index error_logs_created_idx on public.error_logs (created_at desc);
create index error_logs_org_idx on public.error_logs (organization_id);
revoke all on table public.error_logs from anon, authenticated;
grant insert on table public.error_logs to authenticated;
alter table public.error_logs enable row level security;
create policy error_logs_insert on public.error_logs for insert to authenticated with check (organization_id is null or private.is_member(organization_id));

-- Segments d'URL réservés : pages publiques ajoutées depuis la phase 8.
create or replace function public.create_organization(p_name text)
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
  reserves text[] := array[
    'admin', 'aide', 'api', 'app', 'auth', 'bienvenue', 'cgu', 'cgv', 'compte', 'confidentialite', 'connexion', 'd',
    'facture-auto-entrepreneur', 'facturation-electronique-2027', 'inscription', 'invitation', 'legal', 'mentions-legales',
    'modele-facture-factur-x', 'mot-de-passe', 'reforme', 'robots-txt', 'signer', 'sitemap-xml', 'static', 'systeme', 'tarifs'
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
