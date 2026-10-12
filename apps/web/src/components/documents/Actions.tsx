'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useState, useTransition } from 'react'
import type { ResultatAction } from '@/app/actions/documents'
import { Bouton, type VarianteBouton } from '@/components/ui/Bouton'
import { Message } from '@/components/ui/Message'

/** Bouton qui déclenche une action serveur liée et affiche son éventuelle erreur. */
export function BoutonAction({
  action,
  children,
  variante = 'secondaire',
  confirmation,
  className,
}: {
  action: () => Promise<ResultatAction | { ok: true } | { ok: false; erreur: string }>
  children: string
  variante?: VarianteBouton
  confirmation?: string
  className?: string
}) {
  const router = useRouter()
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, demarrer] = useTransition()
  return (
    <div className="flex flex-col gap-1.5">
      <Bouton
        variante={variante}
        className={className}
        chargement={enCours}
        onClick={() => {
          if (confirmation && !window.confirm(confirmation)) return
          demarrer(async () => {
            const r = await action()
            if (r.ok) {
              setErreur(null)
              router.refresh()
            } else setErreur(r.erreur)
          })
        }}
      >
        {children}
      </Bouton>
      {erreur && <Message ton="erreur">{erreur}</Message>}
    </div>
  )
}

/** Facture d'acompte : pourcentage du devis. */
export function FormulaireAcompte({ action }: { action: (etat: ResultatAction | null, formData: FormData) => Promise<ResultatAction> }) {
  const [etat, envoyer, enCours] = useActionState(action, null)
  return (
    <form action={envoyer} className="flex flex-col gap-1.5">
      <div className="flex items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-[12.5px] font-medium text-encre-2">
          Acompte
          <span className="flex h-[34px] items-center gap-1 rounded-m border border-trait-fort bg-surface px-2.5 focus-within:border-accent">
            <input name="pourcentage" defaultValue="30" inputMode="decimal" className="num w-full bg-transparent outline-none" aria-label="Pourcentage d’acompte" />
            <span className="text-encre-3">%</span>
          </span>
        </label>
        <Bouton type="submit" chargement={enCours}>
          Facturer l’acompte
        </Bouton>
      </div>
      {etat && !etat.ok && <Message ton="erreur">{etat.erreur}</Message>}
    </form>
  )
}

/** Petit bouton de suppression d'un paiement, avec confirmation. */
export function BoutonSupprimerPaiement({ action }: { action: () => Promise<{ ok: true } | { ok: false; erreur: string }> }) {
  const router = useRouter()
  const [enCours, demarrer] = useTransition()
  return (
    <button
      type="button"
      disabled={enCours}
      aria-label="Supprimer ce paiement"
      title="Supprimer ce paiement"
      onClick={() => {
        if (!window.confirm('Supprimer ce paiement ?')) return
        demarrer(async () => {
          const r = await action()
          if (r.ok) router.refresh()
          else window.alert(r.erreur)
        })
      }}
      className="grid size-6 place-items-center rounded-s text-encre-3 hover:bg-alerte-doux hover:text-alerte disabled:opacity-40"
    >
      ×
    </button>
  )
}
