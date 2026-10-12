'use client'

import { useActionState } from 'react'
import { sInscrire, type EtatFormulaire } from '@/app/(auth)/actions'
import { Bouton } from '@/components/ui/Bouton'
import { Champ } from '@/components/ui/Champ'
import { Message } from '@/components/ui/Message'
import { RenvoyerConfirmation } from './RenvoyerConfirmation'

export function FormulaireInscription({ desactive, suite = '/bienvenue', email }: { desactive?: boolean; suite?: string; email?: string }) {
  const [etat, action, enCours] = useActionState<EtatFormulaire, FormData>(sInscrire, {})
  if (etat.aConfirmer && etat.email) {
    return (
      <div className="flex flex-col gap-3 rounded-l border border-trait bg-surface p-5">
        <h2 className="text-[17px] font-semibold">Vérifiez votre boîte mail</h2>
        <p className="text-[14px] text-encre-2">
          Votre compte est créé. Cliquez sur le lien envoyé à <strong className="text-encre">{etat.email}</strong> pour confirmer votre adresse : vous arriverez
          directement dans Pastille.
        </p>
        <RenvoyerConfirmation email={etat.email} suite={suite} />
      </div>
    )
  }
  return (
    <form action={action} className="flex flex-col gap-3.5" noValidate>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
      <Champ libelle="Nom et prénom" name="nom" autoComplete="name" required defaultValue={etat.nom} />
      <input type="hidden" name="suite" value={suite} />
      <Champ libelle="Email professionnel" name="email" type="email" autoComplete="email" required defaultValue={etat.email ?? email} />
      <Champ
        libelle="Mot de passe"
        name="mot_de_passe"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        aide="10 caractères minimum, avec au moins une lettre et un chiffre."
      />
      <Bouton type="submit" variante="primaire" chargement={enCours} disabled={desactive} className="mt-1 h-[38px]">
        Créer mon compte
      </Bouton>
    </form>
  )
}
