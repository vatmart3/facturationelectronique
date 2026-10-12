/**
 * Formatage d'affichage. Les montants sont toujours stockés en centimes entiers ;
 * aucune valeur monétaire ne transite en flottant hors de l'affichage.
 */

const formatEuros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

export function formatMontant(centimes: number, devise = 'EUR'): string {
  if (!Number.isSafeInteger(centimes)) {
    throw new TypeError(`Montant invalide : ${centimes} (entier de centimes attendu)`)
  }
  const format =
    devise === 'EUR' ? formatEuros : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: devise })
  return format.format(centimes / 100)
}

const formatDateCourte = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return formatDateCourte.format(d)
}

/** Groupe des chiffres par paquets, ex. SIREN « 732 829 320 ». */
export function grouperChiffres(valeur: string, taille = 3): string {
  const chiffres = valeur.replace(/\D/g, '')
  const motif = new RegExp(`(\\d{${taille}})(?=\\d)`, 'g')
  return chiffres.replace(motif, '$1 ')
}

/** IBAN affiché par blocs de 4. */
export function formatIban(iban: string): string {
  return normaliserIban(iban).replace(/(.{4})(?=.)/g, '$1 ')
}

export function normaliserIban(iban: string): string {
  return iban.replace(/\s+/g, '').toUpperCase()
}
