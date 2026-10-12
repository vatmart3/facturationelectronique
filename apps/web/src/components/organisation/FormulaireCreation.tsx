'use client'

import { useActionState } from 'react'
import { creerOrganisation, type EtatCreation } from '@/app/actions/organisation'
import { Bouton } from '@/components/ui/Bouton'
import { Champ } from '@/components/ui/Champ'
import { Message } from '@/components/ui/Message'

export function FormulaireCreation() {
  const [etat, action, enCours] = useActionState<EtatCreation, FormData>(creerOrganisation, {})
  return (
    <form action={action} className="flex flex-col gap-3.5" noValidate>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      <Champ
        libelle="Nom de l’entreprise"
        name="nom"
        required
        maxLength={200}
        defaultValue={etat.nom}
        autoComplete="organization"
        icone="entreprise"
        aide="Raison sociale ou nom commercial. Le SIREN et l’adresse se complètent à l’étape suivante."
      />
      <Bouton type="submit" variante="primaire" chargement={enCours} className="mt-1 h-[38px]">
        Créer l’entreprise
      </Bouton>
    </form>
  )
}
