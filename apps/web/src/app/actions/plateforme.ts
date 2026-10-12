'use server'

import { revalidatePath } from 'next/cache'
import { aujourdHui } from '@/lib/document'
import { periodeDe } from '@/lib/ereporting'
import type { Decision } from '@/lib/pa'
import { actualiserTransmission, deciderFactureRecue, deposerEreporting, factureFournisseurSimulee, releverFactures, transmettreDocument } from '@/lib/plateforme-serveur'
import { peutFacturer, peutModifierOrganisation } from '@/lib/roles'
import { chargerContexte } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import type { EtatSuivi } from './suivi'

type Retour = { ok: true } | { ok: false; erreur: string }

async function editeur(slug: string) {
  const ctx = await chargerContexte(slug)
  if (!peutFacturer(ctx.role)) throw new Error('Action non autorisée.')
  return ctx
}

export async function transmettre(slug: string, documentId: string): Promise<Retour> {
  const { organisation } = await editeur(slug)
  const r = await transmettreDocument(await creerClientServeur(), organisation, documentId)
  if (!r.ok) return r
  revalidatePath(`/${slug}`, 'layout')
  return { ok: true }
}

export async function actualiser(slug: string, transmissionId: string): Promise<Retour> {
  const { organisation } = await editeur(slug)
  const supabase = await creerClientServeur()
  const { data: t } = await supabase.from('einvoice_transmissions').select('*').eq('id', transmissionId).eq('organization_id', organisation.id).maybeSingle()
  if (!t) return { ok: false, erreur: 'Transmission introuvable.' }
  const r = await actualiserTransmission(supabase, organisation, t)
  if (!r.ok) return r
  revalidatePath(`/${slug}`, 'layout')
  return { ok: true }
}

export async function relever(slug: string, _: EtatSuivi): Promise<EtatSuivi> {
  const { organisation } = await editeur(slug)
  const r = await releverFactures(await creerClientServeur(), organisation)
  if (!r.ok) return { erreur: r.erreur }
  revalidatePath(`/${slug}/e-facturation/recues`)
  const { nouvelles, illisibles } = r.valeur
  return { ok: true, message: nouvelles ? `${nouvelles} nouvelle${nouvelles > 1 ? 's' : ''} facture${nouvelles > 1 ? 's' : ''} reçue${nouvelles > 1 ? 's' : ''}.` : `Aucune nouvelle facture${illisibles ? ` (${illisibles} illisible(s))` : ''}.` }
}

/** Plateforme simulée : fait arriver une facture fournisseur de démonstration. */
export async function simulerReception(slug: string, _: EtatSuivi): Promise<EtatSuivi> {
  const { organisation } = await editeur(slug)
  if (organisation.pa_provider !== 'simulee') return { erreur: 'Disponible uniquement avec la plateforme simulée.' }
  const r = await releverFactures(await creerClientServeur(), organisation, [factureFournisseurSimulee(organisation, aujourdHui())])
  if (!r.ok) return { erreur: r.erreur }
  revalidatePath(`/${slug}/e-facturation/recues`)
  return { ok: true, message: 'Une facture fournisseur vient d’arriver.' }
}

export async function decider(slug: string, id: string, _: EtatSuivi, f: FormData): Promise<EtatSuivi> {
  const { organisation } = await editeur(slug)
  const decision = String(f.get('decision') ?? '') as Decision
  if (!['approuvee', 'refusee', 'litige', 'payee'].includes(decision)) return { erreur: 'Décision inconnue.' }
  const motif = String(f.get('motif') ?? '').trim().slice(0, 500) || null
  const r = await deciderFactureRecue(await creerClientServeur(), organisation, id, decision, motif)
  if (!r.ok) return { erreur: r.erreur }
  revalidatePath(`/${slug}/e-facturation/recues`)
  return { ok: true, message: 'Décision transmise au fournisseur.' }
}

export async function declarer(slug: string, type: 'transactions' | 'paiements', jour: string, _: EtatSuivi): Promise<EtatSuivi> {
  const { organisation } = await editeur(slug)
  const periode = periodeDe(organisation.ereporting_frequency, jour)
  if (periode.fin >= aujourdHui()) return { erreur: 'La période n’est pas terminée.' }
  const r = await deposerEreporting(await creerClientServeur(), organisation, type, periode)
  if (!r.ok) return { erreur: r.erreur }
  revalidatePath(`/${slug}/e-facturation/e-reporting`)
  return { ok: true, message: `${type === 'transactions' ? 'Transactions' : 'Paiements'} de la période déposés sur la plateforme.` }
}

export async function enregistrerPlateforme(slug: string, _: EtatSuivi, f: FormData): Promise<EtatSuivi> {
  const { organisation, role } = await chargerContexte(slug)
  if (!peutModifierOrganisation(role)) return { erreur: 'Réservé aux administrateurs.' }
  const fournisseur = f.get('fournisseur') === 'afnor' ? 'afnor' : 'simulee'
  if (fournisseur === 'afnor' && !(process.env.PA_API_URL && process.env.PA_API_TOKEN)) {
    return { erreur: 'Connecteur AFNOR non configuré : définissez PA_API_URL et PA_API_TOKEN (fournis par votre plateforme agréée).' }
  }
  const frequence = String(f.get('frequence') ?? 'mois')
  const supabase = await creerClientServeur()
  const { error } = await supabase
    .from('organizations')
    .update({
      pa_provider: fournisseur,
      pa_account_id: String(f.get('compte') ?? '').trim().slice(0, 120) || null,
      pa_auto_transmit: f.get('auto') === 'on',
      pa_mandate_at: f.get('mandat') === 'on' ? (organisation.pa_mandate_at ?? new Date().toISOString()) : null,
      ereporting_frequency: frequence === 'decade' || frequence === 'bimestre' ? frequence : 'mois',
    })
    .eq('id', organisation.id)
  if (error) return { erreur: 'Enregistrement impossible.' }
  revalidatePath(`/${slug}`, 'layout')
  return { ok: true, message: 'Réglages enregistrés.' }
}
