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

/** Utilisateur connecté (validé auprès de Supabase Auth), ou null. Mis en cache par requête. */
export const lireUtilisateur = cache(async (): Promise<Utilisateur | null> => {
  if (!lireConfigSupabase()) {
    await connection()
    return null
  }
  const supabase = await creerClientServeur()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profil } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
  return { id: user.id, email: user.email ?? '', nom: profil?.full_name ?? null }
})

export async function exigerUtilisateur(): Promise<Utilisateur> {
  const utilisateur = await lireUtilisateur()
  if (!utilisateur) redirect('/connexion')
  return utilisateur
}

/** Organisations dont l'utilisateur est membre, triées par nom. */
export const listerOrganisations = cache(async (): Promise<OrganisationResumee[]> => {
  const utilisateur = await exigerUtilisateur()
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
  const utilisateur = await exigerUtilisateur()
  const organisations = await listerOrganisations()
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
