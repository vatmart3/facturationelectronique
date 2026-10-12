'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Icone } from '@/components/ui/Icone'
import { cn } from '@/lib/cn'
import type { EntrepriseTrouvee } from '@/lib/entreprises'
import { grouperChiffres } from '@/lib/format'

/** Champ de recherche par nom ou SIREN ; un clic remplit la fiche. */
export function RechercheEntreprise({ onChoix, libelle = 'Rechercher l’entreprise' }: { onChoix: (e: EntrepriseTrouvee) => void; libelle?: string }) {
  const id = useId()
  const [q, setQ] = useState('')
  const [resultats, setResultats] = useState<EntrepriseTrouvee[]>([])
  const [etat, setEtat] = useState<'repos' | 'charge' | 'erreur'>('repos')
  const [message, setMessage] = useState('')
  const [actif, setActif] = useState(0)
  const dernier = useRef('')

  useEffect(() => {
    const requete = q.trim()
    if (requete.replace(/\s/g, '').length < 3) return
    const minuterie = setTimeout(async () => {
      dernier.current = requete
      setEtat('charge')
      try {
        const r = await fetch(`/api/entreprises?q=${encodeURIComponent(requete)}`)
        const json = (await r.json()) as { resultats: EntrepriseTrouvee[]; erreur?: string }
        if (dernier.current !== requete) return
        setResultats(json.resultats)
        setActif(0)
        setMessage(json.erreur ?? (json.resultats.length ? '' : 'Aucune entreprise trouvée.'))
        setEtat(json.erreur ? 'erreur' : 'repos')
      } catch {
        setEtat('erreur')
        setMessage('Recherche impossible. Saisissez les informations à la main.')
      }
    }, 300)
    return () => clearTimeout(minuterie)
  }, [q])

  const visibles = q.trim().replace(/\s/g, '').length >= 3 ? resultats : []

  function choisir(e: EntrepriseTrouvee | undefined) {
    if (!e) return
    onChoix(e)
    setQ('')
    setResultats([])
  }

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium">
        {libelle}
      </label>
      <div className="flex h-[38px] items-center gap-2 rounded-m border border-trait-fort bg-surface px-3 focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-doux)]">
        <Icone nom="recherche" taille={15} className="text-encre-3" />
        <input
          id={id}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (!visibles.length) return
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActif((actif + 1) % visibles.length)
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActif((actif - 1 + visibles.length) % visibles.length)
            } else if (e.key === 'Enter') {
              e.preventDefault()
              choisir(visibles[actif])
            }
          }}
          role="combobox"
          aria-expanded={visibles.length > 0}
          aria-controls={`${id}-liste`}
          aria-activedescendant={visibles.length ? `${id}-${actif}` : undefined}
          autoComplete="off"
          placeholder="Nom de l’entreprise ou SIREN"
          className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-encre-3"
        />
        {etat === 'charge' && <span className="size-3.5 animate-spin rounded-full border-2 border-encre-3 border-t-transparent" aria-hidden="true" />}
      </div>
      <p className="text-[12.5px] text-encre-3" aria-live="polite">
        {message || 'Données publiques de l’INSEE : raison sociale, SIREN, adresse et forme juridique.'}
      </p>
      {visibles.length > 0 && (
        <ul
          id={`${id}-liste`}
          role="listbox"
          className="absolute inset-x-0 top-[66px] z-30 m-0 flex max-h-72 list-none flex-col overflow-auto rounded-l border border-trait bg-surface p-1.5 shadow-haute"
        >
          {visibles.map((e, i) => (
            <li
              key={e.siren}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === actif}
              onMouseMove={() => setActif(i)}
              onMouseDown={(ev) => {
                ev.preventDefault()
                choisir(e)
              }}
              className={cn('flex cursor-pointer flex-col rounded-m px-2.5 py-2', i === actif && 'bg-survol')}
            >
              <span className="flex items-center gap-2 font-medium">
                {e.nom}
                {!e.active && <span className="text-[11.5px] font-normal text-alerte">fermée</span>}
              </span>
              <span className="text-[12px] text-encre-3">
                <span className="num">{grouperChiffres(e.siren)}</span>
                {[e.formeJuridique, [e.codePostal, e.ville].filter(Boolean).join(' ')].filter(Boolean).map((x) => ` · ${x}`)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
