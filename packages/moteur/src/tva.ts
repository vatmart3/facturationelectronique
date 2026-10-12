/**
 * Catégories et taux de TVA. Les codes de catégorie sont ceux de la norme EN 16931
 * (UNCL 5305), réutilisés tels quels dans le XML Factur-X / UBL / CII.
 * Les taux sont exprimés en points de base : 20 % = 2000, 5,5 % = 550.
 */

export type CategorieTva =
  /** Taux normal ou réduit (S) */
  | 'S'
  /** Taux zéro (Z) */
  | 'Z'
  /** Exonéré, avec motif obligatoire : franchise en base, art. 261… (E) */
  | 'E'
  /** Autoliquidation par le preneur (AE) */
  | 'AE'
  /** Livraison intracommunautaire de biens (K) */
  | 'K'
  /** Exportation hors UE (G) */
  | 'G'
  /** Hors champ de la TVA, ex. débours (O) */
  | 'O'

export const TAUX = {
  normal: 2000,
  intermediaire: 1000,
  reduit: 550,
  particulier: 210,
  domNormal: 850,
  domReduit: 210,
  zero: 0,
} as const

/** Taux applicables par territoire (la table de référence vit en base, ceci sert de défaut). */
export const TAUX_PAR_TERRITOIRE = {
  metropole: [2000, 1000, 550, 210, 0],
  dom: [850, 210, 0],
} as const

const CATEGORIES_SANS_TAXE: ReadonlySet<CategorieTva> = new Set(['Z', 'E', 'AE', 'K', 'G', 'O'])

/** Les catégories autres que S ne portent jamais de TVA : leur taux est 0. */
export function tauxEffectif(categorie: CategorieTva, taux: number): number {
  return CATEGORIES_SANS_TAXE.has(categorie) ? 0 : taux
}

/** Les catégories qui exigent un motif d'exonération (BT-120) sur la facture. */
export function exigeMotif(categorie: CategorieTva): boolean {
  return categorie === 'E' || categorie === 'AE' || categorie === 'K' || categorie === 'G' || categorie === 'O'
}

/** Format d'affichage : 2000 → « 20 % », 550 → « 5,5 % ». */
export function formatTaux(taux: number): string {
  const entier = Math.trunc(taux / 100)
  const decimales = String(Math.abs(taux % 100)).padStart(2, '0').replace(/0+$/, '')
  return `${entier}${decimales ? `,${decimales}` : ''} %`
}

export function cleVentilation(categorie: CategorieTva, taux: number): string {
  return `${categorie}:${tauxEffectif(categorie, taux)}`
}
