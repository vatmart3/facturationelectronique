-- PASTILLE · Phase 8 · Paiements, relances, récurrences, signature des devis

-- ---------------------------------------------------------------------------
-- Appels du service (tâches planifiées) : clé service_role
-- ---------------------------------------------------------------------------

create function private.est_service()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role';
$$;

-- L'émission automatique des récurrences passe par le service.
create or replace function private.peut_editer(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.est_service() or private.has_role(org, array['owner', 'admin', 'billing']::public.member_role[]);
$$;

grant execute on function public.emettre_document(uuid) to service_role;

-- Retour d'une facture payée à « émise » lorsqu'un paiement est supprimé.
create or replace function private.transition_valide(t public.document_type, de public.document_status, vers public.document_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when de = vers then true
    when t = 'devis' then (de, vers) in (
      ('envoye', 'accepte'), ('envoye', 'refuse'), ('envoye', 'expire'),
      ('accepte', 'transforme'), ('envoye', 'transforme'), ('expire', 'accepte'), ('refuse', 'envoye'))
    else (de, vers) in (
      ('emis', 'envoye'), ('emis', 'partiellement_paye'), ('emis', 'paye'), ('emis', 'annule'),
      ('envoye', 'partiellement_paye'), ('envoye', 'paye'), ('envoye', 'annule'),
      ('partiellement_paye', 'paye'), ('partiellement_paye', 'annule'),
      ('paye', 'partiellement_paye'), ('paye', 'envoye'), ('paye', 'emis'),
      ('partiellement_paye', 'envoye'), ('partiellement_paye', 'emis'))
  end;
$$;

-- ---------------------------------------------------------------------------
-- Paiements
-- ---------------------------------------------------------------------------

create type public.payment_method as enum ('virement', 'carte', 'cheque', 'especes', 'prelevement', 'autre');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  document_id uuid not null,
  amount_cents bigint not null check (amount_cents > 0),
  paid_on date not null default current_date,
  method public.payment_method not null default 'virement',
  reference text check (reference is null or length(reference) <= 140),
  note text check (note is null or length(note) <= 500),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (document_id, organization_id) references public.documents (id, organization_id) on delete restrict
);

create index payments_document_idx on public.payments (document_id, organization_id);
create index payments_org_date_idx on public.payments (organization_id, paid_on desc);
create index payments_created_by_idx on public.payments (created_by);

revoke all on table public.payments from anon, authenticated;
grant select, insert, delete on table public.payments to authenticated;
alter table public.payments enable row level security;
create policy payments_select on public.payments for select to authenticated using (private.is_member(organization_id));
create policy payments_insert on public.payments for insert to authenticated with check (private.peut_editer(organization_id));
create policy payments_delete on public.payments for delete to authenticated using (private.peut_editer(organization_id));

-- Contrôle à l'enregistrement : facture émise, non annulée, pas de trop-perçu.
create function private.verifier_paiement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.documents;
  deja bigint;
begin
  select * into d from public.documents where id = new.document_id for update;
  if d.type not in ('facture', 'acompte') or d.status in ('brouillon', 'annule') then
    raise exception 'Un paiement ne s''enregistre que sur une facture émise.' using errcode = '23514';
  end if;
  select coalesce(sum(p.amount_cents), 0) into deja from public.payments p where p.document_id = d.id;
  if deja + new.amount_cents > d.amount_due then
    raise exception 'Le paiement dépasse le reste à payer (% centimes).', d.amount_due - deja using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger payments_verifier before insert on public.payments
for each row execute function private.verifier_paiement();

-- Montant encaissé et statut de la facture, recalculés après chaque paiement.
create function private.recalculer_paiements()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  doc uuid := coalesce(new.document_id, old.document_id);
  d public.documents;
  paye bigint;
  statut public.document_status;
begin
  select * into d from public.documents where id = doc for update;
  if d.status = 'annule' then
    return null;
  end if;
  select coalesce(sum(p.amount_cents), 0) into paye from public.payments p where p.document_id = doc;
  statut := case
    when paye >= d.amount_due and d.amount_due > 0 then 'paye'
    when paye > 0 then 'partiellement_paye'
    when d.sent_at is not null then 'envoye'
    else 'emis'
  end;
  update public.documents set amount_paid = paye, status = statut where id = doc;
  perform private.auditer(d.organization_id, case when tg_op = 'INSERT' then 'paiement.enregistre' else 'paiement.supprime' end,
    'paiement', coalesce(new.id, old.id), jsonb_build_object('document', d.number, 'montant', coalesce(new.amount_cents, old.amount_cents)));
  return null;
end;
$$;

create trigger payments_recalculer after insert or delete on public.payments
for each row execute function private.recalculer_paiements();

-- ---------------------------------------------------------------------------
-- Relances
-- ---------------------------------------------------------------------------

alter table public.organizations
  add column reminders_enabled boolean not null default true,
  -- Jours par rapport à l'échéance : -3 = trois jours avant, 7 = une semaine après.
  add column reminder_days integer[] not null default '{-3, 7, 15, 30}' check (cardinality(reminder_days) <= 8),
  add column reminder_email_from text check (reminder_email_from is null or length(reminder_email_from) <= 120),
  add column reminder_signature text check (reminder_signature is null or length(reminder_signature) <= 500);

grant update (reminders_enabled, reminder_days, reminder_email_from, reminder_signature) on table public.organizations to authenticated;

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  document_id uuid not null,
  -- Jour du scénario (-3, 7, 15, 30) ou null pour un envoi manuel.
  step integer,
  kind text not null check (kind in ('envoi', 'relance', 'remerciement')),
  recipient text not null check (length(recipient) <= 320),
  subject text not null check (length(subject) <= 200),
  status text not null check (status in ('envoye', 'simule', 'echec')),
  provider_id text,
  error text,
  sent_by uuid references auth.users (id) on delete set null default auth.uid(),
  sent_at timestamptz not null default now(),
  foreign key (document_id, organization_id) references public.documents (id, organization_id) on delete cascade
);

create index reminders_document_idx on public.reminders (document_id, organization_id);
create index reminders_org_idx on public.reminders (organization_id, sent_at desc);
create index reminders_sent_by_idx on public.reminders (sent_by);
-- Une même étape de scénario n'est jamais envoyée deux fois.
create unique index reminders_etape_unique on public.reminders (document_id, step) where step is not null and status <> 'echec';

revoke all on table public.reminders from anon, authenticated;
grant select, insert on table public.reminders to authenticated;
alter table public.reminders enable row level security;
create policy reminders_select on public.reminders for select to authenticated using (private.is_member(organization_id));
create policy reminders_insert on public.reminders for insert to authenticated with check (private.peut_editer(organization_id));

-- ---------------------------------------------------------------------------
-- Factures récurrentes
-- ---------------------------------------------------------------------------

create type public.recurrence_frequency as enum ('mensuelle', 'trimestrielle', 'semestrielle', 'annuelle');

create table public.recurring_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid not null,
  name text not null check (length(name) between 1 and 120),
  frequency public.recurrence_frequency not null,
  next_date date not null,
  end_date date,
  -- brouillon : la facture attend une validation ; emission : elle est émise automatiquement.
  mode text not null default 'brouillon' check (mode in ('brouillon', 'emission')),
  active boolean not null default true,
  -- Modèle : lignes, conditions, remise (même forme que l'état d'édition).
  template jsonb not null,
  last_document_id uuid,
  last_run_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, organization_id) references public.clients (id, organization_id),
  check (end_date is null or end_date >= next_date)
);

create index recurring_org_idx on public.recurring_invoices (organization_id, next_date);
create index recurring_client_idx on public.recurring_invoices (client_id, organization_id);
create index recurring_created_by_idx on public.recurring_invoices (created_by);
create trigger recurring_updated_at before update on public.recurring_invoices
for each row execute function private.set_updated_at();
create trigger recurring_organization_immuable before update on public.recurring_invoices
for each row execute function private.organization_immuable();

revoke all on table public.recurring_invoices from anon, authenticated;
grant select, insert, update, delete on table public.recurring_invoices to authenticated;
alter table public.recurring_invoices enable row level security;
create policy recurring_select on public.recurring_invoices for select to authenticated using (private.is_member(organization_id));
create policy recurring_insert on public.recurring_invoices for insert to authenticated with check (private.peut_editer(organization_id));
create policy recurring_update on public.recurring_invoices for update to authenticated
  using (private.peut_editer(organization_id)) with check (private.peut_editer(organization_id));
create policy recurring_delete on public.recurring_invoices for delete to authenticated using (private.peut_editer(organization_id));

-- ---------------------------------------------------------------------------
-- Lien public d'un document (consultation, signature d'un devis)
-- ---------------------------------------------------------------------------

alter table public.documents add column public_token uuid unique;

create table public.quote_signatures (
  document_id uuid primary key,
  organization_id uuid not null,
  decision text not null check (decision in ('accepte', 'refuse')),
  signer_name text not null check (length(signer_name) between 2 and 120),
  signer_email text check (signer_email is null or length(signer_email) <= 320),
  comment text check (comment is null or length(comment) <= 1000),
  -- Empreinte du devis au moment de la signature : la preuve porte sur ce contenu précis.
  content_hash text not null,
  user_agent text,
  signed_at timestamptz not null default now(),
  foreign key (document_id, organization_id) references public.documents (id, organization_id) on delete cascade
);
create index quote_signatures_org_idx on public.quote_signatures (organization_id);

revoke all on table public.quote_signatures from anon, authenticated;
grant select on table public.quote_signatures to authenticated;
alter table public.quote_signatures enable row level security;
create policy quote_signatures_select on public.quote_signatures for select to authenticated using (private.is_member(organization_id));

-- Crée (ou renvoie) le lien public d'un document émis.
create function public.lien_public(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.documents;
begin
  select * into d from public.documents where id = p_id;
  if not found or not private.peut_editer(d.organization_id) then
    raise exception 'Document introuvable.' using errcode = 'P0002';
  end if;
  if d.status = 'brouillon' then
    raise exception 'Un brouillon ne se partage pas.' using errcode = '23514';
  end if;
  if d.public_token is null then
    -- Le jeton s'ajoute sans toucher au contenu figé (colonne autorisée ci-dessous).
    update public.documents set public_token = gen_random_uuid() where id = p_id returning * into d;
  end if;
  return d.public_token;
end;
$$;

revoke all on function public.lien_public(uuid) from public, anon;
grant execute on function public.lien_public(uuid) to authenticated;

-- Le jeton public peut être posé après l'émission.
create or replace function private.document_fige()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'brouillon' then
      raise exception 'Un document émis ne peut pas être supprimé : émettez un avoir.' using errcode = '42501';
    end if;
    return old;
  end if;
  if old.status = 'brouillon' then
    return new;
  end if;
  if (to_jsonb(new) - array['status', 'amount_paid', 'sent_at', 'accepted_at', 'updated_at', 'public_token'])
     is distinct from (to_jsonb(old) - array['status', 'amount_paid', 'sent_at', 'accepted_at', 'updated_at', 'public_token']) then
    raise exception 'Document émis : son contenu est figé.' using errcode = '42501';
  end if;
  if old.public_token is not null and new.public_token is distinct from old.public_token then
    raise exception 'Le lien public d''un document ne change pas.' using errcode = '42501';
  end if;
  if not private.transition_valide(old.type, old.status, new.status) then
    raise exception 'Changement de statut impossible : % vers %.', old.status, new.status using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Lecture publique : tout ce qu'il faut pour afficher le document, rien de plus.
create function public.document_public(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'document', to_jsonb(d) - array['internal_notes', 'created_by', 'issued_by', 'organization_id', 'client_id'],
    'lignes', coalesce((select jsonb_agg(to_jsonb(l) - array['organization_id', 'document_id', 'product_id'] order by l.position)
      from public.document_lines l where l.document_id = d.id), '[]'::jsonb),
    'origine', (select jsonb_build_object('number', o.number, 'issue_date', o.issue_date) from public.documents o where o.id = d.origin_document_id),
    'mentions', (select jsonb_object_agg(m.key, m.text) from public.legal_mentions m),
    'signature', (select to_jsonb(s) - array['organization_id', 'user_agent'] from public.quote_signatures s where s.document_id = d.id)
  )
  from public.documents d
  where d.public_token = p_token and d.status <> 'brouillon';
$$;

revoke all on function public.document_public(uuid) from public;
grant execute on function public.document_public(uuid) to anon, authenticated;

-- Décision du client sur un devis, depuis le lien public.
create function public.signer_devis(p_token uuid, p_decision text, p_nom text, p_email text, p_commentaire text, p_agent text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.documents;
  jour date := (now() at time zone 'Europe/Paris')::date;
begin
  select * into d from public.documents where public_token = p_token for update;
  if not found or d.type <> 'devis' then
    raise exception 'Devis introuvable.' using errcode = 'P0002';
  end if;
  if d.status <> 'envoye' then
    raise exception 'Ce devis n''attend plus de réponse.' using errcode = '55000';
  end if;
  if d.valid_until is not null and d.valid_until < jour then
    raise exception 'Ce devis a expiré le %.', to_char(d.valid_until, 'DD/MM/YYYY') using errcode = '55000';
  end if;
  if p_decision not in ('accepte', 'refuse') or length(trim(coalesce(p_nom, ''))) < 2 then
    raise exception 'Indiquez votre nom.' using errcode = '23514';
  end if;
  insert into public.quote_signatures (document_id, organization_id, decision, signer_name, signer_email, comment, content_hash, user_agent)
  values (d.id, d.organization_id, p_decision, trim(p_nom), nullif(trim(coalesce(p_email, '')), ''), nullif(trim(coalesce(p_commentaire, '')), ''),
    d.content_hash, left(p_agent, 300));
  update public.documents set
    status = p_decision::public.document_status,
    accepted_at = case when p_decision = 'accepte' then now() else accepted_at end
  where id = d.id;
  perform private.auditer(d.organization_id, 'devis.' || p_decision || '_en_ligne', 'devis', d.id, jsonb_build_object('signataire', trim(p_nom)));
  return p_decision;
end;
$$;

revoke all on function public.signer_devis(uuid, text, text, text, text, text) from public;
grant execute on function public.signer_devis(uuid, text, text, text, text, text) to anon, authenticated;
