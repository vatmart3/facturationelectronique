'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Kbd } from '@/components/ui/Message'

/** Bulle d'aide : raccourcis, tutoriels courts, réforme, contact. */
export function BulleAide({ slug }: { slug: string }) {
  const [ouvert, setOuvert] = useState(false)
  const zone = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ouvert) return
    const clic = (e: MouseEvent) => !zone.current?.contains(e.target as Node) && setOuvert(false)
    const touche = (e: KeyboardEvent) => e.key === 'Escape' && setOuvert(false)
    document.addEventListener('mousedown', clic)
    document.addEventListener('keydown', touche)
    return () => {
      document.removeEventListener('mousedown', clic)
      document.removeEventListener('keydown', touche)
    }
  }, [ouvert])
  return (
    <div ref={zone} className="fixed bottom-4 left-4 z-30 print:hidden">
      {ouvert && (
        <div role="dialog" aria-label="Aide" className="mb-2 flex w-[290px] flex-col gap-3 rounded-l border border-trait bg-surface p-4 text-[13px] shadow-haute">
          <p className="text-[14px] font-semibold">Besoin d’un coup de main ?</p>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-encre-2">
            <li>
              <Kbd>N</Kbd> nouvelle facture
            </li>
            <li>
              <Kbd>Ctrl</Kbd> <Kbd>K</Kbd> rechercher, aller partout
            </li>
            <li>
              <Kbd>Ctrl</Kbd> <Kbd>S</Kbd> enregistrer · <Kbd>Ctrl</Kbd> <Kbd>Entrée</Kbd> émettre
            </li>
            <li>« 3 x Logo 450 » dans une ligne : quantité, désignation et prix d’un coup</li>
          </ul>
          <div className="flex flex-col gap-1">
            <Link href={`/${slug}/aide`} className="text-accent hover:underline" onClick={() => setOuvert(false)}>
              Tutoriels en 2 minutes
            </Link>
            <Link href={`/${slug}/e-facturation/reforme`} className="text-accent hover:underline" onClick={() => setOuvert(false)}>
              Où j’en suis avec la réforme
            </Link>
            <a href="mailto:support@pastille.app" className="text-accent hover:underline">
              Écrire au support
            </a>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        aria-label="Aide"
        className="grid size-11 place-items-center rounded-full border border-trait bg-surface font-titre text-[18px] font-bold text-encre shadow-haute hover:bg-survol"
      >
        ?
      </button>
    </div>
  )
}

/** Annonces de la plateforme, masquables (mémorisées par le navigateur). */
export function Annonces({ annonces }: { annonces: Array<{ id: string; title: string; body: string; level: 'info' | 'important' }> }) {
  const [masquees, setMasquees] = useState<string[] | null>(null)
  useEffect(() => {
    let lues: string[] = []
    try {
      lues = JSON.parse(localStorage.getItem('pastille-annonces') ?? '[]') as string[]
    } catch {}
    // Lecture unique au montage d'un état stocké hors de React.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMasquees(lues)
  }, [])
  if (!masquees) return null
  const visibles = annonces.filter((a) => !masquees.includes(a.id))
  if (visibles.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      {visibles.map((a) => (
        <div key={a.id} role="status" className={a.level === 'important' ? 'flex items-start justify-between gap-3 rounded-m border border-attente/40 bg-attente-doux px-3.5 py-2.5 text-[13.5px]' : 'flex items-start justify-between gap-3 rounded-m border border-info/30 bg-info-doux px-3.5 py-2.5 text-[13.5px]'}>
          <span>
            <strong>{a.title}</strong> · {a.body}
          </span>
          <button
            type="button"
            className="shrink-0 text-[12px] text-encre-3 underline"
            onClick={() => {
              const lues = [...masquees, a.id]
              setMasquees(lues)
              try {
                localStorage.setItem('pastille-annonces', JSON.stringify(lues.slice(-50)))
              } catch {}
            }}
          >
            Masquer
          </button>
        </div>
      ))}
    </div>
  )
}
