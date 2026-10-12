'use client'

import { useActionState } from 'react'
import { changerMotDePasse, demanderReinitialisation, type EtatFormulaire } from '@/app/(auth)/actions'
import { Bouton } from '@/components/ui/Bouton'
import { Champ } from '@/components/ui/Champ'
import { Message } from '@/components/ui/Message'

export function FormulaireDemandeReinitialisation({ desactive }: { desactive?: boolean }) {
  const [etat, action, enCours] = useActionState<EtatFormulaire, FormData>(demanderReinitialisation, {})
  return (
    <form action={action} className="flex flex-col gap-3.5" noValidate>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
      <Champ libelle="Email" name="email" type="email" autoComplete="email" required defaultValue={etat.email} />
      <Bouton type="submit" variante="primaire" chargement={enCours} disabled={desactive} className="mt-1 h-[38px]">
        Envoyer le lien
      </Bouton>
    </form>
  )
}

export function FormulaireNouveauMotDePasse() {
  const [etat, action, enCours] = useActionState<EtatFormulaire, FormData>(changerMotDePasse, {})
  return (
    <form action={action} className="flex flex-col gap-3.5" noValidate>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      <Champ
        libelle="Nouveau mot de passe"
        name="mot_de_passe"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        aide="10 caractères minimum, avec au moins une lettre et un chiffre."
      />
      <Bouton type="submit" variante="primaire" chargement={enCours} className="mt-1 h-[38px]">
        Enregistrer
      </Bouton>
    </form>
  )
}
