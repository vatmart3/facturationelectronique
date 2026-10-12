/**
 * Conversion d'une saisie en euros (« 10 000 », « 1 250,5 », « 99.90 ») en centimes entiers,
 * sans passer par un flottant. Retourne null si la saisie n'est pas un montant valide.
 */
export function eurosEnCentimes(saisie: string): number | null {
  const texte = saisie.replace(/[\s  €]/g, '')
  const m = /^(-)?(\d+)(?:[.,](\d{1,2}))?$/.exec(texte)
  if (!m) return null
  const centimes = Number(m[2]) * 100 + Number((m[3] ?? '').padEnd(2, '0'))
  if (!Number.isSafeInteger(centimes)) return null
  return m[1] ? -centimes : centimes
}

/** Inverse pour pré-remplir un champ : 1000050 → « 10000,50 ». */
export function centimesEnSaisie(centimes: number): string {
  const signe = centimes < 0 ? '-' : ''
  const abs = Math.abs(centimes)
  return `${signe}${Math.trunc(abs / 100)},${String(abs % 100).padStart(2, '0')}`
}
