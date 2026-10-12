/** Catalogue d'articles et de prestations. */

import type { CategorieTva } from '@pastille/moteur'
import { pourcentageEnPoints } from './clients'
import type { NatureArticle } from './fiscalite'
import { eurosEnCentimes } from './montant'

export const UNITES = ['unité', 'heure', 'jour', 'demi-journée', 'forfait', 'pièce', 'mois', 'an', 'm²', 'm³', 'ml', 'kg', 'litre', 'km', 'lot']

export const NATURES: Array<{ valeur: NatureArticle; libelle: string }> = [
  { valeur: 'service', libelle: 'Prestation de services' },
  { valeur: 'bien', libelle: 'Livraison de biens' },
  { valeur: 'debours', libelle: 'Débours (hors TVA)' },
]

export const TAUX_TVA: Array<{ valeur: string; libelle: string }> = [
  { valeur: 'S:2000', libelle: '20 %' },
  { valeur: 'S:1000', libelle: '10 %' },
  { valeur: 'S:550', libelle: '5,5 %' },
  { valeur: 'S:210', libelle: '2,1 %' },
  { valeur: 'S:850', libelle: '8,5 % (DOM)' },
  { valeur: 'Z:0', libelle: '0 %' },
  { valeur: 'E:0', libelle: 'Exonéré' },
]

export interface DonneesProduit {
  name: string
  description: string | null
  reference: string | null
  unit: string
  unit_price_cents: number
  vat_category: CategorieTva
  vat_rate: number
  nature: NatureArticle
  category: string | null
  accounting_account: string | null
  favorite: boolean
}

export type ErreursProduit = Partial<Record<keyof DonneesProduit | 'prix', string>>

type Lecteur = (cle: string) => string

export function validerProduit(lire: Lecteur): { donnees: DonneesProduit; erreurs: ErreursProduit } {
  const erreurs: ErreursProduit = {}
  const vide = (v: string) => (v ? v : null)

  const name = lire('name')
  if (!name) erreurs.name = 'La désignation est obligatoire.'
  else if (name.length > 200) erreurs.name = '200 caractères maximum.'

  const nature = (NATURES.some((n) => n.valeur === lire('nature')) ? lire('nature') : 'service') as NatureArticle

  // Taux : liste (« S:2000 ») ou saisie libre en pourcentage.
  let vatCategory: CategorieTva = 'S'
  let vatRate = 2000
  const choix = lire('vat')
  const m = /^(S|Z|E):(\d+)$/.exec(choix)
  if (m) {
    vatCategory = m[1] as CategorieTva
    vatRate = Number(m[2])
  } else if (choix) {
    const points = pourcentageEnPoints(choix)
    if (points === null || points === 0) erreurs.vat_rate = 'Taux invalide.'
    else vatRate = points
  }
  if (nature === 'debours') {
    vatCategory = 'O'
    vatRate = 0
  }

  // Prix saisi HT ou TTC.
  let prix = eurosEnCentimes(lire('price'))
  if (prix === null || prix < 0) {
    erreurs.prix = 'Prix invalide, par exemple 450 ou 99,90.'
    prix = 0
  } else if (lire('price_mode') === 'ttc' && vatCategory === 'S') {
    prix = Math.round((prix * 10_000) / (10_000 + vatRate))
  }

  const unit = lire('unit') || 'unité'
  if (unit.length > 30) erreurs.unit = '30 caractères maximum.'

  const compte = lire('accounting_account').toUpperCase()
  if (compte && !/^[0-9A-Z]{3,12}$/.test(compte)) erreurs.accounting_account = 'Compte comptable invalide, par exemple 706000.'

  return {
    erreurs,
    donnees: {
      name,
      description: vide(lire('description')),
      reference: vide(lire('reference')),
      unit,
      unit_price_cents: prix,
      vat_category: vatCategory,
      vat_rate: vatRate,
      nature,
      category: vide(lire('category')),
      accounting_account: compte || null,
      favorite: lire('favorite') === 'on',
    },
  }
}
