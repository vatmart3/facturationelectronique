/**
 * Formats de numérotation : {AAAA} année, {AA} année sur 2 chiffres, {MM} mois,
 * {N…} numéro de séquence complété à autant de chiffres que de N.
 * Doit rester aligné sur private.formater_numero() en SQL (phase 5).
 */

export const FORMATS_SUGGERES = ['F-{AAAA}-{NNNN}', '{AAAA}-{MM}-{NNN}', 'FA{AA}{NNNNN}', '{AAAA}{NNNN}']

export function formatValide(format: string): boolean {
  return /\{N+\}/.test(format) && format.length <= 40 && !/[^A-Za-z0-9{}\-_/.]/.test(format)
}

export function formaterNumero(format: string, annee: number, mois: number, numero: number): string {
  return format
    .replace(/\{AAAA\}/g, String(annee))
    .replace(/\{AA\}/g, String(annee).slice(-2))
    .replace(/\{MM\}/g, String(mois).padStart(2, '0'))
    .replace(/\{(N+)\}/g, (_, n: string) => String(numero).padStart(n.length, '0'))
}

/** La séquence repart à 1 chaque année si le format contient l'année, chaque mois s'il contient le mois. */
export function cleSequence(format: string, annee: number, mois: number): string {
  if (format.includes('{MM}')) return `${annee}-${String(mois).padStart(2, '0')}`
  if (format.includes('{AAAA}') || format.includes('{AA}')) return String(annee)
  return 'unique'
}
