import 'server-only'
import type { CategorieTva } from '@pastille/moteur'
import type { DocExport } from './exports'
import type { ClientSupabase } from './documents-serveur'

/** Documents émis (factures, acomptes, avoirs) d'une période, prêts pour les exports comptables. */
export async function documentsExport(supabase: ClientSupabase, organisationId: string, du: string, au: string): Promise<Array<DocExport & { content_hash: string | null }>> {
  const { data: docs } = await supabase
    .from('documents')
    .select('id, type, number, issue_date, client_id, client_snapshot, total_ht, total_ttc, content_hash')
    .eq('organization_id', organisationId)
    .in('type', ['facture', 'acompte', 'avoir'])
    .neq('status', 'brouillon')
    .gte('issue_date', du)
    .lte('issue_date', au)
    .order('issue_date')
    .limit(2000)
  const ids = (docs ?? []).map((d) => d.id)
  if (ids.length === 0) return []
  const [{ data: lignes }, { data: tva }, { data: produits }] = await Promise.all([
    supabase.from('document_lines').select('document_id, nature, line_net_cents, product_id, vat_category, vat_rate').in('document_id', ids),
    supabase.from('document_vat_summary').select('document_id, vat_category, vat_rate, base_cents, vat_cents').in('document_id', ids),
    supabase.from('products').select('id, accounting_account').eq('organization_id', organisationId).not('accounting_account', 'is', null),
  ])
  const comptes = new Map((produits ?? []).map((p) => [p.id, p.accounting_account]))
  return (docs ?? []).map((d) => ({
    id: d.id,
    type: d.type as DocExport['type'],
    number: d.number ?? '',
    issue_date: d.issue_date,
    client: { id: d.client_id ?? d.id, name: (d.client_snapshot as { name?: string } | null)?.name ?? '' },
    total_ht: Number(d.total_ht),
    total_ttc: Number(d.total_ttc),
    content_hash: d.content_hash,
    lignes: (lignes ?? [])
      .filter((l) => l.document_id === d.id)
      .map((l) => ({
        nature: l.nature,
        montant: Number(l.line_net_cents),
        compte: (l.product_id && comptes.get(l.product_id)) || null,
        categorie: l.vat_category as CategorieTva,
        taux: l.vat_rate,
      })),
    tva: (tva ?? [])
      .filter((t) => t.document_id === d.id)
      .map((t) => ({ categorie: t.vat_category as CategorieTva, taux: t.vat_rate, base: Number(t.base_cents), montant: Number(t.vat_cents) })),
  }))
}
