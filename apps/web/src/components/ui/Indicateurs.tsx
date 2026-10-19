import { cn } from '@/lib/cn'

export interface Indicateur {
  libelle: string
  valeur: string
  detail?: string
  ton?: 'ok' | 'info' | 'alerte' | 'neutre'
}

const TONS = { ok: 'bg-ok', info: 'bg-info', alerte: 'bg-alerte', neutre: 'bg-encre-3' }

export function Indicateurs({ indicateurs }: { indicateurs: Indicateur[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {indicateurs.map((i) => (
        <div key={i.libelle} className="flex min-w-0 flex-col gap-1.5 rounded-l border border-trait bg-surface px-[18px] py-4">
          <span className="flex items-center gap-1.5 text-[12.5px] text-encre-2">
            <span className={cn('size-[7px] rounded-full', TONS[i.ton ?? 'neutre'])} aria-hidden="true" />
            {i.libelle}
          </span>
          <span className="whitespace-nowrap font-texte text-[24px] font-semibold tabular-nums tracking-[-0.02em]">{i.valeur}</span>
          {i.detail && <span className="text-[12px] text-encre-3">{i.detail}</span>}
        </div>
      ))}
    </div>
  )
}
