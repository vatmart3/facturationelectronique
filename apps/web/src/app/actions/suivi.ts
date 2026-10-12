'use server'

import { revalidatePath } from 'next/cache'
import { aujourdHui } from '@/lib/document'
import { chargerDocument } from '@/lib/documents-serveur'
import { peutFacturer, peutModifierOrganisation } from '@/lib/roles'
import { chargerContexte } from '@/lib/session'
import { analyserEtapes, FREQUENCES, validerPaiement } from '@/lib/suivi'
import { creerClientServeur } from '@/lib/supabase/serveur'
import { envoyerDocument, executerRecurrences, executerRelances } from '@/lib/taches'
import type { RecurrenceFrequency } from '@/lib/supabase/types'

export type EtatSuivi = { ok?: boolean; erreur?: string; message?: string } | null

function texte(f: FormData, cle: string): string {
  const v = f.get(cle)
  return typeof v === 'string' ? v.trim() : ''
}

async function editeur(slug: string) {
  const ctx = await chargerContexte(slug)
  if (!peutFacturer(ctx.role)) throw new Error('Action non autorisée.')
  return ctx
}

export async function enregistrerPaiement(slug: string, documentId: string, _: EtatSuivi, f: FormData): Promise<EtatSuivi> {
  const { organisation } = await editeur(slug)
  const { ligne } = await chargerDocument(slug, documentId, ['facture', 'acompte'])
  const reste = Number(ligne.amount_due) - Number(ligne.amount_paid)
  const v = validerPaiement({ montant: texte(f, 'montant'), date: texte(f, 'date'), moyen: texte(f, 'moyen'), reference: texte(f, 'reference') }, reste, aujourdHui())
  if (!v.ok) return { erreur: v.erreur }
  const supabase = await creerClientServeur()
  const { error } = await supabase.from('payments').insert({
    organization_id: organisation.id,
    document_id: documentId,
    amount_cents: v.amount_cents,
    paid_on: v.paid_on,
    method: v.method,
    reference: v.reference,
  })
  if (error) return { erreur: error.message.includes('dépasse') ? 'Le montant dépasse le reste à payer.' : 'Enregistrement impossible.' }
  revalidatePath(`/${slug}`, 'layout')
  return { ok: true, message: v.amount_cents === reste ? 'Facture soldée.' : 'Paiement enregistré.' }
}

export async function supprimerPaiement(slug: string, paiementId: string): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const { organisation } = await editeur(slug)
  const supabase = await creerClientServeur()
  const { error } = await supabase.from('payments').delete().eq('id', paiementId).eq('organization_id', organisation.id)
  if (error) return { ok: false, erreur: 'Suppression impossible.' }
  revalidatePath(`/${slug}`, 'layout')
  return { ok: true }
}

export async function envoyerParEmail(slug: string, documentId: string, _: EtatSuivi, f: FormData): Promise<EtatSuivi> {
  const { organisation } = await editeur(slug)
  const r = await envoyerDocument(await creerClientServeur(), organisation, documentId, { destinataire: texte(f, 'destinataire'), message: texte(f, 'message') || null })
  if ('erreur' in r) return { erreur: r.erreur }
  revalidatePath(`/${slug}`, 'layout')
  if (r.resultat.statut === 'echec') return { erreur: `Envoi refusé par la messagerie : ${r.resultat.erreur}` }
  if (r.resultat.statut === 'simule') return { ok: true, message: `Envoi simulé à ${r.destinataire} : configurez RESEND_API_KEY pour envoyer réellement.` }
  return { ok: true, message: `Envoyé à ${r.destinataire}.` }
}

export async function relancer(slug: string, documentId: string): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const { organisation } = await editeur(slug)
  const { ligne } = await chargerDocument(slug, documentId, ['facture', 'acompte'])
  const retard = ligne.due_date ? Math.round((Date.parse(aujourdHui()) - Date.parse(ligne.due_date)) / 86_400_000) : 0
  const r = await envoyerDocument(await creerClientServeur(), organisation, documentId, { relance: { etape: null, retard } })
  if ('erreur' in r) return { ok: false, erreur: r.erreur }
  if (r.resultat.statut === 'echec') return { ok: false, erreur: r.resultat.erreur }
  revalidatePath(`/${slug}`, 'layout')
  return { ok: true }
}

export async function lancerRelances(slug: string, _: EtatSuivi): Promise<EtatSuivi> {
  const { organisation } = await editeur(slug)
  const b = await executerRelances(await creerClientServeur(), organisation)
  revalidatePath(`/${slug}/relances`)
  const total = b.envoyees + b.simulees
  return {
    ok: true,
    message:
      total + b.echecs + b.sansEmail === 0
        ? 'Aucune relance due aujourd’hui.'
        : `${total} relance${total > 1 ? 's' : ''}${b.simulees ? ' (simulées)' : ''}${b.sansEmail ? `, ${b.sansEmail} client(s) sans email` : ''}${b.echecs ? `, ${b.echecs} échec(s)` : ''}.`,
  }
}

export async function enregistrerReglagesRelances(slug: string, _: EtatSuivi, f: FormData): Promise<EtatSuivi> {
  const { organisation, role } = await chargerContexte(slug)
  if (!peutModifierOrganisation(role)) return { erreur: 'Réservé aux administrateurs.' }
  const etapes = analyserEtapes(texte(f, 'etapes'))
  if (!etapes) return { erreur: 'Étapes invalides : jusqu’à 8 nombres entre -30 et 120, séparés par des virgules.' }
  const email = texte(f, 'reponse')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { erreur: 'Adresse de réponse invalide.' }
  const supabase = await creerClientServeur()
  const { error } = await supabase
    .from('organizations')
    .update({ reminders_enabled: f.get('actives') === 'on', reminder_days: etapes, reminder_email_from: email || null, reminder_signature: texte(f, 'signature').slice(0, 500) || null })
    .eq('id', organisation.id)
  if (error) return { erreur: 'Enregistrement impossible.' }
  revalidatePath(`/${slug}/relances`)
  return { ok: true, message: 'Scénario enregistré.' }
}

export async function partagerDocument(slug: string, documentId: string): Promise<{ ok: true; token: string } | { ok: false; erreur: string }> {
  await editeur(slug)
  const supabase = await creerClientServeur()
  const { data, error } = await supabase.rpc('lien_public', { p_id: documentId })
  if (error || !data) return { ok: false, erreur: 'Lien impossible à créer.' }
  revalidatePath(`/${slug}`, 'layout')
  return { ok: true, token: data }
}

// ---------------------------------------------------------------------------
// Récurrences
// ---------------------------------------------------------------------------

export async function creerRecurrence(slug: string, documentId: string, _: EtatSuivi, f: FormData): Promise<EtatSuivi> {
  const { organisation } = await editeur(slug)
  const { ligne, edition } = await chargerDocument(slug, documentId, ['facture'])
  if (!ligne.client_id) return { erreur: 'La facture n’a pas de client.' }
  const frequence = texte(f, 'frequence') as RecurrenceFrequency
  if (!FREQUENCES.some((x) => x.valeur === frequence)) return { erreur: 'Fréquence invalide.' }
  const debut = texte(f, 'debut')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(debut) || debut < aujourdHui()) return { erreur: 'La première échéance doit être aujourd’hui ou plus tard.' }
  const fin = texte(f, 'fin') || null
  if (fin && fin < debut) return { erreur: 'La date de fin précède la première échéance.' }
  const supabase = await creerClientServeur()
  const { error } = await supabase.from('recurring_invoices').insert({
    organization_id: organisation.id,
    client_id: ligne.client_id,
    name: (texte(f, 'nom') || edition.subject || `Facture récurrente`).slice(0, 120),
    frequency: frequence,
    next_date: debut,
    end_date: fin,
    mode: texte(f, 'mode') === 'emission' ? 'emission' : 'brouillon',
    template: { ...edition, id: '', internalNotes: '', originDocumentId: null, acomptes: [], jourAncre: Number(debut.slice(8, 10)) },
  })
  if (error) return { erreur: 'Création impossible.' }
  revalidatePath(`/${slug}/ventes/recurrences`)
  return { ok: true, message: 'Récurrence créée : retrouvez-la dans Ventes · Récurrences.' }
}

export async function basculerRecurrence(slug: string, id: string, active: boolean): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const { organisation } = await editeur(slug)
  const supabase = await creerClientServeur()
  const { error } = await supabase.from('recurring_invoices').update({ active }).eq('id', id).eq('organization_id', organisation.id)
  if (error) return { ok: false, erreur: 'Modification impossible.' }
  revalidatePath(`/${slug}/ventes/recurrences`)
  return { ok: true }
}

export async function supprimerRecurrence(slug: string, id: string): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const { organisation } = await editeur(slug)
  const supabase = await creerClientServeur()
  await supabase.from('recurring_invoices').delete().eq('id', id).eq('organization_id', organisation.id)
  revalidatePath(`/${slug}/ventes/recurrences`)
  return { ok: true }
}

export async function genererMaintenant(slug: string, _: EtatSuivi): Promise<EtatSuivi> {
  const { organisation } = await editeur(slug)
  const b = await executerRecurrences(await creerClientServeur(), organisation)
  // Aucune revalidation : les listes sont rendues à la demande, et le bandeau du tableau de bord
  // doit rester affiché avec le résultat.
  if (b.creees === 0) return { ok: true, message: 'Aucune facture récurrente à générer aujourd’hui.' }
  return {
    ok: true,
    message: `${b.creees} facture${b.creees > 1 ? 's' : ''} créée${b.creees > 1 ? 's' : ''}${b.emises ? `, ${b.emises} émise${b.emises > 1 ? 's' : ''}` : ''}${b.aVerifier ? `, ${b.aVerifier} en brouillon à vérifier` : ''}.`,
  }
}

/** Tableau des factures : marquer envoyée, ou payée (paiement du reste dû, par virement, aujourd'hui). */
export async function deplacerFacture(slug: string, id: string, cible: 'envoyee' | 'payee'): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const { organisation } = await editeur(slug)
  const supabase = await creerClientServeur()
  const { data: d } = await supabase.from('documents').select('status, amount_due, amount_paid, type').eq('id', id).eq('organization_id', organisation.id).maybeSingle()
  if (!d || (d.type !== 'facture' && d.type !== 'acompte')) return { ok: false, erreur: 'Facture introuvable.' }
  if (cible === 'envoyee') {
    if (d.status !== 'emis') return { ok: false, erreur: 'Seule une facture émise peut être marquée envoyée.' }
    const { error } = await supabase.rpc('changer_statut', { p_id: id, p_statut: 'envoye' })
    if (error) return { ok: false, erreur: 'Changement impossible.' }
  } else {
    const reste = Number(d.amount_due) - Number(d.amount_paid)
    if (!['emis', 'envoye', 'partiellement_paye'].includes(d.status) || reste <= 0) return { ok: false, erreur: 'Cette facture ne peut pas être soldée.' }
    const { error } = await supabase.from('payments').insert({ organization_id: organisation.id, document_id: id, amount_cents: reste, paid_on: aujourdHui(), method: 'virement', reference: 'Tableau des factures' })
    if (error) return { ok: false, erreur: 'Paiement impossible.' }
  }
  revalidatePath(`/${slug}/ventes/factures`)
  return { ok: true }
}
