/**
 * Multi-devises : la facture peut être libellée dans une autre devise, mais la TVA
 * doit alors aussi être exprimée en euros (BT-6 / BT-111).
 */

import { ErreurMontant, multiplierDiviser } from './arrondi'

/** Convertit un montant avec un taux de change décimal exprimé en chaîne (« 0.9234 » : 1 unité = 0,9234 €). */
export function convertir(centimes: number, tauxChange: string): number {
  const m = /^(\d{1,6})(?:[.,](\d{1,8}))?$/.exec(tauxChange.trim())
  if (!m || Number(tauxChange.replace(',', '.')) <= 0) {
    throw new ErreurMontant(`Taux de change invalide : ${tauxChange}`)
  }
  const decimales = m[2] ?? ''
  const numerateur = Number(`${m[1]}${decimales}`)
  const denominateur = 10 ** decimales.length
  return multiplierDiviser(centimes, numerateur, denominateur)
}
