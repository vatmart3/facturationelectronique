import 'server-only'
import { notFound } from 'next/navigation'
import type { DeductionAcompte } from '@pastille/moteur'
import { ajouterJours, aujourdHui, depuisLigneDb, type DocumentEdition, type TypeDocument } from './document'
import { appliquerClient, contexteEditeur, ligneLibre, type ClientEditeur, type DonneesEditeur } from './editeur'
import { chargerContexte } from './session'
import { creerClientServeur } from './supabase/serveur'
import type { DocumentRow } from './supabase/types'

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

/** Charge un document de l'organisation et le convertit en état d'édition. */
export async function chargerDocument(slug: string, id: string, types: TypeDocument[]): Promise<DocumentCharge> {
  const { organisation } = await chargerContexte(slug)
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const supabase = await creerClientServeur()
  const [{ data: doc }, { data: lignes }] = await Promise.all([
    supabase.from('documents').select('*').eq('id', id).eq('organization_id', organisation.id).maybeSingle(),
    supabase.from('document_lines').select('*').eq('document_id', id).eq('organization_id', organisation.id).order('position'),
  ])
  if (!doc || !types.includes(doc.type)) notFound()
  return {
    ligne: doc,
    edition: {
      id: doc.id,
      type: doc.type,
      clientId: doc.client_id,
      issueDate: doc.issue_date,
      serviceDate: doc.service_date,
      servicePeriodStart: doc.service_period_start,
      servicePeriodEnd: doc.service_period_end,
      validUntil: doc.valid_until,
      purchaseOrder: doc.purchase_order ?? '',
      subject: doc.subject ?? '',
      publicNotes: doc.public_notes ?? '',
      internalNotes: doc.internal_notes ?? '',
      currency: doc.currency,
      language: doc.language,
      paymentTerms: doc.payment_terms ?? organisation.default_payment_terms,
      earlyPaymentDiscount: doc.early_payment_discount ?? '',
      remise: doc.discount_kind && doc.discount_value != null ? { type: doc.discount_kind, valeur: Number(doc.discount_value) } : null,
      lignes: (lignes ?? []).map(depuisLigneDb),
      acomptes: Array.isArray(doc.deducted_deposits) ? (doc.deducted_deposits as DeductionAcompte[]) : [],
      originDocumentId: doc.origin_document_id,
    },
  }
}
