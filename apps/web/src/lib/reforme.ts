/** Échéances de la réforme de la facturation électronique (calendrier en vigueur en 2026). */

export const RECEPTION_OBLIGATOIRE = new Date(Date.UTC(2026, 8, 1))
export const EMISSION_PME_TPE = new Date(Date.UTC(2027, 8, 1))

/** Jours calendaires restants avant une échéance (0 si elle est passée). */
export function joursAvant(echeance: Date, aujourdhui = new Date()): number {
  const debut = Date.UTC(aujourdhui.getUTCFullYear(), aujourdhui.getUTCMonth(), aujourdhui.getUTCDate())
  return Math.max(0, Math.round((echeance.getTime() - debut) / 86_400_000))
}
