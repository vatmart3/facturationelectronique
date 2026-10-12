/**
 * Calcul des totaux d'un document (facture, devis, acompte, avoir).
 *
 * Ordre de calcul (identique à l'écran, dans le PDF et dans le XML) :
 *  1. Ligne : brut = arrondi(quantité × prix unitaire HT) ; remise de ligne ; net = brut − remise.
 *  2. Regroupement des lignes par catégorie et taux de TVA (ventilation).
 *  3. Remise globale : calculée sur les lignes soumises au régime de TVA (hors débours, catégorie O),
 *     puis répartie au prorata des bases, au centime près (plus fort reste).
 *  4. Acomptes déjà facturés : déduits de la base de leur taux.
 *  5. TVA de chaque groupe = arrondi(base × taux) — une fois par taux, jamais ligne par ligne
 *     (règle EN 16931 BR-S-09 / BR-CO-17).
 *  6. Totaux : HT = Σ bases, TVA = Σ TVA, TTC = HT + TVA.
 *
 * Unités : montants en centimes, quantités en millièmes (1 unité = 1000), taux en points de base.
 */

import { ErreurMontant, exigerEntier, multiplierDiviser, repartir } from './arrondi'
import { cleVentilation, tauxEffectif, type CategorieTva } from './tva'

export type Nature = 'bien' | 'service' | 'debours'

export type Remise =
  /** Pourcentage en points de base : 10 % = 1000. */
  | { type: 'pourcentage'; valeur: number }
  /** Montant HT en centimes, du même signe que le montant remisé. */
  | { type: 'montant'; valeur: number }

export interface LigneEntree {
  id: string
  designation: string
  /** Millièmes : 1 = 1000, 1,5 h = 1500. Négative pour un avoir. */
  quantite: number
  /** Centimes HT. */
  prixUnitaireHt: number
  categorie: CategorieTva
  /** Points de base, ignoré (forcé à 0) hors catégorie S. */
  taux: number
  nature: Nature
  remise?: Remise
  /** Motif d'exonération ou mention d'autoliquidation (BT-120). */
  motifExoneration?: string
}

export interface VentilationAcompte {
  categorie: CategorieTva
  taux: number
  /** Base HT de l'acompte pour ce taux, en centimes (positive). */
  baseHt: number
}

export interface DeductionAcompte {
  /** Numéro de la facture d'acompte déduite. */
  numero: string
  ventilation: VentilationAcompte[]
}

export interface DocumentEntree {
  lignes: readonly LigneEntree[]
  remiseGlobale?: Remise
  acomptes?: readonly DeductionAcompte[]
}

export interface LigneCalculee {
  id: string
  categorie: CategorieTva
  taux: number
  montantBrut: number
  montantRemise: number
  montantNet: number
}

export interface Ventilation {
  categorie: CategorieTva
  taux: number
  /** Somme des lignes nettes du groupe (avant remise globale et acomptes). */
  baseLignes: number
  remiseGlobale: number
  acomptes: number
  /** Base imposable finale (BT-116). */
  baseHt: number
  /** Montant de TVA (BT-117). */
  tva: number
  motifExoneration?: string
}

export type CategorieOperation = 'biens' | 'services' | 'mixte'

export interface Totaux {
  lignes: LigneCalculee[]
  /** BT-106 : somme des montants nets des lignes. */
  totalLignesHt: number
  /** BT-107 : remise au niveau du document (montant positif pour une facture). */
  remiseGlobale: number
  /** Total HT des acomptes déduits (montant positif). */
  acomptesHt: number
  ventilation: Ventilation[]
  /** BT-109 */
  totalHt: number
  /** BT-110 */
  totalTva: number
  /** BT-112 */
  totalTtc: number
  /** BT-115 : montant net à payer. */
  netAPayer: number
  /** Mention « catégorie de l'opération » (null si aucune ligne de bien ou de service). */
  categorieOperation: CategorieOperation | null
}

const UN = 1000
const CENT_POUR_CENT = 10_000

function verifierRemise(remise: Remise, nom: string): void {
  exigerEntier(remise.valeur, `${nom}.valeur`)
  if (remise.type === 'pourcentage' && (remise.valeur < 0 || remise.valeur > CENT_POUR_CENT)) {
    throw new ErreurMontant(`${nom} : le pourcentage doit être compris entre 0 et 100 %`)
  }
}

/** Montant d'une remise appliquée à un montant de référence. */
function montantRemise(remise: Remise | undefined, reference: number, nom: string): number {
  if (!remise) return 0
  verifierRemise(remise, nom)
  if (remise.type === 'pourcentage') return multiplierDiviser(reference, remise.valeur, CENT_POUR_CENT)
  if (remise.valeur !== 0 && Math.sign(remise.valeur) !== Math.sign(reference)) {
    throw new ErreurMontant(`${nom} : la remise doit être du même signe que le montant remisé`)
  }
  if (Math.abs(remise.valeur) > Math.abs(reference)) {
    throw new ErreurMontant(`${nom} : la remise dépasse le montant remisé`)
  }
  return remise.valeur
}

export function calculerLigne(ligne: LigneEntree): LigneCalculee {
  exigerEntier(ligne.quantite, `Ligne ${ligne.id} : quantité`)
  exigerEntier(ligne.prixUnitaireHt, `Ligne ${ligne.id} : prix unitaire`)
  exigerEntier(ligne.taux, `Ligne ${ligne.id} : taux`)
  if (ligne.taux < 0 || ligne.taux > CENT_POUR_CENT) {
    throw new ErreurMontant(`Ligne ${ligne.id} : taux de TVA hors limites`)
  }
  if (ligne.categorie === 'S' && ligne.taux === 0) {
    throw new ErreurMontant(`Ligne ${ligne.id} : un taux nul relève de la catégorie Z ou d'une exonération`)
  }
  if (ligne.nature === 'debours' && ligne.categorie !== 'O') {
    throw new ErreurMontant(`Ligne ${ligne.id} : les débours sont hors champ de la TVA (catégorie O)`)
  }
  const montantBrut = multiplierDiviser(ligne.quantite, ligne.prixUnitaireHt, UN)
  const remise = montantRemise(ligne.remise, montantBrut, `Ligne ${ligne.id} : remise`)
  return {
    id: ligne.id,
    categorie: ligne.categorie,
    taux: tauxEffectif(ligne.categorie, ligne.taux),
    montantBrut,
    montantRemise: remise,
    montantNet: montantBrut - remise,
  }
}

export function categorieOperation(lignes: readonly Pick<LigneEntree, 'nature'>[]): CategorieOperation | null {
  const biens = lignes.some((l) => l.nature === 'bien')
  const services = lignes.some((l) => l.nature === 'service')
  if (biens && services) return 'mixte'
  if (biens) return 'biens'
  if (services) return 'services'
  return null
}

export function calculerDocument(document: DocumentEntree): Totaux {
  const lignes = document.lignes.map(calculerLigne)

  // 2. Ventilation par catégorie et taux, dans l'ordre d'apparition.
  const groupes = new Map<string, Ventilation>()
  const groupe = (categorie: CategorieTva, taux: number, motif?: string): Ventilation => {
    const cle = cleVentilation(categorie, taux)
    let g = groupes.get(cle)
    if (!g) {
      g = { categorie, taux: tauxEffectif(categorie, taux), baseLignes: 0, remiseGlobale: 0, acomptes: 0, baseHt: 0, tva: 0 }
      groupes.set(cle, g)
    }
    if (motif && !g.motifExoneration) g.motifExoneration = motif
    return g
  }
  document.lignes.forEach((ligne, i) => {
    groupe(ligne.categorie, ligne.taux, ligne.motifExoneration).baseLignes += lignes[i]!.montantNet
  })

  // 3. Remise globale, hors débours.
  const remisables = [...groupes.values()].filter((g) => g.categorie !== 'O')
  const baseRemisable = remisables.reduce((s, g) => s + g.baseLignes, 0)
  const remiseGlobale = montantRemise(document.remiseGlobale, baseRemisable, 'Remise globale')
  repartir(
    remiseGlobale,
    remisables.map((g) => g.baseLignes),
  ).forEach((part, i) => {
    remisables[i]!.remiseGlobale = part
  })

  // 4. Acomptes déduits.
  let acomptesHt = 0
  for (const acompte of document.acomptes ?? []) {
    for (const v of acompte.ventilation) {
      exigerEntier(v.baseHt, `Acompte ${acompte.numero} : base`)
      if (v.baseHt < 0) throw new ErreurMontant(`Acompte ${acompte.numero} : la base doit être positive`)
      groupe(v.categorie, v.taux).acomptes += v.baseHt
      acomptesHt += v.baseHt
    }
  }

  // 5. Base et TVA par groupe.
  const ventilation = [...groupes.values()].map((g) => {
    const baseHt = g.baseLignes - g.remiseGlobale - g.acomptes
    return { ...g, baseHt, tva: multiplierDiviser(baseHt, g.taux, CENT_POUR_CENT) }
  })

  const totalLignesHt = lignes.reduce((s, l) => s + l.montantNet, 0)
  const totalHt = ventilation.reduce((s, g) => s + g.baseHt, 0)
  const totalTva = ventilation.reduce((s, g) => s + g.tva, 0)
  const totalTtc = totalHt + totalTva

  return {
    lignes,
    totalLignesHt,
    remiseGlobale,
    acomptesHt,
    ventilation,
    totalHt,
    totalTva,
    totalTtc,
    netAPayer: totalTtc,
    categorieOperation: categorieOperation(document.lignes),
  }
}
