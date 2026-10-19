import 'server-only'
import type { ConditionsPaiement } from './clients'
import { editionDepuisDb, type LigneDb } from './document'
import { construireImprimable, type ClientImprime, type DocumentImprimable, type VendeurImprime } from './imprimable'
import { creerClientServeur } from './supabase/serveur'
import type { DocumentRow, QuoteSignatureRow } from './supabase/types'

export interface DocumentPublic {
  document: Omit<DocumentRow, 'internal_notes' | 'created_by' | 'issued_by' | 'organization_id' | 'client_id'>
  imprimable: DocumentImprimable
  signature: Omit<QuoteSignatureRow, 'organization_id' | 'user_agent'> | null
}

/** Document consulté par le client via son lien (aucune session requise). */
export async function chargerPublic(token: string): Promise<DocumentPublic | null> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null
  const supabase = await creerClientServeur()
  const { data } = await supabase.rpc('document_public', { p_token: token })
  const r = data as {
    document: DocumentPublic['document']
    lignes: Array<LigneDb & { id: string }>
    origine: { number: string; issue_date: string } | null
    mentions: Record<string, string> | null
    signature: DocumentPublic['signature']
    paiement_en_ligne: string | null
  } | null
  if (!r?.document) return null
  const d = r.document
  const edition = editionDepuisDb({ ...d, client_id: null, internal_notes: null }, r.lignes, (d.payment_terms ?? '30j') as ConditionsPaiement)
  const imprimable = construireImprimable({
    edition,
    numero: d.number,
    brouillon: false,
    dateEcheance: d.due_date,
    vendeur: d.seller_snapshot as VendeurImprime,
    client: d.client_snapshot as ClientImprime,
    textes: r.mentions ?? {},
    origine: r.origine ? { numero: r.origine.number, date: r.origine.issue_date } : null,
    empreinte: d.content_hash,
    paye: d.status === 'paye',
    lienPaiement: r.paiement_en_ligne ?? null,
  })
  return imprimable ? { document: d, imprimable, signature: r.signature } : null
}
