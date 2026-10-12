/** Indicateurs du tableau de bord, calculés à partir des documents et des paiements. Pur et testé. */

import type { CategorieTva } from '@pastille/moteur'

export interface DocStat {
  id: string
  type: 'facture' | 'acompte' | 'avoir' | 'devis'
  status: string
  issue_date: string
  due_date: string | null
  valid_until: string | null
  total_ht: number
  total_ttc: number
  amount_due: number
  amount_paid: number
  client?: string | null
}

export interface PaiementStat {
  document_id: string
  paid_on: string
  amount_cents: number
}

export interface TvaStat {
  document_id: string
  vat_category: CategorieTva
  vat_rate: number
  base_cents: number
  vat_cents: number
}

export interface Tableau {
  encaisseMois: number
  nbPaiementsMois: number
  enAttente: { montant: number; nombre: number }
  enRetard: { montant: number; nombre: number }
  caExercice: number
  caMensuel: Array<{ mois: string; libelle: string; ht: number }>
  tvaMois: Array<{ categorie: CategorieTva; taux: number; base: number; tva: number }>
  devisEnAttente: { montant: number; nombre: number }
  delaiMoyen: number | null
  brouillons: number
  /** Encaissements attendus (reste dû) : échus ou dans 30 jours, de 31 à 60, de 61 à 90. */
  prevision: { j30: number; j60: number; j90: number }
  topClients: Array<{ client: string; ht: number }>
}

const OUVERTES = new Set(['emis', 'envoye', 'partiellement_paye'])

function moisDe(iso: string): string {
  return iso.slice(0, 7)
}

export function calculerTableau(docs: readonly DocStat[], paiements: readonly PaiementStat[], tva: readonly TvaStat[], jour: string): Tableau {
  const mois = moisDe(jour)
  const annee = jour.slice(0, 4)
  const emises = docs.filter((d) => d.type !== 'devis' && d.status !== 'brouillon')
  const ventes = emises

  const ouvertes = emises.filter((d) => d.type !== 'avoir' && OUVERTES.has(d.status))
  const reste = (d: DocStat) => Math.max(0, d.amount_due - d.amount_paid)
  const retard = ouvertes.filter((d) => d.due_date && d.due_date < jour)
  const attente = ouvertes.filter((d) => !(d.due_date && d.due_date < jour))

  // 12 derniers mois, du plus ancien au plus récent.
  const [a, m] = jour.split('-').map(Number) as [number, number]
  const caMensuel = Array.from({ length: 12 }, (_, i) => {
    const date = new Date(Date.UTC(a, m - 12 + i, 1))
    const cle = date.toISOString().slice(0, 7)
    return {
      mois: cle,
      libelle: new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' }).format(date).replace('.', ''),
      ht: ventes.filter((d) => moisDe(d.issue_date) === cle).reduce((s, d) => s + d.total_ht, 0),
    }
  })

  const idsMois = new Set(emises.filter((d) => moisDe(d.issue_date) === mois).map((d) => d.id))
  const groupes = new Map<string, { categorie: CategorieTva; taux: number; base: number; tva: number }>()
  for (const t of tva) {
    if (!idsMois.has(t.document_id)) continue
    const cle = `${t.vat_category}:${t.vat_rate}`
    const g = groupes.get(cle) ?? { categorie: t.vat_category, taux: t.vat_rate, base: 0, tva: 0 }
    g.base += t.base_cents
    g.tva += t.vat_cents
    groupes.set(cle, g)
  }

  const paiementsMois = paiements.filter((p) => moisDe(p.paid_on) === mois)
  const devis = docs.filter((d) => d.type === 'devis' && d.status === 'envoye' && !(d.valid_until && d.valid_until < jour))

  // Délai moyen de paiement : factures soldées, du jour d'émission au dernier paiement.
  const dernierPaiement = new Map<string, string>()
  for (const p of paiements) if ((dernierPaiement.get(p.document_id) ?? '') < p.paid_on) dernierPaiement.set(p.document_id, p.paid_on)
  const delais = emises
    .filter((d) => d.status === 'paye' && dernierPaiement.has(d.id))
    .map((d) => Math.max(0, Math.round((Date.parse(dernierPaiement.get(d.id)!) - Date.parse(d.issue_date)) / 86_400_000)))

  const horizon = (jours: number) => new Date(Date.parse(`${jour}T00:00:00Z`) + jours * 86_400_000).toISOString().slice(0, 10)
  const [h30, h60, h90] = [horizon(30), horizon(60), horizon(90)]
  const prevision = { j30: 0, j60: 0, j90: 0 }
  for (const d of ouvertes) {
    const ech = d.due_date ?? jour
    if (ech <= h30) prevision.j30 += reste(d)
    else if (ech <= h60) prevision.j60 += reste(d)
    else if (ech <= h90) prevision.j90 += reste(d)
  }
  const ilYAUnAn = horizon(-365)
  const parClient = new Map<string, number>()
  for (const d of ventes) {
    if (d.issue_date < ilYAUnAn || !d.client) continue
    parClient.set(d.client, (parClient.get(d.client) ?? 0) + d.total_ht)
  }
  const topClients = [...parClient.entries()]
    .map(([client, ht]) => ({ client, ht }))
    .filter((c) => c.ht > 0)
    .sort((a, b) => b.ht - a.ht)
    .slice(0, 5)

  return {
    prevision,
    topClients,
    encaisseMois: paiementsMois.reduce((s, p) => s + p.amount_cents, 0),
    nbPaiementsMois: paiementsMois.length,
    enAttente: { montant: attente.reduce((s, d) => s + reste(d), 0), nombre: attente.length },
    enRetard: { montant: retard.reduce((s, d) => s + reste(d), 0), nombre: retard.length },
    caExercice: ventes.filter((d) => d.issue_date.startsWith(annee)).reduce((s, d) => s + d.total_ht, 0),
    caMensuel,
    tvaMois: [...groupes.values()].sort((x, y) => y.taux - x.taux),
    devisEnAttente: { montant: devis.reduce((s, d) => s + d.total_ttc, 0), nombre: devis.length },
    delaiMoyen: delais.length ? Math.round(delais.reduce((s, x) => s + x, 0) / delais.length) : null,
    brouillons: docs.filter((d) => d.status === 'brouillon').length,
  }
}
