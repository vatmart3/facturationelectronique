/** Aides à la saisie : quantités décimales, prix TTC, ligne rapide « 3 x Création logo 450 ». */

import { ErreurMontant, exigerEntier, multiplierDiviser } from './arrondi'

/** « 1,5 » → 1500 millièmes. Au plus 3 décimales. Retourne null si invalide. */
export function quantiteDepuisSaisie(saisie: string): number | null {
  const m = /^(-)?(\d{1,9})(?:[.,](\d{1,3}))?$/.exec(saisie.trim().replace(/\s/g, ''))
  if (!m) return null
  const valeur = Number(m[2]) * 1000 + Number((m[3] ?? '').padEnd(3, '0'))
  return m[1] ? -valeur : valeur
}

/** « 1 250,50 » → 125050 centimes. Au plus 2 décimales. Retourne null si invalide. */
export function centimesDepuisSaisie(saisie: string): number | null {
  const m = /^(-)?(\d{1,13})(?:[.,](\d{1,2}))?$/.exec(saisie.trim().replace(/[\s  €]/g, ''))
  if (!m) return null
  const valeur = Number(m[2]) * 100 + Number((m[3] ?? '').padEnd(2, '0'))
  return m[1] ? -valeur : valeur
}

/** Prix HT à partir d'un prix TTC saisi (taux en points de base). */
export function prixHtDepuisTtc(prixTtc: number, taux: number): number {
  exigerEntier(taux, 'Taux')
  if (taux < 0) throw new ErreurMontant('Taux négatif')
  return multiplierDiviser(prixTtc, 10_000, 10_000 + taux)
}

/** Prix TTC indicatif d'un prix HT (affichage uniquement : la TVA réelle se calcule par taux). */
export function prixTtcDepuisHt(prixHt: number, taux: number): number {
  exigerEntier(taux, 'Taux')
  return prixHt + multiplierDiviser(prixHt, taux, 10_000)
}

export interface LigneRapide {
  quantite: number
  designation: string
  prixUnitaireHt: number | null
}

/**
 * Analyse une saisie libre :
 *  « 3 x Création logo 450 » · « 2,5 × Conseil 80,00 € » · « Création logo 450 » · « 3x Logo ».
 */
export function analyserLigneRapide(saisie: string): LigneRapide | null {
  const texte = saisie.trim().replace(/\s+/g, ' ')
  if (!texte) return null
  // \s+ a déjà été normalisé en espace simple ; tous les groupes sont facultatifs,
  // l'expression correspond donc toujours à un texte non vide.
  const m = /^(?:(\d+(?:[.,]\d{1,3})?)\s*[x×*]\s*)?(.*?)(?:\s+(\d[\d ]*(?:[.,]\d{1,2})?)\s*€?)?$/i.exec(texte)!
  const designation = m[2]!.trim()
  if (!designation) return null
  return {
    quantite: m[1] ? (quantiteDepuisSaisie(m[1]) as number) : 1000,
    designation,
    prixUnitaireHt: m[3] ? centimesDepuisSaisie(m[3]) : null,
  }
}
