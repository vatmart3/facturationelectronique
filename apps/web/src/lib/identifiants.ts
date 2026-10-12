/**
 * Validation des identifiants légaux français et bancaires.
 * Les règles de clé sont publiques (INSEE pour SIREN/SIRET, ISO 13616 pour l'IBAN,
 * DGFiP pour la clé de TVA intracommunautaire).
 */

import { normaliserIban } from './format'

/** Contrôle de Luhn sur une chaîne de chiffres. */
export function luhnValide(chiffres: string): boolean {
  if (!/^\d+$/.test(chiffres)) return false
  let somme = 0
  for (let i = 0; i < chiffres.length; i++) {
    let d = Number(chiffres[chiffres.length - 1 - i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    somme += d
  }
  return somme % 10 === 0
}

export function nettoyerChiffres(valeur: string): string {
  return valeur.replace(/[\s.\-]/g, '')
}

export function sirenValide(valeur: string): boolean {
  const siren = nettoyerChiffres(valeur)
  return /^\d{9}$/.test(siren) && luhnValide(siren)
}

/** SIREN de La Poste : ses SIRET suivent une règle propre (somme des chiffres multiple de 5). */
const SIREN_LA_POSTE = '356000000'

export function siretValide(valeur: string): boolean {
  const siret = nettoyerChiffres(valeur)
  if (!/^\d{14}$/.test(siret)) return false
  if (siret.startsWith(SIREN_LA_POSTE) && siret !== '35600000000048') {
    const somme = [...siret].reduce((s, c) => s + Number(c), 0)
    return somme % 5 === 0
  }
  return luhnValide(siret)
}

/** Numéro de TVA intracommunautaire français déduit du SIREN : FR + clé (2 chiffres) + SIREN. */
export function tvaIntracomDepuisSiren(valeur: string): string {
  const siren = nettoyerChiffres(valeur)
  if (!sirenValide(siren)) throw new Error(`SIREN invalide : ${valeur}`)
  const cle = (12 + 3 * (Number(siren) % 97)) % 97
  return `FR${String(cle).padStart(2, '0')}${siren}`
}

export function tvaIntracomFrValide(valeur: string): boolean {
  const tva = valeur.replace(/\s+/g, '').toUpperCase()
  const m = /^FR(\d{2})(\d{9})$/.exec(tva)
  if (!m || !sirenValide(m[2]!)) return false
  return tvaIntracomDepuisSiren(m[2]!) === tva
}

const LONGUEURS_IBAN: Record<string, number> = {
  FR: 27, MC: 27, DE: 22, BE: 16, ES: 24, IT: 27, LU: 20, NL: 18, PT: 25, CH: 21, GB: 22, IE: 22, AT: 20,
}

/** IBAN : longueur par pays connue + clé ISO 13616 (mod 97 = 1). */
export function ibanValide(valeur: string): boolean {
  const iban = normaliserIban(valeur)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false
  const attendue = LONGUEURS_IBAN[iban.slice(0, 2)]
  if (attendue !== undefined && iban.length !== attendue) return false
  const reordonne = iban.slice(4) + iban.slice(0, 4)
  let reste = 0
  for (const c of reordonne) {
    const n = c >= 'A' && c <= 'Z' ? String(c.charCodeAt(0) - 55) : c
    for (const d of n) reste = (reste * 10 + Number(d)) % 97
  }
  return reste === 1
}

export function bicValide(valeur: string): boolean {
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(valeur.replace(/\s+/g, '').toUpperCase())
}
