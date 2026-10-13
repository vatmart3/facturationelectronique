import { cn } from '@/lib/cn'
import type { IconeNav } from '@/lib/navigation'
import { IconeObjet } from './IconeObjet'

export interface Indicateur {
  libelle: string
  valeur: string
  detail?: string
  ton?: 'ok' | 'info' | 'alerte' | 'neutre'
}

const TONS: Record<NonNullable<Indicateur['ton']>, { barre: string; valeur: string; icone: IconeNav }> = {
  ok: { barre: 'bg-ok', valeur: 'text-ok', icone: 'paiements' },
  info: { barre: 'bg-info', valeur: 'text-info', icone: 'facture' },
  alerte: { barre: 'bg-alerte', valeur: 'text-alerte', icone: 'relances' },
  neutre: { barre: 'bg-objet-tableau', valeur: 'text-encre', icone: 'tableau' },
}

/** Rangée de chiffres clés : chaque carte porte la couleur de ce qu'elle mesure. */
export function Indicateurs({ indicateurs }: { indicateurs: Indicateur[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {indicateurs.map((i) => {
        const t = TONS[i.ton ?? 'neutre']
        return (
          <div key={i.libelle} className="relative flex min-w-0 flex-col gap-2 overflow-hidden rounded-l border border-trait bg-surface px-[18px] pb-4 pt-[18px] shadow-douce">
            <span className={cn('absolute inset-x-0 top-0 h-[3px]', t.barre)} aria-hidden="true" />
            <span className="flex items-center gap-2 text-[12.5px] font-medium text-encre-2">
              <IconeObjet icone={t.icone} taille="xs" />
              {i.libelle}
            </span>
            <span className={cn('whitespace-nowrap font-titre text-[24px] font-bold tabular-nums tracking-[-0.02em]', t.valeur)}>{i.valeur}</span>
            {i.detail && <span className="text-[12px] text-encre-3">{i.detail}</span>}
          </div>
        )
      })}
    </div>
  )
}
