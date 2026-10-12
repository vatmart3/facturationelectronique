'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { envoyerLienMagique, seConnecter, type EtatFormulaire } from '@/app/(auth)/actions'
import { Bouton } from '@/components/ui/Bouton'
import { Champ } from '@/components/ui/Champ'
import { Message } from '@/components/ui/Message'

type Mode = 'mot_de_passe' | 'lien'

export function FormulaireConnexion({ suite, desactive }: { suite: string; desactive?: boolean }) {
  const [mode, setMode] = useState<Mode>('mot_de_passe')
  const [etatMdp, actionMdp, enCoursMdp] = useActionState<EtatFormulaire, FormData>(seConnecter, {})
  const [etatLien, actionLien, enCoursLien] = useActionState<EtatFormulaire, FormData>(envoyerLienMagique, {})
  const etat = mode === 'mot_de_passe' ? etatMdp : etatLien

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Méthode de connexion" className="grid grid-cols-2 rounded-m border border-trait bg-surface-2 p-[3px]">
        {(
          [
            ['mot_de_passe', 'Mot de passe'],
            ['lien', 'Lien par email'],
          ] as const
        ).map(([valeur, libelle]) => (
          <button
            key={valeur}
            type="button"
            role="tab"
            aria-selected={mode === valeur}
            onClick={() => setMode(valeur)}
            className={
              mode === valeur
                ? 'h-8 rounded-s bg-surface text-[13px] font-semibold text-encre shadow-douce'
                : 'h-8 rounded-s text-[13px] font-medium text-encre-2 hover:text-encre'
            }
          >
            {libelle}
          </button>
        ))}
      </div>

      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}

      {mode === 'mot_de_passe' ? (
        <form action={actionMdp} className="flex flex-col gap-3.5" noValidate>
          <input type="hidden" name="suite" value={suite} />
          <Champ libelle="Email" name="email" type="email" autoComplete="email" required defaultValue={etatMdp.email} />
          <Champ
            libelle="Mot de passe"
            name="mot_de_passe"
            type="password"
            autoComplete="current-password"
            required
            aide={
              <Link href="/mot-de-passe" className="text-accent underline-offset-2 hover:underline">
                Mot de passe oublié
              </Link>
            }
          />
          <Bouton type="submit" variante="primaire" chargement={enCoursMdp} disabled={desactive} className="mt-1 h-[38px]">
            Se connecter
          </Bouton>
        </form>
      ) : (
        <form action={actionLien} className="flex flex-col gap-3.5" noValidate>
          <input type="hidden" name="suite" value={suite} />
          <Champ
            libelle="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={etatLien.email}
            aide="Vous recevrez un lien de connexion à usage unique."
          />
          <Bouton type="submit" variante="primaire" chargement={enCoursLien} disabled={desactive} className="mt-1 h-[38px]">
            Recevoir le lien
          </Bouton>
        </form>
      )}
    </div>
  )
}
