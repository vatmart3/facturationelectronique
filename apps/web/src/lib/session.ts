import 'server-only'
import { notFound, redirect } from 'next/navigation'
import { connection } from 'next/server'
import { cache } from 'react'
import { etatAbonnement, type EtatAbonnement } from './offres'
import { estRole, type Role } from './roles'
import { lireConfigSupabase } from './supabase/env'
import { creerClientServeur } from './supabase/serveur'
import type { OrganizationRow } from './supabase/types'

export interface Utilisateur {
  id: string
  email: string
  nom: string | null
}

export interface OrganisationResumee {
  id: string
  slug: string
  nom: string
  role: Role
}

export interface ContexteOrganisation {
  utilisateur: Utilisateur
  organisation: OrganizationRow
  /** Rôle effectif : lecture seule pour tous tant que l'abonnement n'est pas actif (paywall doux). */
  role: Role
  /** Rôle réel du membre (gestion de l'abonnement, des membres). */
  roleReel: Role
  abonnement: EtatAbonnement
  organisations: OrganisationResumee[]
}

/**
 * Identité de la session : jeton vérifié par signature (getClaims), sans appel réseau à
 * Supabase Auth quand le projet utilise des clés de signature asymétriques. Mis en cache par requête.
 */
const lireIdentite = cache(async (): Promise<{ id: string; email: string } | null> => {
  if (!lireConfigSupabase()) {
    await connection()
    return null
  }
  const supabase = await creerClientServeur()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims?.sub) return null
  return { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : '' }
})

/** Utilisateur connecté, ou null. Mis en cache par requête. */
export const lireUtilisateur = cache(async (): Promise<Utilisateur | null> => {
  const identite = await lireIdentite()
  if (!identite) return null
  const supabase = await creerClientServeur()
  const { data: profil } = await supabase.from('profiles').select('full_name').eq('id', identite.id).maybeSingle()
  return { ...identite, nom: profil?.full_name ?? null }
})

export async function exigerUtilisateur(): Promise<Utilisateur> {
  const utilisateur = await lireUtilisateur()
  if (!utilisateur) redirect('/connexion')
  return utilisateur
}

/** Organisations dont l'utilisateur est membre, triées par nom. */
export const listerOrganisations = cache(async (): Promise<OrganisationResumee[]> => {
  const utilisateur = await lireIdentite()
  if (!utilisateur) redirect('/connexion')
  const supabase = await creerClientServeur()
  const { data, error } = await supabase
    .from('memberships')
    .select('role, organizations(id, slug, name)')
    .eq('user_id', utilisateur.id)
  if (error) throw new Error(`Lecture des organisations impossible : ${error.message}`)
  return (data ?? [])
    .flatMap((m) => {
      const org = m.organizations
      if (!org || !estRole(m.role)) return []
      return [{ id: org.id, slug: org.slug, nom: org.name, role: m.role }]
    })
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
})

/** Charge l'organisation de l'URL et le rôle de l'utilisateur ; 404 si non membre. */
export const chargerContexte = cache(async (slug: string): Promise<ContexteOrganisation> => {
  // Profil et appartenances lus en parallèle (même identité, déjà vérifiée).
  const [utilisateur, organisations] = await Promise.all([exigerUtilisateur(), listerOrganisations()])
  const resume = organisations.find((o) => o.slug === slug)
  if (!resume) notFound()

  const supabase = await creerClientServeur()
  const [{ data: organisation, error }, { data: sub }] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', resume.id).single(),
    supabase.from('subscriptions').select('plan, status, trial_ends_at, current_period_end, cancel_at_period_end').eq('organization_id', resume.id).maybeSingle(),
  ])
  if (error || !organisation) notFound()
  const abonnement = etatAbonnement(sub)
  const role: Role = abonnement.actif || resume.role === 'viewer' || resume.role === 'accountant' ? resume.role : 'viewer'

  return { utilisateur, organisation, role, roleReel: resume.role, abonnement, organisations }
})
