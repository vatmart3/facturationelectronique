/** Fiche client : libellés, validation et conditions de paiement. */

import type { CategorieTva } from '@pastille/moteur'
import type { TypeClient } from './fiscalite'
import { nettoyerChiffres, sirenValide, siretValide, tvaIntracomDepuisSiren, tvaIntracomFrValide } from './identifiants'
import { eurosEnCentimes } from './montant'

export const TYPES_CLIENT: Array<{ valeur: TypeClient; libelle: string; aide: string }> = [
  { valeur: 'b2b', libelle: 'Entreprise France', aide: 'SIREN obligatoire · facture électronique via la plateforme agréée.' },
  { valeur: 'b2c', libelle: 'Particulier', aide: 'TVA française · e-reporting des transactions.' },
  { valeur: 'b2g', libelle: 'Administration', aide: 'Dépôt sur Chorus Pro, avec numéro d’engagement et code service.' },
  { valeur: 'ue', libelle: 'Entreprise UE', aide: 'Autoliquidation ou livraison intracommunautaire · n° de TVA du client.' },
  { valeur: 'hors_ue', libelle: 'Hors UE', aide: 'Exportation ou services hors champ de la TVA française.' },
]

export function libelleTypeClient(kind: TypeClient): string {
  return TYPES_CLIENT.find((t) => t.valeur === kind)!.libelle
}

export type ConditionsPaiement = 'reception' | '15j' | '30j' | '30jfm' | '45jfm' | '60j'

export const CONDITIONS_PAIEMENT: Array<{ valeur: ConditionsPaiement; libelle: string }> = [
  { valeur: 'reception', libelle: 'À réception' },
  { valeur: '15j', libelle: '15 jours' },
  { valeur: '30j', libelle: '30 jours' },
  { valeur: '30jfm', libelle: '30 jours fin de mois' },
  { valeur: '45jfm', libelle: '45 jours fin de mois' },
  { valeur: '60j', libelle: '60 jours' },
]

export function libelleConditions(c: ConditionsPaiement): string {
  return CONDITIONS_PAIEMENT.find((x) => x.valeur === c)!.libelle
}

/** Date d'échéance (ISO AAAA-MM-JJ) à partir de la date d'émission. */
export function dateEcheance(emission: string, conditions: ConditionsPaiement): string {
  const [a, m, j] = emission.split('-').map(Number) as [number, number, number]
  const jours = { reception: 0, '15j': 15, '30j': 30, '30jfm': 30, '45jfm': 45, '60j': 60 }[conditions]
  const date = new Date(Date.UTC(a, m - 1, j + jours))
  if (conditions.endsWith('fm')) {
    // Fin du mois atteint après le délai.
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)
  }
  return date.toISOString().slice(0, 10)
}

export interface DonneesClient {
  kind: TypeClient
  name: string
  legal_form: string | null
  siren: string | null
  siret: string | null
  vat_number: string | null
  einvoice_address: string | null
  service_code: string | null
  billing_line1: string | null
  billing_line2: string | null
  billing_postal_code: string | null
  billing_city: string | null
  billing_country: string
  shipping_different: boolean
  shipping_line1: string | null
  shipping_line2: string | null
  shipping_postal_code: string | null
  shipping_city: string | null
  shipping_country: string | null
  default_vat_category: CategorieTva | null
  default_vat_rate: number | null
  exemption_reason: string | null
  default_discount_kind: 'pourcentage' | 'montant' | null
  default_discount_value: number | null
  payment_terms: ConditionsPaiement | null
  early_payment_discount: string | null
  currency: string
  language: 'fr' | 'en'
  purchase_order_required: boolean
  custom_mentions: string | null
  reminders_enabled: boolean
  notes: string | null
}

export type ErreursClient = Partial<Record<keyof DonneesClient, string>>

type Lecteur = (cle: string) => string

const CATEGORIES_TVA = ['S', 'Z', 'E', 'AE', 'K', 'G', 'O'] as const

/** Convertit « 5,5 » (pourcentage saisi) en points de base. */
export function pourcentageEnPoints(saisie: string): number | null {
  const m = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(saisie.replace(/[\s%]/g, ''))
  if (!m) return null
  const points = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'))
  return points <= 10_000 ? points : null
}

export function validerClient(lire: Lecteur): { donnees: DonneesClient; erreurs: ErreursClient } {
  const erreurs: ErreursClient = {}
  const vide = (v: string) => (v ? v : null)
  const kind = lire('kind') as TypeClient
  if (!TYPES_CLIENT.some((t) => t.valeur === kind)) erreurs.kind = 'Choisissez une catégorie de client.'

  const name = lire('name')
  if (!name) erreurs.name = 'Le nom du client est obligatoire.'
  else if (name.length > 200) erreurs.name = '200 caractères maximum.'

  let siren: string | null = nettoyerChiffres(lire('siren')) || null
  if (siren && !sirenValide(siren)) erreurs.siren = 'SIREN invalide : 9 chiffres avec une clé de contrôle correcte.'
  if (!siren && kind === 'b2b') erreurs.siren = 'Le SIREN est obligatoire pour une entreprise française.'
  if (kind === 'ue' || kind === 'hors_ue') siren = null

  const siret = nettoyerChiffres(lire('siret')) || null
  if (siret && !siretValide(siret)) erreurs.siret = 'SIRET invalide.'
  else if (siret && siren && !siret.startsWith(siren)) erreurs.siret = 'Le SIRET doit commencer par le SIREN.'

  let vat = lire('vat_number').replace(/\s+/g, '').toUpperCase() || null
  if (!vat && siren && sirenValide(siren) && kind === 'b2b') vat = tvaIntracomDepuisSiren(siren)
  if (vat) {
    if (vat.startsWith('FR') && !tvaIntracomFrValide(vat)) erreurs.vat_number = 'Numéro de TVA français invalide.'
    else if (!/^[A-Z]{2}[0-9A-Z]{2,13}$/.test(vat)) erreurs.vat_number = 'Numéro de TVA invalide.'
  }
  if (kind === 'ue' && !vat) erreurs.vat_number = 'Le numéro de TVA intracommunautaire est obligatoire pour un client UE.'

  const pays = (lire('billing_country') || 'FR').toUpperCase()
  if (!/^[A-Z]{2}$/.test(pays)) erreurs.billing_country = 'Code pays sur 2 lettres.'

  const shippingDifferent = lire('shipping_different') === 'on'
  const paysLivraison = shippingDifferent ? (lire('shipping_country') || pays).toUpperCase() : null
  if (paysLivraison && !/^[A-Z]{2}$/.test(paysLivraison)) erreurs.shipping_country = 'Code pays sur 2 lettres.'

  const categorie = lire('default_vat_category')
  let defaultVatCategory: CategorieTva | null = null
  if (categorie) {
    if ((CATEGORIES_TVA as readonly string[]).includes(categorie)) defaultVatCategory = categorie as CategorieTva
    else erreurs.default_vat_category = 'Catégorie inconnue.'
  }
  let defaultVatRate: number | null = null
  const tauxSaisi = lire('default_vat_rate')
  if (tauxSaisi) {
    defaultVatRate = pourcentageEnPoints(tauxSaisi)
    if (defaultVatRate === null) erreurs.default_vat_rate = 'Taux invalide, par exemple 20 ou 5,5.'
  }

  let remiseKind: 'pourcentage' | 'montant' | null = null
  let remiseValeur: number | null = null
  const remise = lire('default_discount_value')
  if (remise) {
    remiseKind = lire('default_discount_kind') === 'montant' ? 'montant' : 'pourcentage'
    remiseValeur = remiseKind === 'pourcentage' ? pourcentageEnPoints(remise) : eurosEnCentimes(remise)
    if (remiseValeur === null || remiseValeur < 0) erreurs.default_discount_value = 'Remise invalide.'
  }

  const conditions = lire('payment_terms')
  const paymentTerms = CONDITIONS_PAIEMENT.some((c) => c.valeur === conditions) ? (conditions as ConditionsPaiement) : null

  const devise = (lire('currency') || 'EUR').toUpperCase()
  if (!/^[A-Z]{3}$/.test(devise)) erreurs.currency = 'Code devise sur 3 lettres, par exemple EUR.'

  return {
    erreurs,
    donnees: {
      kind,
      name,
      legal_form: vide(lire('legal_form')),
      siren,
      siret,
      vat_number: vat,
      einvoice_address: vide(lire('einvoice_address')),
      service_code: vide(lire('service_code')),
      billing_line1: vide(lire('billing_line1')),
      billing_line2: vide(lire('billing_line2')),
      billing_postal_code: vide(lire('billing_postal_code')),
      billing_city: vide(lire('billing_city')),
      billing_country: pays,
      shipping_different: shippingDifferent,
      shipping_line1: shippingDifferent ? vide(lire('shipping_line1')) : null,
      shipping_line2: shippingDifferent ? vide(lire('shipping_line2')) : null,
      shipping_postal_code: shippingDifferent ? vide(lire('shipping_postal_code')) : null,
      shipping_city: shippingDifferent ? vide(lire('shipping_city')) : null,
      shipping_country: paysLivraison,
      default_vat_category: defaultVatCategory,
      default_vat_rate: defaultVatRate,
      exemption_reason: vide(lire('exemption_reason')),
      default_discount_kind: remiseKind,
      default_discount_value: remiseValeur,
      payment_terms: paymentTerms,
      early_payment_discount: vide(lire('early_payment_discount')),
      currency: devise,
      language: lire('language') === 'en' ? 'en' : 'fr',
      purchase_order_required: lire('purchase_order_required') === 'on',
      custom_mentions: vide(lire('custom_mentions')),
      reminders_enabled: lire('reminders_enabled') !== 'off',
      notes: vide(lire('notes')),
    },
  }
}
