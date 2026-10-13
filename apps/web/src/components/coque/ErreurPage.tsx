'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { Bouton, classesBouton } from '@/components/ui/Bouton'
import { Icone } from '@/components/ui/Icone'

/** Erreur inattendue : message clair, nouvel essai, retour, et référence pour le support. */
export function ErreurPage({ erreur, reessayer, retour = '/' }: { erreur: Error & { digest?: string }; reessayer: () => void; retour?: string }) {
  useEffect(() => {
    console.error(erreur)
  }, [erreur])
  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col items-center gap-4 rounded-xl border border-trait bg-surface px-6 py-10 text-center shadow-douce">
      <span className="grid size-12 place-items-center rounded-full bg-alerte-doux text-alerte" aria-hidden="true">
        <Icone nom="alerte" taille={22} />
      </span>
      <h1 className="text-[22px] font-bold">Cette page n’a pas pu s’afficher</h1>
      <p className="text-[14.5px] text-encre-2">
        Un problème passager, le plus souvent de connexion. Vos données ne sont pas touchées : réessayez, ou revenez à l’accueil.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Bouton variante="primaire" onClick={reessayer}>
          Réessayer
        </Bouton>
        <Link href={retour} className={classesBouton('secondaire')}>
          Revenir à l’accueil
        </Link>
      </div>
      {erreur.digest && <p className="text-[12px] text-encre-3">Référence : {erreur.digest}</p>}
    </div>
  )
}
