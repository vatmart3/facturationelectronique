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
