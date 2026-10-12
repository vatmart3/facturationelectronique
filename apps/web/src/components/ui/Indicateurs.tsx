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
    <div className="grid grid-cols-2 overflow-hidden rounded-l border border-trait bg-surface lg:grid-cols-4">
      {indicateurs.map((i, n) => (
        <div
          key={i.libelle}
          className={cn(
            'flex min-w-0 flex-col gap-1.5 border-trait px-[18px] py-4',
            n % 2 === 0 && 'border-r',
            n < 2 && 'border-b lg:border-b-0',
            'lg:border-r lg:last:border-r-0',
          )}
        >
          <span className="flex items-center gap-1.5 text-[12.5px] text-encre-2">
            <span className={cn('size-[7px] rounded-full', TONS[i.ton ?? 'neutre'])} aria-hidden="true" />
            {i.libelle}
          </span>
          <span className="whitespace-nowrap font-titre text-[22px] font-semibold tabular-nums tracking-[-0.02em]">{i.valeur}</span>
          {i.detail && <span className="text-[12px] text-encre-3">{i.detail}</span>}
        </div>
      ))}
    </div>
  )
}
