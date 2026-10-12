/**
 * Suivi des factures : paiements, relances, récurrences. Pur et testé.
 */

import { eurosEnCentimes } from './montant'
import type { PaymentMethod, RecurrenceFrequency } from './supabase/types'

// ---------------------------------------------------------------------------
// Paiements
// ---------------------------------------------------------------------------

export const MOYENS_PAIEMENT: Array<{ valeur: PaymentMethod; libelle: string }> = [
  { valeur: 'virement', libelle: 'Virement' },
  { valeur: 'carte', libelle: 'Carte bancaire' },
  { valeur: 'prelevement', libelle: 'Prélèvement' },
  { valeur: 'cheque', libelle: 'Chèque' },
  { valeur: 'especes', libelle: 'Espèces' },
  { valeur: 'autre', libelle: 'Autre' },
]

export function libelleMoyen(m: PaymentMethod): string {
  return MOYENS_PAIEMENT.find((x) => x.valeur === m)!.libelle
}

export interface SaisiePaiement {
  montant: string
  date: string
  moyen: string
  reference: string
}

export type PaiementValide = { ok: true; amount_cents: number; paid_on: string; method: PaymentMethod; reference: string | null } | { ok: false; erreur: string }

export function validerPaiement(s: SaisiePaiement, resteDu: number, jour: string): PaiementValide {
  const montant = eurosEnCentimes(s.montant)
  if (montant === null || montant <= 0) return { ok: false, erreur: 'Montant invalide.' }
  if (montant > resteDu) return { ok: false, erreur: 'Le montant dépasse le reste à payer.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) return { ok: false, erreur: 'Date invalide.' }
  if (s.date > jour) return { ok: false, erreur: 'La date de paiement ne peut pas être dans le futur.' }
  const moyen = MOYENS_PAIEMENT.find((m) => m.valeur === s.moyen)
  if (!moyen) return { ok: false, erreur: 'Moyen de paiement inconnu.' }
  return { ok: true, amount_cents: montant, paid_on: s.date, method: moyen.valeur, reference: s.reference.trim().slice(0, 140) || null }
}

// ---------------------------------------------------------------------------
// Relances
// ---------------------------------------------------------------------------

function joursEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

export interface FactureARelancer {
  id: string
  due_date: string | null
  status: string
  relancesClient: boolean
}

/**
 * Étape de relance due aujourd'hui pour chaque facture ouverte : la plus récente
 * des étapes atteintes qui n'a pas encore été envoyée (une seule par passage).
 */
export function relancesDues(
  factures: readonly FactureARelancer[],
  etapes: readonly number[],
  dejaEnvoyees: ReadonlyMap<string, ReadonlySet<number>>,
  jour: string,
): Array<{ id: string; etape: number; retard: number }> {
  const triees = [...etapes].sort((a, b) => a - b)
  const dues: Array<{ id: string; etape: number; retard: number }> = []
  for (const f of factures) {
    if (!f.due_date || !f.relancesClient || !['emis', 'envoye', 'partiellement_paye'].includes(f.status)) continue
    const retard = joursEntre(f.due_date, jour)
    const atteintes = triees.filter((e) => retard >= e)
    const etape = atteintes.at(-1)
    if (etape === undefined || dejaEnvoyees.get(f.id)?.has(etape)) continue
    // Une étape plus ancienne jamais envoyée n'est pas rattrapée : seule la plus récente compte.
    dues.push({ id: f.id, etape, retard })
  }
  return dues
}

export function libelleEtape(etape: number): string {
  if (etape < 0) return `${-etape} jour${etape < -1 ? 's' : ''} avant l’échéance`
  if (etape === 0) return 'Le jour de l’échéance'
  return `${etape} jour${etape > 1 ? 's' : ''} après l’échéance`
}

export function analyserEtapes(saisie: string): number[] | null {
  const valeurs = saisie
    .split(/[,;\s]+/)
    .filter(Boolean)
    .map((x) => Number(x))
  if (valeurs.length > 8 || valeurs.some((v) => !Number.isInteger(v) || v < -30 || v > 120)) return null
  return [...new Set(valeurs)].sort((a, b) => a - b)
}

// ---------------------------------------------------------------------------
// Récurrences
// ---------------------------------------------------------------------------

export const FREQUENCES: Array<{ valeur: RecurrenceFrequency; libelle: string; mois: number }> = [
  { valeur: 'mensuelle', libelle: 'Tous les mois', mois: 1 },
  { valeur: 'trimestrielle', libelle: 'Tous les trimestres', mois: 3 },
  { valeur: 'semestrielle', libelle: 'Tous les six mois', mois: 6 },
  { valeur: 'annuelle', libelle: 'Tous les ans', mois: 12 },
]

/** Date suivante, en gardant le jour d'ancrage (31 → fin de mois les mois courts). */
export function prochaineDate(date: string, frequence: RecurrenceFrequency, jourAncre?: number): string {
  const [a, m, j] = date.split('-').map(Number) as [number, number, number]
  const mois = FREQUENCES.find((f) => f.valeur === frequence)!.mois
  const cible = new Date(Date.UTC(a, m - 1 + mois, 1))
  const dernier = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate()
  cible.setUTCDate(Math.min(jourAncre ?? j, dernier))
  return cible.toISOString().slice(0, 10)
}

/** Échéances à générer jusqu'à aujourd'hui (rattrapage borné). */
export function echeancesDues(r: { next_date: string; end_date: string | null; frequency: RecurrenceFrequency; jourAncre?: number }, jour: string, max = 12): string[] {
  const dates: string[] = []
  let d = r.next_date
  while (d <= jour && (!r.end_date || d <= r.end_date) && dates.length < max) {
    dates.push(d)
    d = prochaineDate(d, r.frequency, r.jourAncre)
  }
  return dates
}

/** Libellé de période pour une facture récurrente : « octobre 2026 », « T4 2026 ». */
export function periodeLibelle(date: string, frequence: RecurrenceFrequency): string {
  const [a, m] = date.split('-').map(Number) as [number, number]
  if (frequence === 'trimestrielle') return `T${Math.ceil(m / 3)} ${a}`
  if (frequence === 'semestrielle') return `S${m <= 6 ? 1 : 2} ${a}`
  if (frequence === 'annuelle') return String(a)
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(a, m - 1, 1)))
}

/** Remplace {periode} et {mois} dans les désignations d'un modèle. */
export function remplacerVariables(texte: string, date: string, frequence: RecurrenceFrequency): string {
  return texte.replace(/\{periode\}/g, periodeLibelle(date, frequence)).replace(/\{mois\}/g, periodeLibelle(date, 'mensuelle'))
}
