'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Icone } from '@/components/ui/Icone'
import { Kbd } from '@/components/ui/Message'
import { cn } from '@/lib/cn'
import { construireEntrees, filtrerEntrees, type EntreePalette } from '@/lib/palette'

interface PaletteProps {
  fermer: () => void
  slug: string
  organisations: Array<{ slug: string; nom: string }>
}

/** Monté uniquement quand la palette est ouverte : chaque ouverture repart d'une recherche vide. */
export function Palette({ fermer, slug, organisations }: PaletteProps) {
  const router = useRouter()
  const idListe = useId()
  const champ = useRef<HTMLInputElement>(null)
  const [requete, setRequete] = useState('')
  const [actif, setActif] = useState(0)

  const entrees = useMemo(() => construireEntrees(slug, organisations), [slug, organisations])
  const resultats = useMemo(() => filtrerEntrees(entrees, requete).slice(0, 10), [entrees, requete])
  const indexActif = Math.min(actif, Math.max(resultats.length - 1, 0))

  useEffect(() => {
    const focusPrecedent = document.activeElement as HTMLElement | null
    champ.current?.focus()
    return () => focusPrecedent?.focus()
  }, [])

  function lancer(entree: EntreePalette | undefined) {
    if (!entree) return
    fermer()
    router.push(entree.href)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-voile px-4 pt-[14vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) fermer()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Rechercher et naviguer" className="w-full max-w-[560px] overflow-hidden rounded-xl border border-trait bg-surface shadow-haute">
        <div className="flex h-[52px] items-center gap-2.5 border-b border-trait px-4">
          <Icone nom="recherche" taille={17} className="text-encre-3" />
          <input
            ref={champ}
            value={requete}
            onChange={(e) => {
              setRequete(e.target.value)
              setActif(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActif((indexActif + 1) % Math.max(resultats.length, 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActif((indexActif - 1 + resultats.length) % Math.max(resultats.length, 1))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                lancer(resultats[indexActif])
              } else if (e.key === 'Escape') {
                e.preventDefault()
                fermer()
              }
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls={idListe}
            aria-activedescendant={resultats[indexActif] ? `${idListe}-${indexActif}` : undefined}
            aria-label="Rechercher une page ou une action"
            placeholder="Aller à, changer d’entreprise…"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-encre outline-none placeholder:text-encre-3"
          />
          <Kbd>Échap</Kbd>
        </div>
        <ul id={idListe} role="listbox" className="m-0 max-h-[340px] list-none overflow-auto p-1.5">
          {resultats.length === 0 && <li className="px-3 py-3 text-[13.5px] text-encre-3">Aucun résultat.</li>}
          {resultats.map((r, i) => (
            <li
              key={r.id}
              id={`${idListe}-${i}`}
              role="option"
              aria-selected={i === indexActif}
              onMouseMove={() => setActif(i)}
              onClick={() => lancer(r)}
              className={cn(
                'flex cursor-pointer items-center gap-2.5 rounded-m px-2.5 py-2 text-[13.5px]',
                i === indexActif && 'bg-survol',
              )}
            >
              {r.avatar && <Avatar nom={r.avatar} taille="s" />}
              <span className="min-w-0 flex-1 truncate">{r.libelle}</span>
              <span className="shrink-0 text-[12px] text-encre-3">{r.type}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
