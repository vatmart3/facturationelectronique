/**
 * E-reporting (réforme 2026-2027) : ce qui n'est pas une facture électronique entre assujettis
 * français est déclaré via la plateforme agréée.
 *  - Transactions : ventes aux particuliers (agrégées par jour, catégorie d'opération et taux)
 *    et opérations internationales (détaillées par facture).
 *  - Paiements : encaissements des prestations de services (TVA exigible à l'encaissement).
 * Pur et testé.
 */

import type { CategorieTva } from '@pastille/moteur'
import type { TypeClient } from './fiscalite'

export type Frequence = 'decade' | 'mois' | 'bimestre'

export interface Periode {
  debut: string
  fin: string
  libelle: string
}

function iso(a: number, m: number, j: number): string {
  return new Date(Date.UTC(a, m - 1, j)).toISOString().slice(0, 10)
}

function finDeMois(a: number, m: number): number {
  return new Date(Date.UTC(a, m, 0)).getUTCDate()
}

const MOIS = (a: number, m: number) => new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(a, m - 1, 1)))

/** Période contenant le jour donné. */
export function periodeDe(frequence: Frequence, jour: string): Periode {
  const [a, m, j] = jour.split('-').map(Number) as [number, number, number]
  if (frequence === 'decade') {
    const debut = j <= 10 ? 1 : j <= 20 ? 11 : 21
    const fin = debut === 21 ? finDeMois(a, m) : debut + 9
    return { debut: iso(a, m, debut), fin: iso(a, m, fin), libelle: `${debut === 1 ? '1re' : debut === 11 ? '2e' : '3e'} décade de ${MOIS(a, m)}` }
  }
  if (frequence === 'bimestre') {
    const premier = m % 2 === 1 ? m : m - 1
    return { debut: iso(a, premier, 1), fin: iso(a, premier + 1, finDeMois(a, premier + 1)), libelle: `${MOIS(a, premier).split(' ')[0]}-${MOIS(a, premier + 1)}` }
  }
  return { debut: iso(a, m, 1), fin: iso(a, m, finDeMois(a, m)), libelle: MOIS(a, m) }
}

/** Période précédente (celle à déclarer). */
export function periodePrecedente(frequence: Frequence, jour: string): Periode {
  const p = periodeDe(frequence, jour)
  const veille = new Date(Date.parse(`${p.debut}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
  return periodeDe(frequence, veille)
}

export interface DocTransaction {
  numero: string
  type: 'facture' | 'acompte' | 'avoir'
  date: string
  client: { kind: TypeClient; pays: string; tva: string | null; nom: string }
  categorieOperation: 'biens' | 'services' | 'mixte' | null
  ventilation: Array<{ categorie: CategorieTva; taux: number; base: number; tva: number }>
}

export interface RapportTransactions {
  particuliers: Array<{ date: string; operation: string; categorie: CategorieTva; taux: number; base: number; tva: number; nombre: number }>
  international: Array<{ numero: string; date: string; client: string; pays: string; tva: string | null; base: number; montantTva: number }>
  totaux: { base: number; tva: number; documents: number }
}

/** Les factures B2B domestiques passent par la facturation électronique : elles sont exclues. */
export function rapportTransactions(docs: readonly DocTransaction[], periode: Pick<Periode, 'debut' | 'fin'>): RapportTransactions {
  const dans = docs.filter((d) => d.date >= periode.debut && d.date <= periode.fin)
  const groupes = new Map<string, RapportTransactions['particuliers'][number]>()
  const international: RapportTransactions['international'] = []
  let documents = 0
  for (const d of dans) {
    if (d.client.kind === 'b2b' || d.client.kind === 'b2g') continue
    documents++
    if (d.client.kind === 'b2c') {
      for (const v of d.ventilation) {
        const operation = d.categorieOperation ?? 'services'
        const cle = `${d.date}|${operation}|${v.categorie}|${v.taux}`
        const g = groupes.get(cle) ?? { date: d.date, operation, categorie: v.categorie, taux: v.taux, base: 0, tva: 0, nombre: 0 }
        g.base += v.base
        g.tva += v.tva
        groupes.set(cle, g)
      }
      const premier = d.ventilation[0]
      if (premier) groupes.get(`${d.date}|${d.categorieOperation ?? 'services'}|${premier.categorie}|${premier.taux}`)!.nombre++
    } else {
      international.push({
        numero: d.numero,
        date: d.date,
        client: d.client.nom,
        pays: d.client.pays,
        tva: d.client.tva,
        base: d.ventilation.reduce((s, v) => s + v.base, 0),
        montantTva: d.ventilation.reduce((s, v) => s + v.tva, 0),
      })
    }
  }
  const particuliers = [...groupes.values()].sort((a, b) => (a.date === b.date ? b.taux - a.taux : a.date < b.date ? -1 : 1))
  return {
    particuliers,
    international: international.sort((a, b) => (a.date < b.date ? -1 : 1)),
    totaux: {
      base: particuliers.reduce((s, g) => s + g.base, 0) + international.reduce((s, x) => s + x.base, 0),
      tva: particuliers.reduce((s, g) => s + g.tva, 0) + international.reduce((s, x) => s + x.montantTva, 0),
      documents,
    },
  }
}

export interface PaiementService {
  date: string
  numero: string
  montant: number
  /** Ventilation de la facture payée, pour répartir l'encaissement par taux. */
  ventilation: Array<{ taux: number; base: number; tva: number }>
  categorieOperation: 'biens' | 'services' | 'mixte' | null
}

/** Encaissements des prestations de services, répartis par taux au prorata de la facture. */
export function rapportPaiements(
  paiements: readonly PaiementService[],
  periode: Pick<Periode, 'debut' | 'fin'>,
  tvaSurLesDebits: boolean,
): Array<{ date: string; taux: number; montant: number }> {
  if (tvaSurLesDebits) return []
  const groupes = new Map<string, { date: string; taux: number; montant: number }>()
  for (const p of paiements) {
    if (p.date < periode.debut || p.date > periode.fin || p.categorieOperation === 'biens') continue
    const total = p.ventilation.reduce((s, v) => s + v.base + v.tva, 0)
    if (total === 0) continue
    let reste = p.montant
    p.ventilation.forEach((v, i) => {
      const part = i === p.ventilation.length - 1 ? reste : Math.round((p.montant * (v.base + v.tva)) / total)
      reste -= part
      const cle = `${p.date}|${v.taux}`
      const g = groupes.get(cle) ?? { date: p.date, taux: v.taux, montant: 0 }
      g.montant += part
      groupes.set(cle, g)
    })
  }
  return [...groupes.values()].sort((a, b) => (a.date === b.date ? b.taux - a.taux : a.date < b.date ? -1 : 1))
}
