-- PASTILLE · comptes et entreprise de démonstration.
-- À exécuter dans Supabase > SQL Editor, APRÈS toutes les migrations. Une seule fois.
-- Crée trois comptes (gérant, expert-comptable, administrateur de la plateforme) et l'entreprise
-- fictive « Atelier Lumen » avec clients, catalogue, factures émises, avoir, devis et paiements.
-- Les identifiants (SIREN, TVA, IBAN) sont fictifs. Pour tout retirer : voir la fin du fichier.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create function pg_temp.compte(p_email text, p_nom text, p_mdp text)
returns uuid
language plpgsql
as $$
declare
  uid uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', p_email,
    extensions.crypt(p_mdp, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', p_nom), now(), now(),
    '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', p_email, 'email_verified', true), 'email', now(), now(), now());
  return uid;
end;
$$;

-- Document au taux normal de 20 % : lignes = [[désignation, quantité, prix unitaire en centimes, nature], …].
create function pg_temp.document(p_org uuid, p_type text, p_client uuid, p_date date, p_objet text, p_lignes jsonb, p_origine uuid default null)
returns uuid
language plpgsql
as $$
declare
  ht bigint := 0;
  tva bigint;
  lignes jsonb := '[]';
  l jsonb;
  i integer := 0;
  net bigint;
  natures text[] := '{}';
begin
  for l in select * from jsonb_array_elements(p_lignes) loop
    i := i + 1;
    net := (l ->> 1)::bigint * (l ->> 2)::bigint;
    ht := ht + net;
    natures := natures || (l ->> 3);
    lignes := lignes || jsonb_build_object(
      'position', i, 'designation', l ->> 0, 'quantity_milli', (l ->> 1)::bigint * 1000, 'unit', 'unité',
      'unit_price_cents', (l ->> 2)::bigint, 'vat_category', 'S', 'vat_rate', 2000, 'nature', l ->> 3, 'line_net_cents', net);
  end loop;
  tva := round(ht * 0.2);
  return public.enregistrer_brouillon(
    p_org, null,
    jsonb_build_object(
      'type', p_type, 'client_id', p_client, 'issue_date', p_date, 'service_date', p_date, 'subject', p_objet,
      'due_date', case when p_type in ('devis', 'avoir') then null else p_date + 30 end,
      'valid_until', case when p_type = 'devis' then p_date + 30 end,
      'payment_terms', '30j', 'origin_document_id', p_origine,
      'operation_category', case when 'bien' = all (natures) then 'biens' when 'service' = all (natures) then 'services' else 'mixte' end,
      'total_lines_ht', ht, 'total_ht', ht, 'total_vat', tva, 'total_ttc', ht + tva, 'amount_due', ht + tva),
    lignes,
    jsonb_build_array(jsonb_build_object('position', 1, 'vat_category', 'S', 'vat_rate', 2000, 'base_cents', ht, 'vat_cents', tva)));
end;
$$;

do $$
declare
  mdp constant text := 'Pastille-Demo-2026';
  gerant uuid;
  comptable uuid;
  administrateur uuid;
  org uuid;
  martin uuid;
  kerozen uuid;
  ferrand uuid;
  dubois uuid;
  f1 uuid; f2 uuid; f3 uuid; f4 uuid; f5 uuid; f6 uuid; a1 uuid; d1 uuid; d2 uuid;
begin
  if exists (select 1 from auth.users where email like '%@pastille-demo.fr') then
    raise exception 'Les comptes de démonstration existent déjà.';
  end if;

  gerant := pg_temp.compte('gerant@pastille-demo.fr', 'Camille Lefèvre', mdp);
  comptable := pg_temp.compte('comptable@pastille-demo.fr', 'Hugo Bernard', mdp);
  administrateur := pg_temp.compte('admin@pastille-demo.fr', 'Administrateur Pastille', mdp);
  insert into public.platform_admins (user_id) values (administrateur);

  -- Tout le reste est créé au nom du gérant, par les mêmes fonctions que l'application.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', gerant, 'role', 'authenticated')::text, true);

  org := (public.create_organization('Atelier Lumen')).id;
  update public.organizations set
    legal_form = 'SAS', share_capital_cents = 1000000, siren = '842153678', siret = '84215367800011', vat_number = 'FR16842153678',
    naf_code = '7410Z', registration = 'RCS Lyon', address_line1 = '12 rue des Capucins', postal_code = '69001', city = 'Lyon',
    vat_regime = 'reel_simplifie', iban = 'FR7630006000011234567890189', bic = 'AGRIFRPP'
  where id = org;
  update public.subscriptions set trial_ends_at = now() + interval '30 days' where organization_id = org;
  insert into public.memberships (organization_id, user_id, role) values (org, comptable, 'accountant');

  insert into public.clients (organization_id, kind, name, legal_form, siren, siret, vat_number, billing_line1, billing_postal_code, billing_city)
  values (org, 'b2b', 'Boulangerie Martin', 'SARL', '812904555', '81290455500016', 'FR11812904555', '4 place Sathonay', '69001', 'Lyon')
  returning id into martin;
  insert into public.clients (organization_id, kind, name, legal_form, siren, siret, vat_number, billing_line1, billing_postal_code, billing_city)
  values (org, 'b2b', 'Studio Kerozen', 'SAS', '793402181', '79340218100010', 'FR88793402181', '27 rue de Charonne', '75011', 'Paris')
  returning id into kerozen;
  insert into public.clients (organization_id, kind, name, legal_form, siren, siret, vat_number, billing_line1, billing_postal_code, billing_city)
  values (org, 'b2b', 'Maison Ferrand', 'SAS', '901174623', '90117462300016', 'FR21901174623', '8 quai Saint-Vincent', '69001', 'Lyon')
  returning id into ferrand;
  insert into public.clients (organization_id, kind, name, billing_line1, billing_postal_code, billing_city)
  values (org, 'b2c', 'Claire Dubois', '15 rue Mercière', '69002', 'Lyon')
  returning id into dubois;

  insert into public.products (organization_id, name, unit, unit_price_cents, nature, category, favorite) values
    (org, 'Identité visuelle', 'forfait', 180000, 'service', 'Création', true),
    (org, 'Site vitrine', 'forfait', 320000, 'service', 'Web', true),
    (org, 'Journée de conseil', 'jour', 65000, 'service', 'Conseil', false),
    (org, 'Maintenance du site', 'mois', 9000, 'service', 'Web', false),
    (org, 'Impression de 500 flyers', 'lot', 24000, 'bien', 'Impression', false);

  -- Factures émises, dans l'ordre chronologique (numérotation sans trou, empreintes chaînées).
  f1 := pg_temp.document(org, 'facture', martin, '2026-07-08', 'Identité visuelle', '[["Identité visuelle", 1, 180000, "service"]]');
  perform public.emettre_document(f1);
  f2 := pg_temp.document(org, 'facture', kerozen, '2026-08-04', 'Site vitrine et accompagnement',
    '[["Site vitrine", 1, 320000, "service"], ["Journée de conseil", 2, 65000, "service"]]');
  perform public.emettre_document(f2);
  f3 := pg_temp.document(org, 'facture', dubois, '2026-08-21', 'Flyers pour l''exposition', '[["Impression de 500 flyers", 1, 24000, "bien"]]');
  perform public.emettre_document(f3);
  f4 := pg_temp.document(org, 'facture', martin, '2026-09-02', 'Maintenance juillet à septembre', '[["Maintenance du site", 3, 9000, "service"]]');
  perform public.emettre_document(f4);
  f5 := pg_temp.document(org, 'facture', kerozen, '2026-09-15', 'Accompagnement éditorial', '[["Journée de conseil", 4, 65000, "service"]]');
  perform public.emettre_document(f5);
  f6 := pg_temp.document(org, 'facture', ferrand, '2026-10-05', 'Refonte de l''identité', '[["Identité visuelle", 1, 180000, "service"], ["Site vitrine", 1, 320000, "service"]]');
  perform public.emettre_document(f6);

  -- Avoir partiel sur la facture de Studio Kerozen : une journée de conseil non réalisée.
  a1 := pg_temp.document(org, 'avoir', kerozen, '2026-09-20', 'Journée de conseil annulée', '[["Journée de conseil", -1, 65000, "service"]]', f2);
  perform public.emettre_document(a1);

  -- Devis envoyés et un brouillon de facture.
  d1 := pg_temp.document(org, 'devis', ferrand, '2026-09-28', 'Maintenance annuelle', '[["Maintenance du site", 12, 9000, "service"]]');
  perform public.emettre_document(d1);
  d2 := pg_temp.document(org, 'devis', dubois, '2026-10-08', 'Flyers pour le salon', '[["Impression de 500 flyers", 2, 24000, "bien"]]');
  perform public.emettre_document(d2);
  perform pg_temp.document(org, 'facture', martin, '2026-10-12', 'Maintenance octobre', '[["Maintenance du site", 1, 9000, "service"]]');

  perform public.changer_statut(f4, 'envoye');
  perform public.changer_statut(f5, 'envoye');
  perform public.changer_statut(f6, 'envoye');

  -- Paiements : F1, F2 et F3 soldées (l'avoir sur F2 reste à rembourser), F5 payée en partie, F4 en retard.
  insert into public.payments (organization_id, document_id, amount_cents, paid_on, method, reference) values
    (org, f1, 216000, '2026-07-30', 'virement', 'VIR BOULANGERIE MARTIN'),
    (org, f2, 540000, '2026-08-28', 'virement', 'VIR STUDIO KEROZEN'),
    (org, f3, 28800, '2026-08-21', 'carte', null),
    (org, f5, 100000, '2026-10-01', 'virement', 'ACOMPTE KEROZEN');

  perform set_config('request.jwt.claims', '', true);
  raise notice 'Démonstration prête : gerant@pastille-demo.fr, comptable@pastille-demo.fr, admin@pastille-demo.fr (mot de passe %).', mdp;
end;
$$;

-- Pour tout retirer avant l'ouverture au public, exécuter le bloc ci-dessous (décommenté).
-- Les protections légales (une facture émise ne se supprime pas) sont suspendues le temps de la
-- transaction, uniquement pour effacer ces données fictives, puis rétablies.
--
-- begin;
-- do $x$
-- declare t text;
-- begin
--   for t in select tablename from pg_tables where schemaname = 'public' loop
--     execute format('alter table public.%I disable trigger user', t);
--   end loop;
--   delete from public.organizations where slug like 'atelier-lumen%';
--   delete from auth.users where email like '%@pastille-demo.fr';
--   for t in select tablename from pg_tables where schemaname = 'public' loop
--     execute format('alter table public.%I enable trigger user', t);
--   end loop;
-- end;
-- $x$;
-- commit;
