'use server'

import { revalidatePath } from 'next/cache'
import { aujourdHui } from '@/lib/document'
import { cleDoublon, referenceReleve } from '@/lib/rapprochement'
import { peutFacturer } from '@/lib/roles'
import { chargerContexte } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export type BilanRapprochement = { ok: true; enregistres: number; ignores: string[] } | { ok: false; erreur: string }

/** Enregistre, en virements, les lignes de relevé associées à une facture. Les doublons d'un import précédent sont ignorés. */
export async function rapprocher(slug: string, lignes: Array<{ documentId: string; montant: number; date: string; libelle: string }>): Promise<BilanRapprochement> {
  const { organisation, role } = await chargerContexte(slug)
  if (!peutFacturer(role)) return { ok: false, erreur: 'Action non autorisée.' }
  if (!Array.isArray(lignes) || lignes.length === 0) return { ok: false, erreur: 'Aucune ligne à enregistrer.' }
  if (lignes.length > 500) return { ok: false, erreur: '500 lignes au plus par import.' }

  const supabase = await creerClientServeur()
  const ids = [...new Set(lignes.map((l) => l.documentId))]
  const [{ data: factures }, { data: existants }] = await Promise.all([
    supabase.from('documents').select('id, number, type, status, amount_due, amount_paid').eq('organization_id', organisation.id).in('id', ids),
    supabase.from('payments').select('paid_on, amount_cents, reference').eq('organization_id', organisation.id).in('document_id', ids).like('reference', 'Relevé : %'),
  ])
  const restes = new Map(
    (factures ?? [])
      .filter((f) => (f.type === 'facture' || f.type === 'acompte') && ['emis', 'envoye', 'partiellement_paye'].includes(f.status))
      .map((f) => [f.id, { numero: f.number ?? '', reste: Number(f.amount_due) - Number(f.amount_paid) }]),
  )
  const deja = new Set((existants ?? []).map((p) => cleDoublon(p.paid_on, Number(p.amount_cents), p.reference ?? '')))
  const jour = aujourdHui()
  const ignores: string[] = []
  let enregistres = 0

  for (const l of lignes) {
    const f = restes.get(l.documentId)
    const reference = referenceReleve(String(l.libelle ?? '').slice(0, 300))
    const cle = cleDoublon(l.date, l.montant, reference)
    if (!f) ignores.push(`${l.libelle} : facture introuvable ou déjà soldée`)
    else if (!Number.isSafeInteger(l.montant) || l.montant <= 0) ignores.push(`${l.libelle} : montant invalide`)
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(l.date) || l.date > jour) ignores.push(`${l.libelle} : date invalide`)
    else if (l.montant > f.reste) ignores.push(`${l.libelle} : dépasse le reste dû de ${f.numero}`)
    else if (deja.has(cle)) ignores.push(`${l.libelle} : déjà enregistré`)
    else {
      const { error } = await supabase.from('payments').insert({
        organization_id: organisation.id,
        document_id: l.documentId,
        amount_cents: l.montant,
        paid_on: l.date,
        method: 'virement',
        reference,
      })
      if (error) ignores.push(`${l.libelle} : enregistrement refusé`)
      else {
        enregistres++
        f.reste -= l.montant
        deja.add(cle)
      }
    }
  }
  revalidatePath(`/${slug}`, 'layout')
  return { ok: true, enregistres, ignores }
}
