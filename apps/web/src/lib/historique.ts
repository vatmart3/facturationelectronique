import { LIBELLES_TYPE, type TypeDocument } from './document'
import { formatMontant } from './format'
import { libelleMoyen } from './suivi'
import type { IconeNav } from './navigation'
import type { PaymentMethod } from './supabase/types'

export interface Evenement {
  id: string
  date: string
  icone: IconeNav
  titre: string
  detail: string
  documentId: string
  type: TypeDocument
}

interface DocumentHistorique {
  id: string
  type: TypeDocument
  status: string
  number: string | null
  issue_date: string
  total_ttc: number | string
  currency: string
}

const ICONES: Record<TypeDocument, IconeNav> = { facture: 'facture', acompte: 'facture', devis: 'devis', avoir: 'avoir' }

/** Chronologie d'un client, la plus récente d'abord : documents émis, paiements reçus, envois et relances. */
export function construireHistorique(
  documents: DocumentHistorique[],
  paiements: Array<{ id: string; document_id: string; amount_cents: number | string; paid_on: string; method: PaymentMethod }>,
  envois: Array<{ id: string; document_id: string; kind: 'envoi' | 'relance' | 'remerciement'; step: number | null; recipient: string; sent_at: string; status: string }>,
): Evenement[] {
  const parId = new Map(documents.map((d) => [d.id, d]))
  const nom = (d: DocumentHistorique) => `${LIBELLES_TYPE[d.type].titre} ${d.number ?? '(brouillon)'}`
  const evenements: Evenement[] = []

  for (const d of documents) {
    if (d.status === 'brouillon') continue
    evenements.push({
      id: `d-${d.id}`,
      date: d.issue_date,
      icone: ICONES[d.type],
      titre: `${nom(d)} ${d.type === 'devis' ? 'créé' : d.type === 'avoir' ? 'émis' : 'émise'}`,
      detail: `${formatMontant(Number(d.total_ttc), d.currency)} TTC`,
      documentId: d.id,
      type: d.type,
    })
  }
  for (const p of paiements) {
    const d = parId.get(p.document_id)
    if (!d) continue
    evenements.push({
      id: `p-${p.id}`,
      date: p.paid_on,
      icone: 'paiements',
      titre: `Paiement reçu · ${nom(d)}`,
      detail: `${formatMontant(Number(p.amount_cents), d.currency)} par ${libelleMoyen(p.method).toLowerCase()}`,
      documentId: d.id,
      type: d.type,
    })
  }
  for (const e of envois) {
    const d = parId.get(e.document_id)
    if (!d) continue
    const quoi = e.kind === 'relance' ? `Relance${e.step ? ` n° ${e.step}` : ''}` : e.kind === 'remerciement' ? 'Remerciement' : 'Envoi par email'
    evenements.push({
      id: `e-${e.id}`,
      date: e.sent_at.slice(0, 10),
      icone: e.kind === 'relance' ? 'relances' : 'recues',
      titre: `${quoi} · ${nom(d)}`,
      detail: `À ${e.recipient}${e.status === 'simule' ? ' (simulé)' : e.status === 'echec' ? ' (échec)' : ''}`,
      documentId: d.id,
      type: d.type,
    })
  }
  return evenements.sort((a, b) => (a.date === b.date ? b.id.localeCompare(a.id) : a.date < b.date ? 1 : -1))
}

/** Délai moyen, en jours, entre l'émission d'une facture payée et son dernier paiement. */
export function delaiMoyenPaiement(
  documents: Array<{ id: string; type: TypeDocument; status: string; issue_date: string }>,
  paiements: Array<{ document_id: string; paid_on: string }>,
): number | null {
  const dernier = new Map<string, string>()
  for (const p of paiements) if (!dernier.has(p.document_id) || dernier.get(p.document_id)! < p.paid_on) dernier.set(p.document_id, p.paid_on)
  const delais = documents
    .filter((d) => d.type !== 'devis' && d.type !== 'avoir' && d.status === 'paye' && dernier.has(d.id))
    .map((d) => Math.max(0, Math.round((Date.parse(dernier.get(d.id)!) - Date.parse(d.issue_date)) / 86_400_000)))
  return delais.length ? Math.round(delais.reduce((s, x) => s + x, 0) / delais.length) : null
}
