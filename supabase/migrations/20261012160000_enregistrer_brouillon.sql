-- Enregistrement atomique d'un brouillon : document, lignes et récapitulatif de TVA
-- dans une seule transaction. Exécuté avec les droits de l'appelant (RLS appliquée).

create function public.enregistrer_brouillon(
  p_organization uuid,
  p_id uuid,
  p_document jsonb,
  p_lignes jsonb,
  p_tva jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  d public.documents;
begin
  d := jsonb_populate_record(null::public.documents, p_document);

  if v_id is null then
    insert into public.documents (
      organization_id, type, client_id, issue_date, service_date, service_period_start, service_period_end,
      due_date, valid_until, purchase_order, subject, public_notes, internal_notes, currency, language,
      payment_terms, early_payment_discount, discount_kind, discount_value,
      total_lines_ht, discount_total, deposits_ht, total_ht, total_vat, total_ttc, amount_due,
      operation_category, origin_document_id, deducted_deposits
    ) values (
      p_organization, d.type, d.client_id, coalesce(d.issue_date, current_date), d.service_date, d.service_period_start, d.service_period_end,
      d.due_date, d.valid_until, d.purchase_order, d.subject, d.public_notes, d.internal_notes, coalesce(d.currency, 'EUR'), coalesce(d.language, 'fr'),
      d.payment_terms, d.early_payment_discount, d.discount_kind, d.discount_value,
      coalesce(d.total_lines_ht, 0), coalesce(d.discount_total, 0), coalesce(d.deposits_ht, 0), coalesce(d.total_ht, 0),
      coalesce(d.total_vat, 0), coalesce(d.total_ttc, 0), coalesce(d.amount_due, 0),
      d.operation_category, d.origin_document_id, coalesce(d.deducted_deposits, '[]'::jsonb)
    )
    returning id into v_id;
  else
    update public.documents set
      client_id = d.client_id,
      issue_date = coalesce(d.issue_date, issue_date),
      service_date = d.service_date,
      service_period_start = d.service_period_start,
      service_period_end = d.service_period_end,
      due_date = d.due_date,
      valid_until = d.valid_until,
      purchase_order = d.purchase_order,
      subject = d.subject,
      public_notes = d.public_notes,
      internal_notes = d.internal_notes,
      currency = coalesce(d.currency, currency),
      language = coalesce(d.language, language),
      payment_terms = d.payment_terms,
      early_payment_discount = d.early_payment_discount,
      discount_kind = d.discount_kind,
      discount_value = d.discount_value,
      total_lines_ht = coalesce(d.total_lines_ht, 0),
      discount_total = coalesce(d.discount_total, 0),
      deposits_ht = coalesce(d.deposits_ht, 0),
      total_ht = coalesce(d.total_ht, 0),
      total_vat = coalesce(d.total_vat, 0),
      total_ttc = coalesce(d.total_ttc, 0),
      amount_due = coalesce(d.amount_due, 0),
      operation_category = d.operation_category,
      deducted_deposits = coalesce(d.deducted_deposits, '[]'::jsonb)
    where id = v_id and organization_id = p_organization and status = 'brouillon';
    if not found then
      raise exception 'Document introuvable ou déjà émis : il ne peut plus être modifié.' using errcode = 'P0002';
    end if;
  end if;

  delete from public.document_lines where document_id = v_id;
  insert into public.document_lines (
    organization_id, document_id, position, product_id, designation, description, quantity_milli, unit,
    unit_price_cents, discount_kind, discount_value, vat_category, vat_rate, exemption_reason, nature, line_net_cents
  )
  select
    p_organization, v_id, l.position, l.product_id, coalesce(l.designation, ''), l.description, l.quantity_milli, coalesce(l.unit, 'unité'),
    l.unit_price_cents, l.discount_kind, l.discount_value, l.vat_category, l.vat_rate, l.exemption_reason, l.nature, coalesce(l.line_net_cents, 0)
  from jsonb_to_recordset(coalesce(p_lignes, '[]'::jsonb)) as l(
    position integer, product_id uuid, designation text, description text, quantity_milli bigint, unit text,
    unit_price_cents bigint, discount_kind public.discount_kind, discount_value bigint, vat_category text, vat_rate integer,
    exemption_reason text, nature public.item_nature, line_net_cents bigint
  );

  delete from public.document_vat_summary where document_id = v_id;
  insert into public.document_vat_summary (organization_id, document_id, position, vat_category, vat_rate, base_cents, vat_cents, exemption_reason)
  select p_organization, v_id, t.position, t.vat_category, t.vat_rate, t.base_cents, t.vat_cents, t.exemption_reason
  from jsonb_to_recordset(coalesce(p_tva, '[]'::jsonb)) as t(
    position integer, vat_category text, vat_rate integer, base_cents bigint, vat_cents bigint, exemption_reason text
  );

  return v_id;
end;
$$;

revoke all on function public.enregistrer_brouillon(uuid, uuid, jsonb, jsonb, jsonb) from public;
revoke all on function public.enregistrer_brouillon(uuid, uuid, jsonb, jsonb, jsonb) from anon;
grant execute on function public.enregistrer_brouillon(uuid, uuid, jsonb, jsonb, jsonb) to authenticated;
