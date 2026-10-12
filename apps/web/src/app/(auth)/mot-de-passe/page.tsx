import type { Metadata } from 'next'
import Link from 'next/link'
import { AvertissementConfig } from '@/components/auth/AvertissementConfig'
import { FormulaireDemandeReinitialisation } from '@/components/auth/FormulairesMotDePasse'
import { lireConfigSupabase } from '@/lib/supabase/env'

export const metadata: Metadata = { title: 'Mot de passe oublié' }

export default function MotDePasseOublie() {
  const configure = lireConfigSupabase() !== null
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[26px] font-bold">Mot de passe oublié</h1>
        <p className="text-encre-2">Nous vous envoyons un lien pour en choisir un nouveau.</p>
      </div>
      {!configure && <AvertissementConfig />}
      <FormulaireDemandeReinitialisation desactive={!configure} />
      <Link href="/connexion" className="text-[13.5px] font-medium text-accent underline-offset-2 hover:underline">
        Retour à la connexion
      </Link>
    </div>
  )
}
