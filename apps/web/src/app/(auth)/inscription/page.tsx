import type { Metadata } from 'next'
import Link from 'next/link'
import { AvertissementConfig } from '@/components/auth/AvertissementConfig'
import { BoutonGoogle } from '@/components/auth/BoutonGoogle'
import { FormulaireInscription } from '@/components/auth/FormulaireInscription'
import { Separateur } from '@/components/auth/Separateur'
import { suiteSure } from '@/lib/auth'
import { lireConfigSupabase } from '@/lib/supabase/env'
import { lireReglagesAuth } from '@/lib/supabase/reglages-auth'

export const metadata: Metadata = { title: 'Créer un compte' }

export default async function Inscription({ searchParams }: { searchParams: Promise<{ suite?: string; email?: string }> }) {
  const { suite: demandee, email } = await searchParams
  const suite = demandee ? suiteSure(demandee) : '/bienvenue'
  const configure = lireConfigSupabase() !== null
  // Sans réponse du service, on garde le bouton : mieux vaut un essai qu'une option invisible.
  const google = configure && ((await lireReglagesAuth())?.google ?? true)
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[26px] font-bold">Créer un compte</h1>
        <p className="text-encre-2">
          Déjà inscrit ?{' '}
          <Link href={suite === '/bienvenue' ? '/connexion' : `/connexion?suite=${encodeURIComponent(suite)}`} className="font-medium text-accent underline-offset-2 hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
      {!configure && <AvertissementConfig />}
      {google && (
        <>
          <BoutonGoogle suite={suite} />
          <Separateur />
        </>
      )}
      <FormulaireInscription desactive={!configure} suite={suite} email={email} />
      <p className="text-[12.5px] text-encre-3">
        En créant un compte, vous acceptez les{' '}
        <Link href="/legal/cgu" className="underline">
          conditions générales d’utilisation
        </Link>{' '}
        et la{' '}
        <Link href="/legal/confidentialite" className="underline">
          politique de confidentialité
        </Link>
        .
      </p>
    </div>
  )
}
