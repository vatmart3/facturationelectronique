'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useOptimistic, useState, useTransition } from 'react'
import { changerStatut } from '@/app/actions/documents'
import { deplacerFacture } from '@/app/actions/suivi'
import { Message } from '@/components/ui/Message'
import { cn } from '@/lib/cn'
import { formatDate, formatMontant } from '@/lib/format'

export type Mode = 'factures' | 'devis'

export interface Carte {
  id: string
  colonne: string
  /** Statut en base : décide des déplacements permis. */
  status: string
  numero: string | null
  client: string
  montant: number
  reste: number
  echeance: string | null
  devise: string
}

interface Colonne {
  id: string
  titre: string
  pastille: string
}

const COLONNES: Record<Mode, Colonne[]> = {
  factures: [
    { id: 'brouillon', titre: 'Brouillon', pastille: 'bg-attente' },
    { id: 'envoyee', titre: 'Envoyée', pastille: 'bg-info' },
    { id: 'retard', titre: 'En retard', pastille: 'bg-alerte' },
    { id: 'payee', titre: 'Payée', pastille: 'bg-ok' },
  ],
  devis: [
    { id: 'brouillon', titre: 'Brouillon', pastille: 'bg-attente' },
    { id: 'envoye', titre: 'Envoyé', pastille: 'bg-info' },
    { id: 'accepte', titre: 'Accepté', pastille: 'bg-ok' },
    { id: 'clos', titre: 'Refusé ou expiré', pastille: 'bg-alerte' },
    { id: 'facture', titre: 'Facturé', pastille: 'bg-neutre' },
  ],
}

const LIBELLES_CIBLES: Record<string, string> = { envoyee: 'Envoyée', payee: 'Payée', envoye: 'Envoyé', accepte: 'Accepté', clos: 'Refusé' }

/**
 * Déplacements autorisés. Factures : émise → envoyée ; ouverte → payée (solde du reste dû).
 * Devis : envoyé → accepté ou refusé ; accepté → refusé ; refusé ou expiré → rouvert (envoyé) ou accepté.
 */
function cibles(mode: Mode, c: Carte): string[] {
  if (mode === 'factures') {
    const r: string[] = []
    if (c.status === 'emis') r.push('envoyee')
    if (['emis', 'envoye', 'partiellement_paye'].includes(c.status) && c.reste > 0) r.push('payee')
    return r
  }
  if (c.colonne === 'envoye') return ['accepte', 'clos']
  if (c.colonne === 'accepte') return ['clos']
  if (c.colonne === 'clos') return c.status === 'refuse' ? ['envoye'] : ['envoye', 'accepte']
  return []
}

export function Kanban({ slug, cartes, editable, mode = 'factures' }: { slug: string; cartes: Carte[]; editable: boolean; mode?: Mode }) {
  const router = useRouter()
  const [erreur, setErreur] = useState<string | null>(null)
  const [glissee, setGlissee] = useState<string | null>(null)
  const [, demarrer] = useTransition()
  const [affichees, deplacer] = useOptimistic(cartes, (etat, { id, cible }: { id: string; cible: string }) =>
    etat.map((c) => (c.id === id ? { ...c, colonne: cible } : c)),
  )
  const colonnes = COLONNES[mode]

  function deposer(id: string, cible: string) {
    const c = affichees.find((x) => x.id === id)
    if (!c || !cibles(mode, c).includes(cible)) return
    if (cible === 'payee' && !window.confirm(`Enregistrer le paiement de ${formatMontant(c.reste, c.devise)} (virement, aujourd’hui) ?`)) return
    if (cible === 'clos' && !window.confirm(`Marquer le devis ${c.numero ?? ''} comme refusé ?`)) return
    demarrer(async () => {
      deplacer({ id, cible })
      const r =
        mode === 'factures'
          ? await deplacerFacture(slug, id, cible as 'envoyee' | 'payee')
          : await changerStatut(slug, id, cible === 'clos' ? 'refuse' : (cible as 'envoye' | 'accepte'))
      setErreur(r.ok ? null : r.erreur)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {erreur && <Message ton="erreur">{erreur}</Message>}
      <div className={cn('grid gap-3 md:grid-cols-2', mode === 'devis' ? 'xl:grid-cols-5' : 'xl:grid-cols-4')}>
        {colonnes.map((col) => {
          const liste = affichees.filter((c) => c.colonne === col.id)
          const enCours = glissee ? affichees.find((c) => c.id === glissee) : undefined
          const accepte = enCours !== undefined && cibles(mode, enCours).includes(col.id)
          const total = liste.reduce((s, c) => s + (mode === 'factures' && col.id !== 'payee' ? c.reste || c.montant : c.montant), 0)
          return (
            <section
              key={col.id}
              aria-label={col.titre}
              onDragOver={(e) => accepte && e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                deposer(e.dataTransfer.getData('text/plain'), col.id)
                setGlissee(null)
              }}
              className={cn('flex min-h-40 min-w-0 flex-col gap-2 rounded-l border bg-surface-2 p-2.5', accepte ? 'border-accent bg-accent-doux' : 'border-trait')}
            >
              <h2 className="flex items-center justify-between gap-2 px-1 text-[13px] font-semibold">
                <span className="flex min-w-0 items-center gap-2">
                  <span className={cn('size-2 shrink-0 rounded-full', col.pastille)} aria-hidden="true" />
                  <span className="truncate">{col.titre}</span>
                  <span className="font-normal text-encre-3">{liste.length}</span>
                </span>
                <span className="num shrink-0 text-encre-3">{formatMontant(total)}</span>
              </h2>
              <ol className="m-0 flex list-none flex-col gap-2 p-0">
                {liste.map((c) => {
                  const possibles = editable ? cibles(mode, c) : []
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
                      <Link href={`/${slug}/ventes/${mode}/${c.id}`} className="flex items-center justify-between gap-2 hover:underline">
                        <span className="num font-semibold">{c.numero ?? 'Brouillon'}</span>
                        <span className="num font-semibold">{formatMontant(c.montant, c.devise)}</span>
                      </Link>
                      <span className="truncate text-encre-2">{c.client}</span>
                      {c.echeance && (
                        <span className={cn('text-[12px]', c.colonne === 'retard' ? 'text-alerte' : 'text-encre-3')}>
                          {mode === 'devis' ? 'Valable jusqu’au' : 'Échéance'} {formatDate(c.echeance)}
                        </span>
                      )}
                      {possibles.length > 0 && (
                        <label className="mt-1 flex items-center gap-1.5 text-[12px] text-encre-3">
                          <span className="sr-only">Déplacer {c.numero} vers</span>
                          <select
                            value=""
                            onChange={(e) => e.target.value && deposer(c.id, e.target.value)}
                            className="h-7 rounded-s border border-trait bg-surface px-1 text-[12px]"
                          >
                            <option value="">Déplacer vers…</option>
                            {possibles.map((p) => (
                              <option key={p} value={p}>
                                {mode === 'devis' && p === 'envoye' ? 'Rouvrir (envoyé)' : LIBELLES_CIBLES[p]}
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
