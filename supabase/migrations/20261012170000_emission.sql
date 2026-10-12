-- PASTILLE · Phase 5 · Émission et intégrité
-- Numérotation continue sans trou par série, contenu figé après émission,
-- empreintes SHA-256 chaînées par organisation et journal d'audit en ajout seul.

-- ---------------------------------------------------------------------------
-- Journal d'audit (ajout seul, y compris pour le rôle de service)
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (length(action) <= 60),
  entity text not null check (length(entity) <= 40),
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_org_idx on public.audit_log (organization_id, created_at desc);
create index audit_log_entity_idx on public.audit_log (entity_id);
create index audit_log_actor_idx on public.audit_log (actor_id);

revoke all on table public.audit_log from anon, authenticated;
grant select on table public.audit_log to authenticated;
alter table public.audit_log enable row level security;
create policy audit_log_select on public.audit_log for select to authenticated
  using (private.has_role(organization_id, array['owner', 'admin', 'accountant']::public.member_role[]));

create function private.audit_immuable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Le journal d''audit ne peut être ni modifié ni effacé.' using errcode = '42501';
end;
$$;

create trigger audit_log_immuable before update or delete on public.audit_log
for each row execute function private.audit_immuable();

create function private.auditer(org uuid, p_action text, p_entity text, p_entity_id uuid, p_details jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (organization_id, actor_id, action, entity, entity_id, details)
  values (org, (select auth.uid()), p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;
revoke all on function private.auditer(uuid, text, text, uuid, jsonb) from public;

-- Création, changement de statut et suppression des documents.
create function private.auditer_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.auditer(new.organization_id, 'document.cree', new.type::text, new.id);
  elsif tg_op = 'DELETE' then
    perform private.auditer(old.organization_id, 'document.supprime', old.type::text, old.id);
  elsif new.status is distinct from old.status then
    perform private.auditer(new.organization_id, 'document.' || new.status::text, new.type::text, new.id,
      jsonb_build_object('de', old.status, 'numero', new.number));
  end if;
  return null;
end;
$$;

create trigger documents_audit after insert or update or delete on public.documents
for each row execute function private.auditer_document();

-- ---------------------------------------------------------------------------
-- Immuabilité d'un document émis
-- ---------------------------------------------------------------------------

alter table public.documents add column chain_position bigint;
create unique index documents_chaine_idx on public.documents (organization_id, chain_position) where chain_position is not null;

-- Transitions de statut autorisées après l'émission.
create function private.transition_valide(t public.document_type, de public.document_status, vers public.document_status)
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
      ('paye', 'partiellement_paye'), ('paye', 'envoye'), ('partiellement_paye', 'envoye'))
  end;
$$;

create function private.document_fige()
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
  -- Après émission, seuls le statut, les encaissements et les dates de suivi évoluent.
  if (to_jsonb(new) - array['status', 'amount_paid', 'sent_at', 'accepted_at', 'updated_at'])
     is distinct from (to_jsonb(old) - array['status', 'amount_paid', 'sent_at', 'accepted_at', 'updated_at']) then
    raise exception 'Document émis : son contenu est figé.' using errcode = '42501';
  end if;
  if not private.transition_valide(old.type, old.status, new.status) then
    raise exception 'Changement de statut impossible : % vers %.', old.status, new.status using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger documents_fige before update or delete on public.documents
for each row execute function private.document_fige();

create function private.contenu_fige()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  doc uuid := coalesce(new.document_id, old.document_id);
  statut public.document_status;
begin
  select d.status into statut from public.documents d where d.id = doc;
  -- Document absent : suppression en cascade d'un brouillon.
  if statut is not null and statut <> 'brouillon' then
    raise exception 'Document émis : ses lignes sont figées.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger document_lines_fige before insert or update or delete on public.document_lines
for each row execute function private.contenu_fige();
create trigger document_vat_summary_fige before insert or update or delete on public.document_vat_summary
for each row execute function private.contenu_fige();

-- ---------------------------------------------------------------------------
-- Numérotation
-- ---------------------------------------------------------------------------

create table public.document_sequences (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sequence_key text not null,
  last_number integer not null check (last_number >= 0),
  updated_at timestamptz not null default now(),
  primary key (organization_id, sequence_key)
);
revoke all on table public.document_sequences from anon, authenticated;
grant select on table public.document_sequences to authenticated;
alter table public.document_sequences enable row level security;
create policy document_sequences_select on public.document_sequences for select to authenticated using (private.is_member(organization_id));

-- Tête de chaîne des empreintes : un verrou par organisation sérialise les émissions.
create table public.document_chains (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  last_position bigint not null default 0,
  last_hash text
);
revoke all on table public.document_chains from anon, authenticated;
grant select on table public.document_chains to authenticated;
alter table public.document_chains enable row level security;
create policy document_chains_select on public.document_chains for select to authenticated using (private.is_member(organization_id));

-- Aligné sur apps/web/src/lib/numerotation.ts (formaterNumero, cleSequence).
create function private.formater_numero(format text, annee integer, mois integer, numero integer)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  resultat text := format;
  m text[];
begin
  resultat := replace(resultat, '{AAAA}', annee::text);
  resultat := replace(resultat, '{AA}', right(annee::text, 2));
  resultat := replace(resultat, '{MM}', lpad(mois::text, 2, '0'));
  for m in select regexp_matches(format, '\{(N+)\}', 'g') loop
    resultat := replace(resultat, '{' || m[1] || '}', lpad(numero::text, length(m[1]), '0'));
  end loop;
  return resultat;
end;
$$;

create function private.periode_sequence(format text, annee integer, mois integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when format like '%{MM}%' then annee::text || '-' || lpad(mois::text, 2, '0')
    when format like '%{AAAA}%' or format like '%{AA}%' then annee::text
    else 'unique'
  end;
$$;

-- ---------------------------------------------------------------------------
-- Empreinte d'un document : contenu canonique (jsonb trié) + empreinte précédente
-- ---------------------------------------------------------------------------

create function private.contenu_canonique(doc uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'organisation', d.organization_id,
    'type', d.type,
    'numero', d.number,
    'position', d.chain_position,
    'date', d.issue_date,
    'prestation', jsonb_build_array(d.service_date, d.service_period_start, d.service_period_end),
    'echeance', d.due_date,
    'validite', d.valid_until,
    'commande', d.purchase_order,
    'devise', d.currency,
    'conditions', d.payment_terms,
    'escompte', d.early_payment_discount,
    'remise', jsonb_build_array(d.discount_kind, d.discount_value),
    'totaux', jsonb_build_array(d.total_lines_ht, d.discount_total, d.deposits_ht, d.total_ht, d.total_vat, d.total_ttc, d.amount_due),
    'origine', d.origin_document_id,
    'acomptes', d.deducted_deposits,
    'vendeur', d.seller_snapshot,
    'client', d.client_snapshot,
    'lignes', coalesce((
      select jsonb_agg(jsonb_build_array(l.position, l.designation, l.description, l.quantity_milli, l.unit, l.unit_price_cents,
        l.discount_kind, l.discount_value, l.vat_category, l.vat_rate, l.exemption_reason, l.nature, l.line_net_cents) order by l.position)
      from public.document_lines l where l.document_id = d.id), '[]'::jsonb),
    'tva', coalesce((
      select jsonb_agg(jsonb_build_array(t.vat_category, t.vat_rate, t.base_cents, t.vat_cents, t.exemption_reason) order by t.position)
      from public.document_vat_summary t where t.document_id = d.id), '[]'::jsonb),
    'precedente', d.previous_hash
  )::text
  from public.documents d where d.id = doc;
$$;
revoke all on function private.contenu_canonique(uuid) from public;

create function private.empreinte(doc uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(sha256(convert_to(private.contenu_canonique(doc), 'UTF8')), 'hex');
$$;
revoke all on function private.empreinte(uuid) from public;

-- ---------------------------------------------------------------------------
-- Émission
-- ---------------------------------------------------------------------------

create function public.emettre_document(p_id uuid)
returns public.documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.documents;
  o public.organizations;
  c public.clients;
  serie text;
  format text;
  periode text;
  cle text;
  dernier integer;
  numero integer;
  chaine public.document_chains;
  date_max date;
  jour date := (now() at time zone 'Europe/Paris')::date;
  origine public.documents;
  cumul_avoirs bigint;
begin
  select * into d from public.documents where id = p_id for update;
  if not found or not private.peut_editer(d.organization_id) then
    raise exception 'Document introuvable.' using errcode = 'P0002';
  end if;
  if d.status <> 'brouillon' then
    raise exception 'Ce document est déjà émis.' using errcode = '55000';
  end if;
  if d.client_id is null then
    raise exception 'Choisissez un client avant d''émettre.' using errcode = '23514';
  end if;
  if not exists (select 1 from public.document_lines l where l.document_id = d.id) then
    raise exception 'Le document ne contient aucune ligne.' using errcode = '23514';
  end if;
  if d.type = 'avoir' and d.origin_document_id is null then
    raise exception 'Un avoir doit se rapporter à une facture.' using errcode = '23514';
  end if;
  if d.issue_date > jour then
    raise exception 'La date d''émission ne peut pas être dans le futur.' using errcode = '23514';
  end if;

  select * into o from public.organizations where id = d.organization_id;
  select * into c from public.clients where id = d.client_id;

  -- Série : factures et factures d'acompte partagent la même numérotation.
  serie := case d.type when 'devis' then 'devis' when 'avoir' then 'avoir' else 'facture' end;
  format := case serie when 'devis' then o.quote_number_format when 'avoir' then o.credit_number_format else o.invoice_number_format end;
  periode := private.periode_sequence(format, extract(year from d.issue_date)::integer, extract(month from d.issue_date)::integer);
  cle := serie || ':' || periode;

  -- Ordre chronologique dans la série.
  select max(x.issue_date) into date_max from public.documents x
  where x.organization_id = d.organization_id and x.sequence_key = cle;
  if date_max is not null and d.issue_date < date_max then
    raise exception 'Date d''émission antérieure au dernier document de la série (%) : la numérotation doit rester chronologique.',
      to_char(date_max, 'DD/MM/YYYY') using errcode = '23514';
  end if;

  -- Verrou de la série : deux émissions simultanées ne peuvent pas obtenir le même numéro.
  insert into public.document_sequences (organization_id, sequence_key, last_number)
  values (
    d.organization_id, cle,
    case when serie = 'facture' and not exists (
      select 1 from public.document_sequences s where s.organization_id = d.organization_id and s.sequence_key like 'facture:%'
    ) then greatest(o.invoice_start_number - 1, 0) else 0 end
  )
  on conflict (organization_id, sequence_key) do nothing;
  select last_number into dernier from public.document_sequences
  where organization_id = d.organization_id and sequence_key = cle for update;
  numero := dernier + 1;
  update public.document_sequences set last_number = numero, updated_at = now()
  where organization_id = d.organization_id and sequence_key = cle;

  -- Tête de chaîne (verrou par organisation).
  insert into public.document_chains (organization_id) values (d.organization_id) on conflict do nothing;
  select * into chaine from public.document_chains where organization_id = d.organization_id for update;

  update public.documents set
    number = private.formater_numero(format, extract(year from d.issue_date)::integer, extract(month from d.issue_date)::integer, numero),
    sequence_key = cle,
    sequence_number = numero,
    issued_at = now(),
    issued_by = (select auth.uid()),
    chain_position = chaine.last_position + 1,
    previous_hash = chaine.last_hash,
    seller_snapshot = jsonb_build_object(
      'name', o.name, 'legal_form', o.legal_form, 'share_capital_cents', o.share_capital_cents,
      'siren', o.siren, 'siret', o.siret, 'vat_number', o.vat_number, 'naf_code', o.naf_code, 'registration', o.registration,
      'address_line1', o.address_line1, 'address_line2', o.address_line2, 'postal_code', o.postal_code, 'city', o.city,
      'country_code', o.country_code, 'vat_regime', o.vat_regime, 'vat_on_debits', o.vat_on_debits,
      'iban', o.iban, 'bic', o.bic, 'late_penalty_terms', o.late_penalty_terms, 'early_payment_discount', o.early_payment_discount,
      'accent_color', o.accent_color, 'invoice_template', o.invoice_template, 'invoice_font', o.invoice_font,
      'logo_path', o.logo_path, 'footer_text', o.footer_text, 'terms_text', o.terms_text),
    client_snapshot = jsonb_build_object(
      'kind', c.kind, 'name', c.name, 'legal_form', c.legal_form, 'siren', c.siren, 'siret', c.siret, 'vat_number', c.vat_number,
      'einvoice_address', c.einvoice_address, 'service_code', c.service_code,
      'billing_line1', c.billing_line1, 'billing_line2', c.billing_line2, 'billing_postal_code', c.billing_postal_code,
      'billing_city', c.billing_city, 'billing_country', c.billing_country,
      'shipping_different', c.shipping_different, 'shipping_line1', c.shipping_line1, 'shipping_line2', c.shipping_line2,
      'shipping_postal_code', c.shipping_postal_code, 'shipping_city', c.shipping_city, 'shipping_country', c.shipping_country,
      'custom_mentions', c.custom_mentions)
  where id = d.id;

  -- L'empreinte est posée dans la même mise à jour que le passage hors brouillon :
  -- ensuite, le contenu est figé (private.document_fige).
  update public.documents set
    content_hash = private.empreinte(d.id),
    status = case when d.type = 'devis' then 'envoye'::public.document_status else 'emis'::public.document_status end,
    sent_at = case when d.type = 'devis' then now() else null end
  where id = d.id
  returning * into d;
  update public.document_chains set last_position = d.chain_position, last_hash = d.content_hash
  where organization_id = d.organization_id;

  -- Effets sur le document d'origine.
  if d.origin_document_id is not null then
    select * into origine from public.documents where id = d.origin_document_id for update;
    if d.type = 'facture' and origine.type = 'devis' and origine.status in ('envoye', 'accepte') then
      update public.documents set status = 'transforme' where id = origine.id;
    elsif d.type = 'avoir' and origine.type in ('facture', 'acompte') then
      select coalesce(sum(a.total_ttc), 0) into cumul_avoirs from public.documents a
      where a.origin_document_id = origine.id and a.type = 'avoir' and a.status <> 'brouillon';
      if cumul_avoirs + origine.total_ttc <= 0 and origine.status in ('emis', 'envoye', 'partiellement_paye') then
        update public.documents set status = 'annule' where id = origine.id;
      end if;
    end if;
  end if;

  return d;
end;
$$;

revoke all on function public.emettre_document(uuid) from public, anon;
grant execute on function public.emettre_document(uuid) to authenticated;

-- Suivi d'un document émis : envoi, décision sur un devis.
create function public.changer_statut(p_id uuid, p_statut public.document_status)
returns public.documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.documents;
begin
  select * into d from public.documents where id = p_id for update;
  if not found or not private.peut_editer(d.organization_id) then
    raise exception 'Document introuvable.' using errcode = 'P0002';
  end if;
  if d.status = 'brouillon' or p_statut in ('brouillon', 'emis', 'paye', 'partiellement_paye', 'annule', 'transforme') then
    raise exception 'Changement de statut impossible.' using errcode = '42501';
  end if;
  update public.documents set
    status = p_statut,
    sent_at = case when p_statut = 'envoye' then coalesce(sent_at, now()) else sent_at end,
    accepted_at = case when p_statut = 'accepte' then now() else accepted_at end
  where id = p_id
  returning * into d;
  return d;
end;
$$;

revoke all on function public.changer_statut(uuid, public.document_status) from public, anon;
grant execute on function public.changer_statut(uuid, public.document_status) to authenticated;

-- Vérification de la chaîne : chaque empreinte est recalculée et comparée.
create function public.verifier_chaine(p_organization uuid)
returns table (chain_position bigint, document_id uuid, number text, empreinte_ok boolean, lien_ok boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    d.chain_position,
    d.id,
    d.number,
    d.content_hash = private.empreinte(d.id),
    d.previous_hash is not distinct from lag(d.content_hash) over (order by d.chain_position)
  from public.documents d
  where d.organization_id = p_organization
    and d.chain_position is not null
    and private.is_member(p_organization)
  order by d.chain_position;
$$;

revoke all on function public.verifier_chaine(uuid) from public, anon;
grant execute on function public.verifier_chaine(uuid) to authenticated;

-- Le numéro de départ ne peut plus changer une fois la première facture émise.
create function private.numero_depart_fige()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.invoice_start_number <> old.invoice_start_number and exists (
    select 1 from public.document_sequences s where s.organization_id = new.id and s.sequence_key like 'facture:%'
  ) then
    raise exception 'Le numéro de départ ne peut plus être modifié après la première facture.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger organizations_numero_depart before update of invoice_start_number on public.organizations
for each row execute function private.numero_depart_fige();
