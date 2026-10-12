'use client'

import { useActionState } from 'react'
import { renvoyerConfirmation, type EtatFormulaire } from '@/app/(auth)/actions'
import { Bouton } from '@/components/ui/Bouton'

/** Renvoie l'email de confirmation d'inscription (email non reçu, ou lien expiré). */
export function RenvoyerConfirmation({ email, suite }: { email: string; suite?: string }) {
  const [etat, action, enCours] = useActionState<EtatFormulaire, FormData>(renvoyerConfirmation, {})
  return (
    <form action={action} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <input type="hidden" name="email" value={email} />
      {suite && <input type="hidden" name="suite" value={suite} />}
      <Bouton type="submit" variante="secondaire" taille="s" chargement={enCours}>
        Renvoyer l’email de confirmation
      </Bouton>
      {(etat.succes || etat.erreur) && (
        <span role="status" className={etat.erreur ? 'text-[12.5px] text-alerte' : 'text-[12.5px] text-ok'}>
          {etat.succes ?? etat.erreur}
        </span>
      )}
    </form>
  )
}
