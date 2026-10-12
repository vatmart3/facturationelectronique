import type { Metadata } from 'next'
import Link from 'next/link'
import { AvertissementConfig } from '@/components/auth/AvertissementConfig'
import { BoutonGoogle } from '@/components/auth/BoutonGoogle'
import { FormulaireInscription } from '@/components/auth/FormulaireInscription'
import { Separateur } from '@/components/auth/Separateur'
import { lireConfigSupabase } from '@/lib/supabase/env'

export const metadata: Metadata = { title: 'Créer un compte' }

export default function Inscription() {
  const configure = lireConfigSupabase() !== null
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[26px] font-bold">Créer un compte</h1>
        <p className="text-encre-2">
          Déjà inscrit ?{' '}
          <Link href="/connexion" className="font-medium text-accent underline-offset-2 hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
      {!configure && <AvertissementConfig />}
      <BoutonGoogle suite="/bienvenue" desactive={!configure} />
      <Separateur />
      <FormulaireInscription desactive={!configure} />
      <p className="text-[12.5px] text-encre-3">
        En créant un compte, vous acceptez les conditions générales d’utilisation et la politique de confidentialité.
      </p>
    </div>
  )
}
