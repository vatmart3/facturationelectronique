import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { listerOrganisations, lireUtilisateur } from '@/lib/session'
import { lireConfigSupabase } from '@/lib/supabase/env'

/** Aiguillage : connexion, création de la première entreprise ou tableau de bord. */
export default async function Accueil() {
  await connection()
  if (!lireConfigSupabase()) redirect('/connexion')
  const utilisateur = await lireUtilisateur()
  if (!utilisateur) redirect('/connexion')
  const organisations = await listerOrganisations()
  const premiere = organisations[0]
  redirect(premiere ? `/${premiere.slug}/tableau-de-bord` : '/bienvenue')
}
