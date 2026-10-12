import 'server-only'
import { notFound } from 'next/navigation'
import { ajouterJours, aujourdHui, calculer, echeance, editionDepuisDb, validerEdition, versLignesDb, type DocumentEdition, type TypeDocument } from './document'
import { appliquerClient, contexteEditeur, ligneLibre, type ClientEditeur, type DonneesEditeur } from './editeur'
import { construireImprimable, type ClientImprime, type DocumentImprimable, type VendeurImprime } from './imprimable'
import { chargerContexte } from './session'
import { urlPublique } from './supabase/stockage'
import { creerClientServeur } from './supabase/serveur'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, DocumentRow, OrganizationRow } from './supabase/types'

const COLONNES_CLIENT =
  'id, kind, name, legal_form, siren, vat_number, billing_line1, billing_line2, billing_postal_code, billing_city, billing_country, shipping_different, service_code, default_vat_category, default_vat_rate, exemption_reason, default_discount_kind, default_discount_value, payment_terms, early_payment_discount, currency, language, purchase_order_required, custom_mentions'

/** Référentiels nécessaires à l'éditeur : clients actifs, catalogue, prix par client, mentions. */
export async function chargerReferentiels(slug: string): Promise<DonneesEditeur> {
  const { organisation } = await chargerContexte(slug)
  const supabase = await creerClientServeur()
  const [clients, produits, prix, mentions] = await Promise.all([
    supabase.from('clients').select(COLONNES_CLIENT).eq('organization_id', organisation.id).is('archived_at', null).order('name'),
    supabase
      .from('products')
      .select('id, name, description, unit, unit_price_cents, vat_category, vat_rate, nature, favorite')
      .eq('organization_id', organisation.id)
      .is('archived_at', null)
      .order('name'),
    supabase.from('client_prices').select('client_id, product_id, unit_price_cents').eq('organization_id', organisation.id),
    supabase.from('legal_mentions').select('key, text'),
  ])
  return {
    organisation,
    clients: (clients.data ?? []) as ClientEditeur[],
    produits: (produits.data ?? []).map((p) => ({ ...p, unit_price_cents: Number(p.unit_price_cents) })),
    prixClients: (prix.data ?? []).map((p) => [`${p.client_id}:${p.product_id}`, Number(p.unit_price_cents)]),
    textes: Object.fromEntries((mentions.data ?? []).map((m) => [m.key, m.text])),
  }
}

/** Nouveau brouillon, prérempli avec le client demandé et ses conditions. */
export function nouveauDocument(type: TypeDocument, d: DonneesEditeur, clientId?: string): DocumentEdition {
  const jour = aujourdHui()
  const client = d.clients.find((c) => c.id === clientId) ?? null
  const base: DocumentEdition = {
    id: '',
    type,
    clientId: null,
    issueDate: jour,
    serviceDate: null,
    servicePeriodStart: null,
    servicePeriodEnd: null,
    validUntil: type === 'devis' ? ajouterJours(jour, 30) : null,
    purchaseOrder: '',
    subject: '',
    publicNotes: '',
    internalNotes: '',
    currency: 'EUR',
    language: 'fr',
    paymentTerms: d.organisation.default_payment_terms,
    earlyPaymentDiscount: d.organisation.early_payment_discount,
    remise: null,
    lignes: [ligneLibre(client, d.organisation.vat_regime)],
    acomptes: [],
    originDocumentId: null,
  }
  return client ? appliquerClient(base, client, contexteEditeur(d)) : base
}

export interface DocumentCharge {
  ligne: DocumentRow
  edition: DocumentEdition
}

export type ClientSupabase = SupabaseClient<Database>

/** Lecture d'un document et de ses lignes avec un client donné (session ou service). */
export async function lireDocument(supabase: ClientSupabase, organisation: Pick<OrganizationRow, 'id' | 'default_payment_terms'>, id: string): Promise<DocumentCharge | null> {
  const [{ data: doc }, { data: lignes }] = await Promise.all([
    supabase.from('documents').select('*').eq('id', id).eq('organization_id', organisation.id).maybeSingle(),
    supabase.from('document_lines').select('*').eq('document_id', id).eq('organization_id', organisation.id).order('position'),
  ])
  if (!doc) return null
  return { ligne: doc, edition: editionDepuisDb(doc, lignes ?? [], organisation.default_payment_terms) }
}

/** Charge un document de l'organisation et le convertit en état d'édition. */
export async function chargerDocument(slug: string, id: string, types: TypeDocument[]): Promise<DocumentCharge> {
  const { organisation } = await chargerContexte(slug)
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const charge = await lireDocument(await creerClientServeur(), organisation, id)
  if (!charge || !types.includes(charge.ligne.type)) notFound()
  return charge
}

/** Document prêt à imprimer : instantanés figés s'il est émis, données courantes sinon. */
export async function imprimableDepuis(supabase: ClientSupabase, organisation: OrganizationRow, charge: DocumentCharge): Promise<DocumentImprimable | null> {
  const { ligne: d, edition } = charge
  const [mentions, origine, client] = await Promise.all([
    supabase.from('legal_mentions').select('key, text'),
    d.origin_document_id
      ? supabase.from('documents').select('number, issue_date').eq('id', d.origin_document_id).maybeSingle()
      : Promise.resolve({ data: null }),
    d.client_snapshot || !d.client_id ? Promise.resolve({ data: null }) : supabase.from('clients').select('*').eq('id', d.client_id).maybeSingle(),
  ])
  return construireImprimable({
    edition,
    numero: d.number,
    brouillon: d.status === 'brouillon',
    dateEcheance: d.due_date,
    vendeur: (d.seller_snapshot ?? organisation) as VendeurImprime,
    client: (d.client_snapshot ?? client.data ?? null) as ClientImprime | null,
    textes: Object.fromEntries((mentions.data ?? []).map((m) => [m.key, m.text])),
    origine: origine.data?.number ? { numero: origine.data.number, date: origine.data.issue_date } : null,
    empreinte: d.content_hash,
    paye: d.status === 'paye',
  })
}

export async function chargerImprimable(slug: string, id: string): Promise<{ charge: DocumentCharge; imprimable: DocumentImprimable } | null> {
  const charge = await chargerDocument(slug, id, ['facture', 'acompte', 'devis', 'avoir'])
  const { organisation } = await chargerContexte(slug)
  const imprimable = await imprimableDepuis(await creerClientServeur(), organisation, charge)
  return imprimable ? { charge, imprimable } : null
}

export type ResultatEnregistrement = { ok: true; id: string; le: string } | { ok: false; erreur: string }

/** Enregistre un brouillon (création si id est null) : document, lignes et TVA en une transaction. */
export async function sauverBrouillon(supabase: ClientSupabase, organisationId: string, doc: DocumentEdition, id: string | null): Promise<ResultatEnregistrement> {
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
  const { data, error } = await supabase.rpc('enregistrer_brouillon', {
    p_organization: organisationId,
    p_id: id,
    p_document: document,
    p_lignes: versLignesDb(doc.lignes, totaux),
    p_tva: tva,
  })
  if (error || !data) {
    if (error?.message.includes('déjà émis')) return { ok: false, erreur: 'Ce document est émis : il ne peut plus être modifié.' }
    return { ok: false, erreur: 'Enregistrement impossible. Vos modifications restent à l’écran ; réessayez dans un instant.' }
  }
  return { ok: true, id: data, le: new Date().toISOString() }
}

/** Logo de l'entreprise (PNG ou JPEG) pour le PDF ; null s'il est absent ou illisible. */
export async function chargerLogo(chemin: string | null): Promise<{ octets: Uint8Array; type: string } | null> {
  if (!chemin || !/\.(png|jpe?g)$/i.test(chemin)) return null
  try {
    const r = await fetch(urlPublique('logos', chemin), { cache: 'force-cache' })
    if (!r.ok) return null
    return { octets: new Uint8Array(await r.arrayBuffer()), type: r.headers.get('content-type') ?? (chemin.endsWith('.png') ? 'image/png' : 'image/jpeg') }
  } catch {
    return null
  }
}

/** Nom de fichier sûr : « Facture F-2026-0042.pdf ». */
export function nomFichier(d: Pick<DocumentImprimable, 'titre' | 'numero'>, extension: string): string {
  return `${d.titre} ${d.numero ?? 'brouillon'}`.replace(/[’']/g, ' ').replace(/[^\p{L}\p{N} ._-]/gu, '-') + `.${extension}`
}
