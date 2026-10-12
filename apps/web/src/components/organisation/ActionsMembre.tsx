'use client'

import { useActionState, useState, useTransition } from 'react'
import { changerRole, retirerMembre, type EtatMembre } from '@/app/actions/organisation'
import { Bouton } from '@/components/ui/Bouton'
import { Icone } from '@/components/ui/Icone'
import { LIBELLES_ROLE, type Role } from '@/lib/roles'

export function SelecteurRole({ slug, userId, role, roles, nom }: { slug: string; userId: string; role: Role; roles: Role[]; nom: string }) {
  const [etat, action, enCours] = useActionState<EtatMembre, FormData>(changerRole.bind(null, slug, userId), {})
  return (
    <form action={action} className="flex flex-col gap-1">
      <div className="relative w-max">
        <select
          name="role"
          defaultValue={role}
          aria-label={`Rôle de ${nom}`}
          disabled={enCours}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="h-[30px] appearance-none rounded-m border border-trait-fort bg-surface pl-2.5 pr-8 text-[13px] text-encre"
        >
          {roles.map((r) => (
            <option key={r} value={r}>
              {LIBELLES_ROLE[r]}
            </option>
          ))}
        </select>
        <Icone nom="chevrons" taille={13} className="pointer-events-none absolute right-2.5 top-[8px] text-encre-3" />
      </div>
      {etat.erreur && (
        <p role="alert" className="text-[12px] text-alerte">
          {etat.erreur}
        </p>
      )}
    </form>
  )
}

export function BoutonRetirer({ slug, userId, soiMeme, nom }: { slug: string; userId: string; soiMeme: boolean; nom: string }) {
  const [confirmation, setConfirmation] = useState(false)
  const [erreur, setErreur] = useState<string>()
  const [enCours, demarrer] = useTransition()

  if (!confirmation) {
    return (
      <Bouton variante="fantome" taille="s" onClick={() => setConfirmation(true)}>
        {soiMeme ? 'Quitter' : 'Retirer'}
      </Bouton>
    )
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1.5">
        <Bouton variante="fantome" taille="s" onClick={() => setConfirmation(false)} disabled={enCours}>
          Annuler
        </Bouton>
        <Bouton
          variante="danger"
          taille="s"
          chargement={enCours}
          aria-label={soiMeme ? 'Confirmer : quitter l’entreprise' : `Confirmer le retrait de ${nom}`}
          onClick={() =>
            demarrer(async () => {
              const resultat = await retirerMembre(slug, userId)
              if (resultat.erreur) setErreur(resultat.erreur)
            })
          }
        >
          {soiMeme ? 'Confirmer le départ' : 'Confirmer le retrait'}
        </Bouton>
      </div>
      {erreur && (
        <p role="alert" className="max-w-[260px] text-right text-[12px] text-alerte">
          {erreur}
        </p>
      )}
    </div>
  )
}
