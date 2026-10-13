import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Panneau({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('flex min-w-0 flex-col rounded-l border border-trait bg-surface shadow-douce', className)}>{children}</section>
}

export function PanneauTete({ titre, description, actions }: { titre: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-trait px-[18px] py-3.5">
      <div className="min-w-0">
        <h2 className="text-[14.5px] font-semibold">{titre}</h2>
        {description && <p className="mt-0.5 text-[12.5px] text-encre-3">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export function PanneauCorps({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-4 px-[18px] py-4', className)}>{children}</div>
}

export function PanneauPied({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-2 border-t border-trait bg-surface-2 px-[18px] py-3 rounded-b-l">{children}</div>
}

/** Liste clé / valeur alignée, pour les fiches. */
export function ListeCles({ lignes }: { lignes: Array<[string, ReactNode]> }) {
  return (
    <dl className="m-0 flex flex-col">
      {lignes.map(([cle, valeur]) => (
        <div key={cle} className="flex justify-between gap-3 border-b border-trait py-2 text-[13.5px] last:border-b-0">
          <dt className="text-encre-2">{cle}</dt>
          <dd className="m-0 text-right font-medium">{valeur}</dd>
        </div>
      ))}
    </dl>
  )
}
