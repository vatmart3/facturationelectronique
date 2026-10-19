/** Validation de l'identité légale saisie dans les réglages de l'entreprise. */

import { normaliserIban } from './format'
import { bicValide, ibanValide, nettoyerChiffres, sirenValide, siretValide, tvaIntracomFrValide } from './identifiants'
import { eurosEnCentimes } from './montant'
import type { OrganizationUpdate, VatRegime } from './supabase/types'

export const REGIMES_TVA: Array<{ valeur: VatRegime; libelle: string; aide: string }> = [
  { valeur: 'franchise', libelle: 'Franchise en base', aide: 'Micro-entreprise : TVA non applicable, art. 293 B du CGI.' },
  { valeur: 'reel_simplifie', libelle: 'Réel simplifié', aide: 'Déclaration annuelle avec acomptes semestriels.' },
  { valeur: 'reel_normal', libelle: 'Réel normal', aide: 'Déclaration mensuelle ou trimestrielle.' },
  { valeur: 'non_assujetti', libelle: 'Non assujetti', aide: 'Activité hors du champ de la TVA.' },
]

export const FORMES_JURIDIQUES = ['EI', 'Micro-entreprise', 'EURL', 'SARL', 'SASU', 'SAS', 'SA', 'SCI', 'SNC', 'SELARL', 'Association', 'Autre']

export type ErreursIdentite = Partial<Record<keyof OrganizationUpdate, string>>

export interface ResultatIdentite {
  donnees: OrganizationUpdate
  erreurs: ErreursIdentite
}

type Lecteur = (cle: string) => string

/** Valide et normalise les champs. Un champ vide devient null (sauf le nom, obligatoire). */
export function validerIdentite(lire: Lecteur): ResultatIdentite {
  const erreurs: ErreursIdentite = {}
  const donnees: OrganizationUpdate = {}
  const vide = (v: string) => (v.length === 0 ? null : v)

  const nom = lire('name')
  if (!nom) erreurs.name = 'Le nom de l’entreprise est obligatoire.'
  else if (nom.length > 200) erreurs.name = '200 caractères maximum.'
  else donnees.name = nom

  donnees.legal_form = vide(lire('legal_form').slice(0, 80))

  const capital = lire('share_capital')
  if (!capital) donnees.share_capital_cents = null
  else {
    const centimes = eurosEnCentimes(capital)
    if (centimes === null || centimes < 0) erreurs.share_capital_cents = 'Montant invalide, par exemple 10 000 ou 1 500,50.'
    else donnees.share_capital_cents = centimes
  }

  const siren = nettoyerChiffres(lire('siren'))
  if (!siren) donnees.siren = null
  else if (!sirenValide(siren)) erreurs.siren = 'SIREN invalide : 9 chiffres avec une clé de contrôle correcte.'
  else donnees.siren = siren

  const siret = nettoyerChiffres(lire('siret'))
  if (!siret) donnees.siret = null
  else if (!siretValide(siret)) erreurs.siret = 'SIRET invalide : 14 chiffres avec une clé de contrôle correcte.'
  else if (donnees.siren && !siret.startsWith(donnees.siren)) erreurs.siret = 'Le SIRET doit commencer par le SIREN.'
  else donnees.siret = siret

  const tva = lire('vat_number').replace(/\s+/g, '').toUpperCase()
  if (!tva) donnees.vat_number = null
  else if (tva.startsWith('FR') ? !tvaIntracomFrValide(tva) : !/^[A-Z]{2}[0-9A-Z]{2,13}$/.test(tva))
    erreurs.vat_number = 'Numéro de TVA invalide.'
  else if (donnees.siren && tva.startsWith('FR') && tva.slice(4) !== donnees.siren)
    erreurs.vat_number = 'Le numéro de TVA ne correspond pas au SIREN.'
  else donnees.vat_number = tva

  const naf = lire('naf_code').replace(/\s+/g, '').toUpperCase()
  if (!naf) donnees.naf_code = null
  else if (!/^\d{2}\.?\d{2}[A-Z]$/.test(naf)) erreurs.naf_code = 'Code NAF invalide, par exemple 74.10Z.'
  else donnees.naf_code = naf.includes('.') ? naf : `${naf.slice(0, 2)}.${naf.slice(2)}`

  donnees.registration = vide(lire('registration').slice(0, 120))
  donnees.address_line1 = vide(lire('address_line1').slice(0, 200))
  donnees.address_line2 = vide(lire('address_line2').slice(0, 200))

  const cp = lire('postal_code')
  if (cp && !/^[0-9A-Za-z \-]{3,10}$/.test(cp)) erreurs.postal_code = 'Code postal invalide.'
  else donnees.postal_code = vide(cp)
  donnees.city = vide(lire('city').slice(0, 120))

  const pays = (lire('country_code') || 'FR').toUpperCase()
  if (!/^[A-Z]{2}$/.test(pays)) erreurs.country_code = 'Code pays sur 2 lettres, par exemple FR.'
  else donnees.country_code = pays

  const regime = lire('vat_regime')
  if (!regime) donnees.vat_regime = null
  else if (!REGIMES_TVA.some((r) => r.valeur === regime)) erreurs.vat_regime = 'Régime inconnu.'
  else donnees.vat_regime = regime as VatRegime
  donnees.vat_on_debits = lire('vat_on_debits') === 'on'

  const iban = normaliserIban(lire('iban'))
  if (!iban) donnees.iban = null
  else if (!ibanValide(iban)) erreurs.iban = 'IBAN invalide : vérifiez la saisie.'
  else donnees.iban = iban

  const bic = lire('bic').replace(/\s+/g, '').toUpperCase()
  if (!bic) donnees.bic = null
  else if (!bicValide(bic)) erreurs.bic = 'BIC invalide : 8 ou 11 caractères.'
  else donnees.bic = bic

  return { donnees, erreurs }
}

export const MODELES_FACTURE = [
  { valeur: 'papeterie', libelle: 'Papeterie', aide: 'Éditorial, typographie forte, filets fins.' },
  { valeur: 'galet', libelle: 'Galet', aide: 'Grand total en couleur d’accent dans l’en-tête.' },
  { valeur: 'classique', libelle: 'Classique', aide: 'Noir et blanc, sobre, pour les clients conservateurs.' },
] as const

export interface DonneesFacturation {
  default_payment_terms: ConditionsPaiementOrg
  late_penalty_terms: string
  early_payment_discount: string
  invoice_number_format: string
  quote_number_format: string
  credit_number_format: string
  accent_color: string
  invoice_template: 'galet' | 'papeterie' | 'classique'
  invoice_font: 'grotesque' | 'serif'
  footer_text: string | null
  terms_text: string | null
  payment_link: string | null
}

type ConditionsPaiementOrg = 'reception' | '15j' | '30j' | '30jfm' | '45jfm' | '60j'

export function validerFacturation(lire: Lecteur): { donnees: DonneesFacturation; erreurs: Partial<Record<keyof DonneesFacturation, string>> } {
  const erreurs: Partial<Record<keyof DonneesFacturation, string>> = {}
  const formats = ['invoice_number_format', 'quote_number_format', 'credit_number_format'] as const
  const valeurs = Object.fromEntries(formats.map((f) => [f, lire(f)])) as Record<(typeof formats)[number], string>
  for (const f of formats) {
    if (!/\{N+\}/.test(valeurs[f]) || valeurs[f].length > 40 || /[^A-Za-z0-9{}\-_/.]/.test(valeurs[f])) {
      erreurs[f] = 'Le format doit contenir {NNN} (numéro) et seulement lettres, chiffres, - _ / .'
    }
  }
  const conditions = lire('default_payment_terms') as ConditionsPaiementOrg
  if (!['reception', '15j', '30j', '30jfm', '45jfm', '60j'].includes(conditions)) erreurs.default_payment_terms = 'Conditions inconnues.'
  const couleur = lire('accent_color')
  if (!/^#[0-9A-Fa-f]{6}$/.test(couleur)) erreurs.accent_color = 'Couleur au format #RRVVBB.'
  const modele = lire('invoice_template')
  if (!MODELES_FACTURE.some((m) => m.valeur === modele)) erreurs.invoice_template = 'Modèle inconnu.'
  const penalites = lire('late_penalty_terms')
  if (!penalites) erreurs.late_penalty_terms = 'Le taux des pénalités de retard est une mention obligatoire.'
  const lienPaiement = lire('payment_link')
  if (lienPaiement && !lienPaiementValide(lienPaiement)) erreurs.payment_link = 'Adresse invalide : elle doit commencer par https:// (lien fourni par Stripe, SumUp, PayPal…).'
  return {
    erreurs,
    donnees: {
      default_payment_terms: conditions,
      late_penalty_terms: penalites.slice(0, 400),
      early_payment_discount: (lire('early_payment_discount') || 'Pas d’escompte pour paiement anticipé').slice(0, 300),
      invoice_number_format: valeurs.invoice_number_format,
      quote_number_format: valeurs.quote_number_format,
      credit_number_format: valeurs.credit_number_format,
      accent_color: couleur.toUpperCase(),
      invoice_template: modele as DonneesFacturation['invoice_template'],
      invoice_font: lire('invoice_font') === 'serif' ? 'serif' : 'grotesque',
      footer_text: lire('footer_text').slice(0, 600) || null,
      terms_text: lire('terms_text').slice(0, 20000) || null,
      payment_link: lienPaiement || null,
    },
  }
}

/** Lien de paiement en ligne : adresse https complète, sans espace, 500 caractères au plus. */
export function lienPaiementValide(lien: string): boolean {
  if (lien.length > 500 || /\s/.test(lien)) return false
  try {
    const u = new URL(lien)
    return u.protocol === 'https:' && u.hostname.includes('.')
  } catch {
    return false
  }
}
