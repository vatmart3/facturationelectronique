'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useOptimistic, useState, useTransition } from 'react'
import { deplacerFacture } from '@/app/actions/suivi'
import { Message } from '@/components/ui/Message'
import { cn } from '@/lib/cn'
import { formatDate, formatMontant } from '@/lib/format'

export type Colonne = 'brouillon' | 'envoyee' | 'retard' | 'payee'

export interface Carte {
  id: string
  colonne: Colonne
  /** Statut en base : décide des déplacements permis. */
  status: string
  numero: string | null
  client: string
  montant: number
  reste: number
  echeance: string | null
  devise: string
}

const COLONNES: Array<{ id: Colonne; titre: string; pastille: string }> = [
  { id: 'brouillon', titre: 'Brouillon', pastille: 'bg-attente' },
  { id: 'envoyee', titre: 'Envoyée', pastille: 'bg-info' },
  { id: 'retard', titre: 'En retard', pastille: 'bg-alerte' },
  { id: 'payee', titre: 'Payée', pastille: 'bg-ok' },
]

/** Déplacements autorisés : émise → envoyée ; ouverte → payée (solde du reste dû). */
function cibles(c: Carte): Array<'envoyee' | 'payee'> {
  const r: Array<'envoyee' | 'payee'> = []
  if (c.status === 'emis') r.push('envoyee')
  if (['emis', 'envoye', 'partiellement_paye'].includes(c.status) && c.reste > 0) r.push('payee')
  return r
}

export function Kanban({ slug, cartes, editable }: { slug: string; cartes: Carte[]; editable: boolean }) {
  const router = useRouter()
  const [erreur, setErreur] = useState<string | null>(null)
  const [glissee, setGlissee] = useState<string | null>(null)
  const [, demarrer] = useTransition()
  const [affichees, deplacer] = useOptimistic(cartes, (etat, { id, cible }: { id: string; cible: Colonne }) =>
    etat.map((c) => (c.id === id ? { ...c, colonne: cible } : c)),
  )

  function deposer(id: string, cible: 'envoyee' | 'payee') {
    const c = affichees.find((x) => x.id === id)
    if (!c || !cibles(c).includes(cible)) return
    if (cible === 'payee' && !window.confirm(`Enregistrer le paiement de ${formatMontant(c.reste, c.devise)} (virement, aujourd’hui) ?`)) return
    demarrer(async () => {
      deplacer({ id, cible })
      const r = await deplacerFacture(slug, id, cible)
      if (!r.ok) setErreur(r.erreur)
      else setErreur(null)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {erreur && <Message ton="erreur">{erreur}</Message>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLONNES.map((col) => {
          const liste = affichees.filter((c) => c.colonne === col.id)
          const accepte = glissee !== null && (col.id === 'envoyee' || col.id === 'payee') && cibles(affichees.find((c) => c.id === glissee)!).includes(col.id)
          return (
            <section
              key={col.id}
              aria-label={col.titre}
              onDragOver={(e) => accepte && e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const id = e.dataTransfer.getData('text/plain')
                if (col.id === 'envoyee' || col.id === 'payee') deposer(id, col.id)
                setGlissee(null)
              }}
              className={cn('flex min-h-40 flex-col gap-2 rounded-l border bg-surface-2 p-2.5', accepte ? 'border-accent bg-accent-doux' : 'border-trait')}
            >
              <h2 className="flex items-center justify-between px-1 text-[13px] font-semibold">
                <span className="flex items-center gap-2">
                  <span className={cn('size-2 rounded-full', col.pastille)} aria-hidden="true" />
                  {col.titre}
                </span>
                <span className="num text-encre-3">{formatMontant(liste.reduce((s, c) => s + (col.id === 'payee' ? c.montant : c.reste || c.montant), 0))}</span>
              </h2>
              <ol className="m-0 flex list-none flex-col gap-2 p-0">
                {liste.map((c) => {
                  const possibles = editable ? cibles(c) : []
                  return (
                    <li
                      key={c.id}
                      draggable={possibles.length > 0}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', c.id)
                        setGlissee(c.id)
                      }}
                      onDragEnd={() => setGlissee(null)}
                      className={cn('flex flex-col gap-1 rounded-m border border-trait bg-surface p-2.5 text-[13px] shadow-douce', possibles.length > 0 && 'cursor-grab')}
                    >
                      <Link href={`/${slug}/ventes/factures/${c.id}`} className="flex items-center justify-between gap-2 hover:underline">
                        <span className="num font-semibold">{c.numero ?? 'Brouillon'}</span>
                        <span className="num font-semibold">{formatMontant(c.montant, c.devise)}</span>
                      </Link>
                      <span className="truncate text-encre-2">{c.client}</span>
                      {c.echeance && <span className={cn('text-[12px]', c.colonne === 'retard' ? 'text-alerte' : 'text-encre-3')}>Échéance {formatDate(c.echeance)}</span>}
                      {possibles.length > 0 && (
                        <label className="mt-1 flex items-center gap-1.5 text-[12px] text-encre-3">
                          <span className="sr-only">Déplacer {c.numero} vers</span>
                          <select
                            value=""
                            onChange={(e) => e.target.value && deposer(c.id, e.target.value as 'envoyee' | 'payee')}
                            className="h-7 rounded-s border border-trait bg-surface px-1 text-[12px]"
                          >
                            <option value="">Déplacer vers…</option>
                            {possibles.map((p) => (
                              <option key={p} value={p}>
                                {p === 'envoyee' ? 'Envoyée' : 'Payée'}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </li>
                  )
                })}
              </ol>
            </section>
          )
        })}
      </div>
    </div>
  )
}
