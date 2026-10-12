'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { calculer, depuisLigneDb, echeance, validerEdition, versLignesDb, type DocumentEdition, type LigneEdition, type TypeDocument } from '@/lib/document'
import { peutFacturer } from '@/lib/roles'
import { chargerContexte } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export type ResultatEnregistrement = { ok: true; id: string; le: string } | { ok: false; erreur: string }

const CHEMINS: Record<TypeDocument, string> = {
  facture: 'ventes/factures',
  acompte: 'ventes/factures',
  devis: 'ventes/devis',
  avoir: 'ventes/avoirs',
}

export async function cheminDocument(slug: string, type: TypeDocument, id: string): Promise<string> {
  return `/${slug}/${CHEMINS[type]}/${id}`
}

/** Enregistre un brouillon (création au premier appel). Appelé par l'enregistrement automatique de l'éditeur. */
export async function enregistrerDocument(slug: string, doc: DocumentEdition, id: string | null): Promise<ResultatEnregistrement> {
  const { organisation, role } = await chargerContexte(slug)
  if (!peutFacturer(role)) return { ok: false, erreur: 'Votre rôle ne permet pas de modifier les documents.' }
  const invalide = validerEdition(doc)
  if (invalide) return { ok: false, erreur: invalide }

  const calcul = calculer(doc)
  const totaux = calcul.ok ? calcul.totaux : null
  const document = {
    type: doc.type,
    client_id: doc.clientId,
    issue_date: doc.issueDate,
    service_date: doc.serviceDate,
    service_period_start: doc.servicePeriodStart,
    service_period_end: doc.servicePeriodEnd,
    due_date: echeance(doc),
    valid_until: doc.type === 'devis' ? doc.validUntil : null,
    purchase_order: doc.purchaseOrder.trim() || null,
    subject: doc.subject.trim() || null,
    public_notes: doc.publicNotes.trim() || null,
    internal_notes: doc.internalNotes.trim() || null,
    currency: doc.currency,
    language: doc.language,
    payment_terms: doc.paymentTerms,
    early_payment_discount: doc.earlyPaymentDiscount.trim() || null,
    discount_kind: doc.remise?.type ?? null,
    discount_value: doc.remise?.valeur ?? null,
    total_lines_ht: totaux?.totalLignesHt ?? 0,
    discount_total: totaux?.remiseGlobale ?? 0,
    deposits_ht: totaux?.acomptesHt ?? 0,
    total_ht: totaux?.totalHt ?? 0,
    total_vat: totaux?.totalTva ?? 0,
    total_ttc: totaux?.totalTtc ?? 0,
    amount_due: totaux?.netAPayer ?? 0,
    operation_category: totaux?.categorieOperation ?? null,
    origin_document_id: doc.originDocumentId,
    deducted_deposits: doc.acomptes,
  }
  const tva = (totaux?.ventilation ?? []).map((v, i) => ({
    position: i + 1,
    vat_category: v.categorie,
    vat_rate: v.taux,
    base_cents: v.baseHt,
    vat_cents: v.tva,
    exemption_reason: v.motifExoneration ?? null,
  }))

  const supabase = await creerClientServeur()
  const { data, error } = await supabase.rpc('enregistrer_brouillon', {
    p_organization: organisation.id,
    p_id: id,
    p_document: document,
    p_lignes: versLignesDb(doc.lignes, totaux),
    p_tva: tva,
  })
  if (error || !data) {
    if (error?.message.includes('déjà émis')) return { ok: false, erreur: 'Ce document est émis : il ne peut plus être modifié.' }
    return { ok: false, erreur: 'Enregistrement impossible. Vos modifications restent à l’écran ; réessayez dans un instant.' }
  }
  revalidatePath(`/${slug}/${CHEMINS[doc.type]}`)
  return { ok: true, id: data, le: new Date().toISOString() }
}

export async function supprimerBrouillon(slug: string, id: string, type: TypeDocument): Promise<void> {
  const { organisation } = await chargerContexte(slug)
  const supabase = await creerClientServeur()
  await supabase.from('documents').delete().eq('id', id).eq('organization_id', organisation.id).eq('status', 'brouillon')
  revalidatePath(`/${slug}/${CHEMINS[type]}`)
  redirect(`/${slug}/${CHEMINS[type]}`)
}

/** Lignes de la dernière facture du client (« comme la dernière fois »). */
export async function lignesDerniereFacture(slug: string, clientId: string): Promise<{ lignes: LigneEdition[]; numero: string | null } | null> {
  const { organisation } = await chargerContexte(slug)
  const supabase = await creerClientServeur()
  const { data: derniere } = await supabase
    .from('documents')
    .select('id, number')
    .eq('organization_id', organisation.id)
    .eq('client_id', clientId)
    .in('type', ['facture'])
    .order('issue_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!derniere) return null
  const { data: lignes } = await supabase
    .from('document_lines')
    .select('*')
    .eq('document_id', derniere.id)
    .eq('organization_id', organisation.id)
    .order('position')
  return { lignes: (lignes ?? []).map((l) => depuisLigneDb({ ...l, id: undefined })), numero: derniere.number }
}

/** Duplique un document (brouillon ou émis) en nouveau brouillon daté du jour. */
export async function dupliquerDocument(slug: string, id: string, versType?: TypeDocument): Promise<void> {
  const { organisation, role } = await chargerContexte(slug)
  if (!peutFacturer(role)) return
  const supabase = await creerClientServeur()
  const [{ data: source }, { data: lignes }] = await Promise.all([
    supabase.from('documents').select('*').eq('id', id).eq('organization_id', organisation.id).single(),
    supabase.from('document_lines').select('*').eq('document_id', id).eq('organization_id', organisation.id).order('position'),
  ])
  if (!source) return
  const type = versType ?? (source.type === 'acompte' || source.type === 'avoir' ? 'facture' : source.type)
  const aujourdhui = new Date().toISOString().slice(0, 10)
  const doc: DocumentEdition = {
    id: '',
    type,
    clientId: source.client_id,
    issueDate: aujourdhui,
    serviceDate: null,
    servicePeriodStart: null,
    servicePeriodEnd: null,
    validUntil: type === 'devis' ? new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10) : null,
    purchaseOrder: source.purchase_order ?? '',
    subject: source.subject ?? '',
    publicNotes: source.public_notes ?? '',
    internalNotes: '',
    currency: source.currency,
    language: source.language,
    paymentTerms: source.payment_terms ?? organisation.default_payment_terms,
    earlyPaymentDiscount: source.early_payment_discount ?? '',
    remise: source.discount_kind && source.discount_value != null ? { type: source.discount_kind, valeur: Number(source.discount_value) } : null,
    lignes: (lignes ?? []).map((l) => depuisLigneDb({ ...l, id: undefined })),
    acomptes: [],
    // Un devis transformé en facture garde le lien vers son devis.
    originDocumentId: source.type === 'devis' && type !== 'devis' ? source.id : null,
  }
  const r = await enregistrerDocument(slug, doc, null)
  if (r.ok) redirect(await cheminDocument(slug, type, r.id))
}
