import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { FormulaireNouveauMotDePasse } from '@/components/auth/FormulairesMotDePasse'
import { lireUtilisateur } from '@/lib/session'
import { lireConfigSupabase } from '@/lib/supabase/env'

export const metadata: Metadata = { title: 'Nouveau mot de passe' }

export default async function NouveauMotDePasse() {
  await connection()
  if (!lireConfigSupabase()) redirect('/connexion')
  const utilisateur = await lireUtilisateur()
  if (!utilisateur) redirect('/connexion?erreur=lien')
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[26px] font-bold">Nouveau mot de passe</h1>
        <p className="text-encre-2">Pour le compte {utilisateur.email}.</p>
      </div>
      <FormulaireNouveauMotDePasse />
    </div>
  )
}
