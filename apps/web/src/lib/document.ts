/**
 * État d'édition d'un document (devis, facture, acompte, avoir) et passerelles
 * vers le moteur de calcul et vers la base. Pur : utilisable côté client et serveur.
 */

import { calculerDocument, ErreurMontant, type CategorieTva, type DeductionAcompte, type LigneEntree, type Remise, type Totaux } from '@pastille/moteur'
import { dateEcheance, type ConditionsPaiement } from './clients'
import type { NatureArticle } from './fiscalite'

export type TypeDocument = 'facture' | 'devis' | 'acompte' | 'avoir'

export interface LigneEdition {
  cle: string
  productId: string | null
  designation: string
  description: string
  /** Millièmes */
  quantite: number
  unite: string
  /** Centimes HT */
  prixUnitaireHt: number
  remise: Remise | null
  categorie: CategorieTva
  taux: number
  motif: string | null
  nature: NatureArticle
}

export interface DocumentEdition {
  id: string
  type: TypeDocument
  clientId: string | null
  issueDate: string
  serviceDate: string | null
  servicePeriodStart: string | null
  servicePeriodEnd: string | null
  validUntil: string | null
  purchaseOrder: string
  subject: string
  publicNotes: string
  internalNotes: string
  currency: string
  language: 'fr' | 'en'
  paymentTerms: ConditionsPaiement
  earlyPaymentDiscount: string
  remise: Remise | null
  lignes: LigneEdition[]
  acomptes: DeductionAcompte[]
  originDocumentId: string | null
}

export const LIBELLES_TYPE: Record<TypeDocument, { singulier: string; titre: string; nouveau: string }> = {
  facture: { singulier: 'facture', titre: 'Facture', nouveau: 'Nouvelle facture' },
  devis: { singulier: 'devis', titre: 'Devis', nouveau: 'Nouveau devis' },
  acompte: { singulier: 'facture d’acompte', titre: 'Facture d’acompte', nouveau: 'Nouvelle facture d’acompte' },
  avoir: { singulier: 'avoir', titre: 'Avoir', nouveau: 'Nouvel avoir' },
}

let compteur = 0
export function nouvelleCle(): string {
  compteur += 1
  return `l${Date.now().toString(36)}${compteur}`
}

export function ligneVide(defauts: Partial<LigneEdition> = {}): LigneEdition {
  return {
    cle: nouvelleCle(),
    productId: null,
    designation: '',
    description: '',
    quantite: 1000,
    unite: 'unité',
    prixUnitaireHt: 0,
    remise: null,
    categorie: 'S',
    taux: 2000,
    motif: null,
    nature: 'service',
    ...defauts,
  }
}

/** Une ligne sans désignation ni prix est ignorée (ligne de saisie en cours). */
export function ligneSignificative(l: LigneEdition): boolean {
  return l.designation.trim() !== '' || l.prixUnitaireHt !== 0
}

export function versLignesMoteur(lignes: readonly LigneEdition[]): LigneEntree[] {
  return lignes.filter(ligneSignificative).map((l) => ({
    id: l.cle,
    designation: l.designation,
    quantite: l.quantite,
    prixUnitaireHt: l.prixUnitaireHt,
    categorie: l.categorie,
    taux: l.categorie === 'S' ? l.taux : 0,
    nature: l.nature,
    remise: l.remise ?? undefined,
    motifExoneration: l.motif ?? undefined,
  }))
}

export type ResultatCalcul = { ok: true; totaux: Totaux } | { ok: false; erreur: string }

export function calculer(doc: Pick<DocumentEdition, 'lignes' | 'remise' | 'acomptes'>): ResultatCalcul {
  try {
    return {
      ok: true,
      totaux: calculerDocument({ lignes: versLignesMoteur(doc.lignes), remiseGlobale: doc.remise ?? undefined, acomptes: doc.acomptes }),
    }
  } catch (e) {
    if (e instanceof ErreurMontant) return { ok: false, erreur: e.message }
    throw e
  }
}

export function echeance(doc: Pick<DocumentEdition, 'issueDate' | 'paymentTerms' | 'type'>): string | null {
  if (doc.type === 'devis') return null
  return dateEcheance(doc.issueDate, doc.paymentTerms)
}

/** Valeur ISO du jour (fuseau Europe/Paris). */
export function aujourdHui(maintenant = new Date()): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(maintenant)
}

export function ajouterJours(date: string, jours: number): string {
  const [a, m, j] = date.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(a, m - 1, j + jours)).toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Base de données
// ---------------------------------------------------------------------------

export interface LigneDb {
  position: number
  product_id: string | null
  designation: string
  description: string | null
  quantity_milli: number
  unit: string
  unit_price_cents: number
  discount_kind: 'pourcentage' | 'montant' | null
  discount_value: number | null
  vat_category: CategorieTva
  vat_rate: number
  exemption_reason: string | null
  nature: NatureArticle
  line_net_cents: number
}

export function depuisLigneDb(l: Omit<LigneDb, 'line_net_cents'> & { id?: string }): LigneEdition {
  return {
    cle: l.id ?? nouvelleCle(),
    productId: l.product_id,
    designation: l.designation,
    description: l.description ?? '',
    quantite: Number(l.quantity_milli),
    unite: l.unit,
    prixUnitaireHt: Number(l.unit_price_cents),
    remise: l.discount_kind && l.discount_value != null ? { type: l.discount_kind, valeur: Number(l.discount_value) } : null,
    categorie: l.vat_category,
    taux: l.vat_rate,
    motif: l.exemption_reason,
    nature: l.nature,
  }
}

export function versLignesDb(lignes: readonly LigneEdition[], totaux: Totaux | null): LigneDb[] {
  const nets = new Map(totaux?.lignes.map((l) => [l.id, l.montantNet]))
  return lignes.filter(ligneSignificative).map((l, i) => ({
    position: i + 1,
    product_id: l.productId,
    designation: l.designation.trim().slice(0, 300),
    description: l.description.trim().slice(0, 2000) || null,
    quantity_milli: l.quantite,
    unit: l.unite.slice(0, 30) || 'unité',
    unit_price_cents: l.prixUnitaireHt,
    discount_kind: l.remise?.type ?? null,
    discount_value: l.remise?.valeur ?? null,
    vat_category: l.categorie,
    vat_rate: l.categorie === 'S' ? l.taux : 0,
    exemption_reason: l.categorie === 'S' ? null : (l.motif?.slice(0, 300) ?? null),
    nature: l.nature,
    line_net_cents: nets.get(l.cle) ?? 0,
  }))
}

/** Lignes recopiées depuis un autre document (« comme la dernière fois », duplication, conversion). */
export function copierLignes(lignes: readonly LigneEdition[]): LigneEdition[] {
  return lignes.filter(ligneSignificative).map((l) => ({ ...l, cle: nouvelleCle() }))
}

/** Validation d'un état reçu du navigateur avant enregistrement. */
export function validerEdition(doc: DocumentEdition): string | null {
  const date = /^\d{4}-\d{2}-\d{2}$/
  if (!date.test(doc.issueDate)) return 'Date d’émission invalide.'
  for (const d of [doc.serviceDate, doc.servicePeriodStart, doc.servicePeriodEnd, doc.validUntil]) {
    if (d && !date.test(d)) return 'Une date est invalide.'
  }
  if (doc.servicePeriodStart && doc.servicePeriodEnd && doc.servicePeriodEnd < doc.servicePeriodStart) {
    return 'La période de prestation se termine avant de commencer.'
  }
  if (doc.lignes.length > 500) return '500 lignes maximum.'
  for (const l of doc.lignes) {
    if (![l.quantite, l.prixUnitaireHt, l.taux].every(Number.isSafeInteger)) return 'Une ligne contient une valeur invalide.'
    if (l.designation.length > 300) return 'Une désignation dépasse 300 caractères.'
  }
  if (!/^[A-Z]{3}$/.test(doc.currency)) return 'Devise invalide.'
  return null
}
