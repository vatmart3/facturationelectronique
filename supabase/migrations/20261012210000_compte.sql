-- PASTILLE · Phase 10 · Suppression de compte (RGPD) avec conservation des archives fiscales.

-- Une entreprise close n'a plus de membre : ses documents émis restent conservés
-- pendant la durée légale (10 ans, art. L102 B du LPF), accessibles à l'administration de la plateforme.
alter table public.organizations add column closed_at timestamptz;

create or replace function private.protect_last_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner' or new.organization_id <> old.organization_id)
     and exists (select 1 from public.organizations o where o.id = old.organization_id and o.closed_at is null)
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

/**
 * Supprime le compte de l'utilisateur connecté :
 *  - entreprise dont il est seul membre, sans document émis : supprimée ;
 *  - entreprise dont il est seul membre, avec documents émis : close, archives conservées ;
 *  - entreprise où il est le seul propriétaire avec d'autres membres : refus (nommer un propriétaire).
 */
create function public.supprimer_mon_compte(p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  o record;
  supprimees integer := 0;
  closes integer := 0;
begin
  if uid is null then
    raise exception 'Authentification requise.' using errcode = '42501';
  end if;
  if p_confirmation is distinct from 'SUPPRIMER' then
    raise exception 'Tapez SUPPRIMER pour confirmer.' using errcode = '22023';
  end if;

  for o in
    select org.id, org.name,
      (select count(*) from public.memberships m2 where m2.organization_id = org.id) as membres,
      (select count(*) from public.memberships m3 where m3.organization_id = org.id and m3.role = 'owner' and m3.user_id <> uid) as autres_proprietaires,
      exists (select 1 from public.documents d where d.organization_id = org.id and d.status <> 'brouillon') as archives
    from public.memberships m join public.organizations org on org.id = m.organization_id
    where m.user_id = uid and m.role = 'owner'
  loop
    if o.membres > 1 and o.autres_proprietaires = 0 then
      raise exception 'Nommez un autre propriétaire de « % » avant de supprimer votre compte.', o.name using errcode = 'P0001';
    end if;
    if o.membres = 1 then
      if o.archives then
        update public.organizations set closed_at = now() where id = o.id;
        perform private.auditer(o.id, 'entreprise.close', 'organisation', o.id, '{}'::jsonb);
        closes := closes + 1;
      else
        delete from public.organizations where id = o.id;
        supprimees := supprimees + 1;
      end if;
    end if;
  end loop;

  delete from auth.users where id = uid;
  return jsonb_build_object('supprimees', supprimees, 'closes', closes);
end;
$$;

revoke all on function public.supprimer_mon_compte(text) from public, anon;
grant execute on function public.supprimer_mon_compte(text) to authenticated;

-- L'auteur d'un document émis peut disparaître (compte supprimé : created_by et issued_by
-- passent à null). Ces colonnes ne font pas partie du contenu empreinté.
create or replace function private.document_fige()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  libres text[] := array['status', 'amount_paid', 'sent_at', 'accepted_at', 'updated_at', 'public_token', 'created_by', 'issued_by'];
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
  if (to_jsonb(new) - libres) is distinct from (to_jsonb(old) - libres) then
    raise exception 'Document émis : son contenu est figé.' using errcode = '42501';
  end if;
  if (new.created_by is not null and new.created_by is distinct from old.created_by)
     or (new.issued_by is not null and new.issued_by is distinct from old.issued_by) then
    raise exception 'Document émis : son auteur ne change pas.' using errcode = '42501';
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

-- Journal d'audit : seules exceptions, les effets d'une suppression autorisée
-- (auteur anonymisé quand son compte disparaît, entreprise vide supprimée).
create or replace function private.audit_immuable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.actor_id is null and (to_jsonb(new) - 'actor_id') = (to_jsonb(old) - 'actor_id') then
    return new;
  end if;
  if tg_op = 'DELETE' and not exists (select 1 from public.organizations o where o.id = old.organization_id) then
    return old;
  end if;
  raise exception 'Le journal d''audit ne peut être ni modifié ni effacé.' using errcode = '42501';
end;
$$;
