import type { IconeNav } from '@/lib/navigation'
import { IconeObjet } from './IconeObjet'

export interface Indicateur {
  libelle: string
  valeur: string
  detail?: string
  ton?: 'ok' | 'info' | 'alerte' | 'neutre'
}

const ICONES: Record<NonNullable<Indicateur['ton']>, IconeNav> = { ok: 'paiements', info: 'facture', alerte: 'relances', neutre: 'tableau' }

/** Chiffres clés en cartes, chacune avec l'icône de l'objet mesuré. */
export function Indicateurs({ indicateurs }: { indicateurs: Indicateur[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {indicateurs.map((i) => (
        <div key={i.libelle} className="flex min-w-0 items-start gap-3 rounded-l border border-trait bg-surface px-4 py-3.5 shadow-douce">
          <IconeObjet icone={ICONES[i.ton ?? 'neutre']} taille="m" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[12.5px] text-encre-2">{i.libelle}</span>
            <span className="whitespace-nowrap font-texte text-[22px] font-bold tabular-nums tracking-[-0.01em]">{i.valeur}</span>
            {i.detail && <span className="text-[12px] text-encre-3">{i.detail}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
