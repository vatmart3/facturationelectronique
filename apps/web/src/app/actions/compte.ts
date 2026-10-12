'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { envoyerEmail } from '@/lib/email'
import { offre, type CodeOffre } from '@/lib/offres'
import { LIBELLES_ROLE, estRole, peutGererMembres } from '@/lib/roles'
import { chargerContexte, exigerUtilisateur } from '@/lib/session'
import { origineSite } from '@/lib/site'
import { sessionAbonnement, sessionPortail, stripeConfigure } from '@/lib/stripe'
import { creerClientServeur } from '@/lib/supabase/serveur'
import type { EtatSuivi } from './suivi'

/** Choix d'une offre : session de paiement Stripe (abonnement mensuel). */
export async function choisirOffre(slug: string, plan: CodeOffre): Promise<{ ok: false; erreur: string } | void> {
  const { organisation, roleReel, utilisateur } = await chargerContexte(slug)
  if (roleReel !== 'owner' && roleReel !== 'admin') return { ok: false, erreur: 'Réservé au propriétaire ou à un administrateur.' }
  if (!stripeConfigure()) return { ok: false, erreur: 'Le paiement en ligne n’est pas encore configuré sur cette installation (variables STRIPE_*).' }
  const supabase = await creerClientServeur()
  const { data: sub } = await supabase.from('subscriptions').select('stripe_customer_id').eq('organization_id', organisation.id).maybeSingle()
  const url = await sessionAbonnement({
    organisationId: organisation.id,
    plan,
    email: utilisateur.email,
    client: sub?.stripe_customer_id ?? null,
    retour: `${await origineSite()}/${slug}/reglages/abonnement`,
  })
  redirect(url)
}

export async function gererAbonnement(slug: string): Promise<{ ok: false; erreur: string } | void> {
  const { organisation, roleReel } = await chargerContexte(slug)
  if (roleReel !== 'owner' && roleReel !== 'admin') return { ok: false, erreur: 'Réservé au propriétaire ou à un administrateur.' }
  const supabase = await creerClientServeur()
  const { data: sub } = await supabase.from('subscriptions').select('stripe_customer_id').eq('organization_id', organisation.id).maybeSingle()
  if (!sub?.stripe_customer_id || !process.env.STRIPE_SECRET_KEY) return { ok: false, erreur: 'Aucun abonnement payant à gérer.' }
  redirect(await sessionPortail(sub.stripe_customer_id, `${await origineSite()}/${slug}/reglages/abonnement`))
}

export async function inviterMembre(slug: string, _: EtatSuivi, f: FormData): Promise<EtatSuivi> {
  const { organisation, roleReel, abonnement, utilisateur } = await chargerContexte(slug)
  if (!peutGererMembres(roleReel)) return { erreur: 'Réservé aux propriétaires et administrateurs.' }
  const email = String(f.get('email') ?? '').trim().toLowerCase()
  const role = String(f.get('role') ?? '')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { erreur: 'Adresse email invalide.' }
  if (!estRole(role) || role === 'owner') return { erreur: 'Rôle invalide.' }
  const supabase = await creerClientServeur()
  const [{ count: membres }, { count: attente }] = await Promise.all([
    supabase.from('memberships').select('user_id', { count: 'exact', head: true }).eq('organization_id', organisation.id),
    supabase.from('invitations').select('id', { count: 'exact', head: true }).eq('organization_id', organisation.id).is('accepted_at', null),
  ])
  const limite = offre(abonnement.plan).utilisateurs
  if ((membres ?? 0) + (attente ?? 0) >= limite) return { erreur: `L’offre ${offre(abonnement.plan).nom} est limitée à ${limite} utilisateur${limite > 1 ? 's' : ''}.` }
  const { data, error } = await supabase.from('invitations').insert({ organization_id: organisation.id, email, role }).select('token').single()
  if (error || !data) return { erreur: error?.message.includes('duplicate') ? 'Une invitation est déjà en attente pour cette adresse.' : 'Invitation impossible.' }
  const lien = `${await origineSite()}/invitation/${data.token}`
  const texte = [
    'Bonjour,',
    `${utilisateur.nom ?? utilisateur.email} vous invite à rejoindre ${organisation.name} sur Pastille, avec le rôle « ${LIBELLES_ROLE[role]} ».`,
    `Rejoindre : ${lien}`,
    'Ce lien est valable 7 jours.',
  ].join('\n\n')
  const r = await envoyerEmail(email, {
    sujet: `Invitation à rejoindre ${organisation.name} sur Pastille`,
    texte,
    html: `<p>Bonjour,</p><p>${(utilisateur.nom ?? utilisateur.email).replace(/</g, '&lt;')} vous invite à rejoindre <strong>${organisation.name.replace(/</g, '&lt;')}</strong> sur Pastille, avec le rôle « ${LIBELLES_ROLE[role]} ».</p><p><a href="${lien}">Rejoindre ${organisation.name.replace(/</g, '&lt;')}</a></p><p style="color:#6b7280">Ce lien est valable 7 jours.</p>`,
  })
  revalidatePath(`/${slug}/reglages/membres`)
  return { ok: true, message: r.statut === 'simule' ? `Invitation créée. Messagerie non configurée : transmettez ce lien à ${email} : ${lien}` : `Invitation envoyée à ${email}.` }
}

export async function annulerInvitation(slug: string, id: string): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const { organisation, roleReel } = await chargerContexte(slug)
  if (!peutGererMembres(roleReel)) return { ok: false, erreur: 'Action non autorisée.' }
  const supabase = await creerClientServeur()
  await supabase.from('invitations').delete().eq('id', id).eq('organization_id', organisation.id)
  revalidatePath(`/${slug}/reglages/membres`)
  return { ok: true }
}

export async function accepterInvitation(token: string): Promise<{ ok: false; erreur: string } | void> {
  await exigerUtilisateur()
  const supabase = await creerClientServeur()
  const { data, error } = await supabase.rpc('accepter_invitation', { p_token: token })
  if (error || !data) return { ok: false, erreur: error?.message ?? 'Invitation impossible à accepter.' }
  redirect(`/${data}/tableau-de-bord`)
}
