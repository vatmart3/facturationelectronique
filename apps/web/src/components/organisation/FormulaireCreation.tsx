'use client'

import { useActionState, useState } from 'react'
import { creerOrganisation, type EtatCreation } from '@/app/actions/organisation'
import { RechercheEntreprise } from '@/components/clients/RechercheEntreprise'
import { Bouton } from '@/components/ui/Bouton'
import { Champ } from '@/components/ui/Champ'
import { Message } from '@/components/ui/Message'
import type { EntrepriseTrouvee } from '@/lib/entreprises'
import { grouperChiffres } from '@/lib/format'

export function FormulaireCreation() {
  const [etat, action, enCours] = useActionState<EtatCreation, FormData>(creerOrganisation, {})
  const [choix, setChoix] = useState<EntrepriseTrouvee>()
  const [nom, setNom] = useState(etat.nom ?? '')

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      <RechercheEntreprise
        libelle="Votre entreprise"
        onChoix={(e) => {
          setChoix(e)
          setNom(e.nom)
        }}
      />
      {choix && (
        <div className="rounded-m border border-trait bg-surface-2 p-3 text-[13px]">
          <p className="font-medium">{choix.nom}</p>
          <p className="text-encre-3">
            SIREN <span className="num">{grouperChiffres(choix.siren)}</span>
            {[choix.formeJuridique, [choix.adresse, choix.codePostal, choix.ville].filter(Boolean).join(' ')].filter(Boolean).map((x) => ` · ${x}`)}
          </p>
          <input type="hidden" name="siren" value={choix.siren} />
          <input type="hidden" name="siret" value={choix.siret ?? ''} />
          <input type="hidden" name="legal_form" value={choix.formeJuridique ?? ''} />
          <input type="hidden" name="naf_code" value={choix.codeNaf ?? ''} />
          <input type="hidden" name="address_line1" value={choix.adresse ?? ''} />
          <input type="hidden" name="postal_code" value={choix.codePostal ?? ''} />
          <input type="hidden" name="city" value={choix.ville ?? ''} />
        </div>
      )}
      <Champ
        libelle="Nom affiché"
        name="nom"
        required
        maxLength={200}
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        autoComplete="organization"
        aide="Rempli par la recherche, ou saisi à la main si votre entreprise n’est pas encore immatriculée."
      />
      <Bouton type="submit" variante="primaire" chargement={enCours} className="mt-1 h-[38px]">
        Continuer
      </Bouton>
    </form>
  )
}
