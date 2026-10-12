/** Simulateur de la page d'accueil : temps et argent perdus sur la facturation. Pur et testé. */

export interface Saisie {
  facturesParMois: number
  minutesParFacture: number
  tauxHoraire: number
}

/** Avec Pastille : 30 secondes par facture pour un client existant. */
export const MINUTES_PASTILLE = 0.5

export function simuler(s: Saisie): { heuresPerdues: number; euros: number; heuresGagnees: number } {
  const n = Math.max(0, Math.min(1000, Math.round(s.facturesParMois)))
  const m = Math.max(0, Math.min(240, s.minutesParFacture))
  const avant = (n * m) / 60
  const apres = (n * MINUTES_PASTILLE) / 60
  const gain = Math.max(0, avant - apres)
  return { heuresPerdues: Math.round(avant * 10) / 10, heuresGagnees: Math.round(gain * 10) / 10, euros: Math.round(gain * Math.max(0, s.tauxHoraire)) }
}
