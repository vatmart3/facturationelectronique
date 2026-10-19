import { cn } from '@/lib/cn'
import type { Etape } from '@/lib/parcours'
import { Icone } from './Icone'

const STYLES = {
  fait: 'bg-ok text-surface',
  courant: 'bg-accent-fort text-sur-accent font-semibold',
  avenir: 'bg-fond text-encre-2',
  echec: 'bg-alerte text-surface font-semibold',
} as const

const ETATS = { fait: 'terminée', courant: 'en cours', avenir: 'à venir', echec: 'bloquée' } as const

/** Chemin d'étapes en chevrons (« path » Lightning) : le cycle de vie du document d'un coup d'œil. */
export function Parcours({ etapes }: { etapes: Etape[] }) {
  return (
    <ol className="m-0 flex list-none p-0" aria-label="Avancement">
      {etapes.map((e, i) => (
        <li
          key={e.libelle}
          className={cn('flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 px-4 text-[12.5px]', i > 0 && '-ml-1.5', STYLES[e.etat])}
          style={{
            clipPath:
              i === 0
                ? 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)'
                : i === etapes.length - 1
                  ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 10px 50%)'
                  : 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)',
            borderRadius: i === 0 ? '16px 0 0 16px' : i === etapes.length - 1 ? '0 16px 16px 0' : undefined,
          }}
          aria-current={e.etat === 'courant' || e.etat === 'echec' ? 'step' : undefined}
        >
          {e.etat === 'fait' && <Icone nom="coche" taille={13} />}
          <span className="truncate">{e.libelle}</span>
          <span className="sr-only"> ({ETATS[e.etat]})</span>
        </li>
      ))}
    </ol>
  )
}
