'use client'

import { useActionState } from 'react'
import { sInscrire, type EtatFormulaire } from '@/app/(auth)/actions'
import { Bouton } from '@/components/ui/Bouton'
import { Champ } from '@/components/ui/Champ'
import { Message } from '@/components/ui/Message'

export function FormulaireInscription({ desactive }: { desactive?: boolean }) {
  const [etat, action, enCours] = useActionState<EtatFormulaire, FormData>(sInscrire, {})
  return (
    <form action={action} className="flex flex-col gap-3.5" noValidate>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
      <Champ libelle="Nom et prénom" name="nom" autoComplete="name" required />
      <Champ libelle="Email professionnel" name="email" type="email" autoComplete="email" required defaultValue={etat.email} />
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
