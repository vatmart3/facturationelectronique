import Link from 'next/link'
import type { Evenement } from '@/lib/historique'
import { formatDate } from '@/lib/format'
import { IconeObjet } from './IconeObjet'

const CHEMINS = { facture: 'factures', acompte: 'factures', devis: 'devis', avoir: 'avoirs' } as const

/** Fil d'activité façon Lightning : icône de l'objet, trait vertical, date à droite. */
export function Chronologie({ slug, evenements }: { slug: string; evenements: Evenement[] }) {
  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {evenements.map((e, i) => (
        <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
          {i < evenements.length - 1 && <span className="absolute left-[13px] top-8 bottom-1 w-px bg-trait" aria-hidden="true" />}
          <IconeObjet icone={e.icone} taille="s" />
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 pt-0.5">
            <div className="flex min-w-0 flex-col">
              <Link href={`/${slug}/ventes/${CHEMINS[e.type]}/${e.documentId}`} className="text-[13.5px] font-medium text-accent hover:underline">
                {e.titre}
              </Link>
              <span className="text-[12.5px] text-encre-3">{e.detail}</span>
            </div>
            <time dateTime={e.date} className="shrink-0 text-[12px] text-encre-3">
              {formatDate(e.date)}
            </time>
          </div>
        </li>
      ))}
    </ol>
  )
}
