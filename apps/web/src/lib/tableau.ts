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

  return {
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
