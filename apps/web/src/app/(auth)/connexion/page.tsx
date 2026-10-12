import type { Metadata } from 'next'
import Link from 'next/link'
import { AvertissementConfig } from '@/components/auth/AvertissementConfig'
import { FormulaireConnexion } from '@/components/auth/FormulaireConnexion'
import { Message } from '@/components/ui/Message'
import { suiteSure } from '@/lib/auth'
import { lireConfigSupabase } from '@/lib/supabase/env'

export const metadata: Metadata = { title: 'Connexion' }

const ERREURS: Record<string, string> = {
  lien: 'Ce lien n’est plus valide, ou il a été ouvert dans un autre navigateur. Si vous venez de confirmer votre adresse, connectez-vous simplement ci-dessous.',
}

export default async function Connexion({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams
  const suite = suiteSure(params.suite)
  const configure = lireConfigSupabase() !== null
  const erreur = params.erreur ? ERREURS[params.erreur] : undefined

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[26px] font-bold">Connexion</h1>
        <p className="text-encre-2">
          Pas encore de compte ?{' '}
          <Link href="/inscription" className="font-medium text-accent underline-offset-2 hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
      {!configure && <AvertissementConfig />}
      {erreur && <Message ton="erreur">{erreur}</Message>}
      <FormulaireConnexion suite={suite} desactive={!configure} />
    </div>
  )
}
