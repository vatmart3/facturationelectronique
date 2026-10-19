-- Lien de paiement en ligne (Stripe, SumUp, PayPal…) affiché sur les factures, la page publique et les emails.

alter table public.organizations
  add column payment_link text check (payment_link is null or (payment_link ~ '^https://[^[:space:]]+$' and length(payment_link) <= 500));

grant update (payment_link) on table public.organizations to authenticated;

-- La page publique d'un document expose ce lien, seulement pour une facture qui reste à régler.
create or replace function public.document_public(p_token uuid)
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
    'signature', (select to_jsonb(s) - array['organization_id', 'user_agent'] from public.quote_signatures s where s.document_id = d.id),
    'paiement_en_ligne', case
      when d.type in ('facture', 'acompte') and d.status not in ('paye', 'annule')
      then (select o.payment_link from public.organizations o where o.id = d.organization_id)
    end
  )
  from public.documents d
  where d.public_token = p_token and d.status <> 'brouillon';
$$;
