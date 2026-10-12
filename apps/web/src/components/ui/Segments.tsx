import Link from 'next/link'
import { cn } from '@/lib/cn'

export interface Segment {
  href: string
  libelle: string
  compte?: number
  actif: boolean
}

/** Onglets de filtrage portés par l'URL (partageables, compatibles avec le bouton retour). */
export function Segments({ segments, libelle }: { segments: Segment[]; libelle: string }) {
  return (
    <nav aria-label={libelle} className="flex max-w-full gap-0.5 overflow-x-auto border-b border-trait">
      {segments.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          aria-current={s.actif ? 'page' : undefined}
          className={cn(
            '-mb-px inline-flex h-9 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-[13.5px]',
            s.actif ? 'border-encre font-semibold text-encre' : 'border-transparent font-medium text-encre-2 hover:text-encre',
          )}
        >
          {s.libelle}
          {s.compte !== undefined && <span className="num text-[11.5px] text-encre-3">{s.compte}</span>}
        </Link>
      ))}
    </nav>
  )
}
