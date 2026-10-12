'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { verifierConformite } from '@/lib/conformite'
import { aujourdHui, calculer, depuisLigneDb, echeance, validerEdition, versLignesDb, type DocumentEdition, type LigneEdition, type TypeDocument } from '@/lib/document'
import { acompteDepuis, avoirDepuis, copieDe, deductions, factureDepuis } from '@/lib/derives'
import { chargerDocument, chargerReferentiels } from '@/lib/documents-serveur'
import { peutFacturer } from '@/lib/roles'
import { chargerContexte } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import type { DocumentStatus } from '@/lib/supabase/types'

export type ResultatEnregistrement = { ok: true; id: string; le: string } | { ok: false; erreur: string }
export type ResultatAction = { ok: true } | { ok: false; erreur: string }

const CHEMINS: Record<TypeDocument, string> = {
  facture: 'ventes/factures',
  acompte: 'ventes/factures',
  devis: 'ventes/devis',
  avoir: 'ventes/avoirs',
}

function chemin(slug: string, type: TypeDocument, id?: string): string {
  return `/${slug}/${CHEMINS[type]}${id ? `/${id}` : ''}`
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
  // Pas de revalidatePath ici : l'éditeur ne doit pas être rechargé pendant la saisie ; les listes sont rendues à la demande.
  return { ok: true, id: data, le: new Date().toISOString() }
}

/**
 * Émission : le contrôle de conformité est refait côté serveur, puis la base attribue
 * le numéro, fige le contenu et chaîne l'empreinte (public.emettre_document).
 */
export async function emettreDocument(slug: string, id: string): Promise<ResultatAction> {
  const { role } = await chargerContexte(slug)
  if (!peutFacturer(role)) return { ok: false, erreur: 'Votre rôle ne permet pas d’émettre des documents.' }
  const [{ edition }, donnees] = await Promise.all([chargerDocument(slug, id, ['facture', 'acompte', 'devis', 'avoir']), chargerReferentiels(slug)])
  const calcul = calculer(edition)
  const client = donnees.clients.find((c) => c.id === edition.clientId) ?? null
  const conformite = verifierConformite(edition, donnees.organisation, client, calcul.ok ? calcul.totaux : null, donnees.textes)
  if (!conformite.peutEmettre) {
    const manquants = conformite.controles.filter((c) => !c.ok && c.bloquant).map((c) => c.libelle.toLowerCase())
    return { ok: false, erreur: `Émission impossible : ${manquants.join(', ')}.` }
  }
  const supabase = await creerClientServeur()
  const { error } = await supabase.rpc('emettre_document', { p_id: id })
  if (error) return { ok: false, erreur: error.message || 'Émission impossible.' }
  revalidatePath(`/${slug}`, 'layout')
  return { ok: true }
}

export async function changerStatut(slug: string, id: string, statut: DocumentStatus): Promise<ResultatAction> {
  const { role } = await chargerContexte(slug)
  if (!peutFacturer(role)) return { ok: false, erreur: 'Action non autorisée.' }
  const supabase = await creerClientServeur()
  const { data, error } = await supabase.rpc('changer_statut', { p_id: id, p_statut: statut })
  if (error || !data) return { ok: false, erreur: 'Changement de statut impossible.' }
  revalidatePath(chemin(slug, data.type, id))
  return { ok: true }
}

export async function supprimerBrouillon(slug: string, id: string, type: TypeDocument): Promise<void> {
  const { organisation } = await chargerContexte(slug)
  const supabase = await creerClientServeur()
  await supabase.from('documents').delete().eq('id', id).eq('organization_id', organisation.id).eq('status', 'brouillon')
  revalidatePath(chemin(slug, type))
  redirect(chemin(slug, type))
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
    .eq('type', 'facture')
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

async function creerEtOuvrir(slug: string, doc: DocumentEdition): Promise<ResultatAction> {
  const { role } = await chargerContexte(slug)
  if (!peutFacturer(role)) return { ok: false, erreur: 'Action non autorisée.' }
  const r = await enregistrerDocument(slug, doc, null)
  if (!r.ok) return r
  redirect(chemin(slug, doc.type, r.id))
}

/** Duplique un document (brouillon ou émis) en nouveau brouillon daté du jour. */
export async function dupliquerDocument(slug: string, id: string): Promise<ResultatAction> {
  const { edition } = await chargerDocument(slug, id, ['facture', 'acompte', 'devis', 'avoir'])
  return creerEtOuvrir(slug, copieDe(edition, aujourdHui()))
}

/** Facture issue d'un devis : lignes reprises, acomptes émis sur ce devis déduits. */
export async function facturerDevis(slug: string, id: string): Promise<ResultatAction> {
  const { organisation } = await chargerContexte(slug)
  const { ligne, edition } = await chargerDocument(slug, id, ['devis'])
  if (ligne.status === 'brouillon') return { ok: false, erreur: 'Envoyez d’abord le devis pour lui attribuer un numéro.' }
  const supabase = await creerClientServeur()
  const { data: acomptes } = await supabase
    .from('documents')
    .select('id, number')
    .eq('organization_id', organisation.id)
    .eq('origin_document_id', id)
    .eq('type', 'acompte')
    .in('status', ['emis', 'envoye', 'partiellement_paye', 'paye'])
    .order('sequence_number')
  const ids = (acomptes ?? []).map((a) => a.id)
  const { data: tva } = ids.length
    ? await supabase.from('document_vat_summary').select('document_id, vat_category, vat_rate, base_cents').in('document_id', ids)
    : { data: [] }
  const emis = (acomptes ?? []).map((a) => ({ number: a.number ?? '', vat: (tva ?? []).filter((t) => t.document_id === a.id) }))
  return creerEtOuvrir(slug, factureDepuis(edition, id, aujourdHui(), deductions(emis)))
}

export async function creerAvoir(slug: string, factureId: string): Promise<ResultatAction> {
  const { ligne, edition } = await chargerDocument(slug, factureId, ['facture', 'acompte'])
  if (ligne.status === 'brouillon') return { ok: false, erreur: 'Un brouillon se modifie ou se supprime : l’avoir ne concerne que les factures émises.' }
  if (ligne.status === 'annule') return { ok: false, erreur: 'Cette facture est déjà entièrement annulée par un avoir.' }
  return creerEtOuvrir(slug, avoirDepuis(edition, factureId, aujourdHui()))
}

export async function creerAcompte(slug: string, devisId: string, _etat: ResultatAction | null, formData: FormData): Promise<ResultatAction> {
  const { ligne, edition } = await chargerDocument(slug, devisId, ['devis'])
  if (ligne.status === 'brouillon' || !ligne.number) return { ok: false, erreur: 'Envoyez d’abord le devis pour lui attribuer un numéro.' }
  const saisie = String(formData.get('pourcentage') ?? '').replace(',', '.').replace(/[\s%]/g, '')
  const pourcentage = Math.round(Number(saisie) * 100)
  if (!saisie || !Number.isFinite(pourcentage) || pourcentage <= 0 || pourcentage > 10_000) return { ok: false, erreur: 'Pourcentage entre 1 et 100.' }
  const r = acompteDepuis(edition, devisId, ligne.number, { pourcentage }, aujourdHui())
  if (!r.ok) return r
  return creerEtOuvrir(slug, r.doc)
}
