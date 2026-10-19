'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { trouverEntree, type IconeNav } from '@/lib/navigation'
import { IconeObjet } from './IconeObjet'

/**
 * En-tête de page façon Lightning : carte blanche avec l'icône colorée de l'objet, le nom
 * de la rubrique au-dessus du titre, et les actions à droite. La rubrique est déduite de l'adresse.
 */
export function EnTeteVue({ titre, description, actions, icone }: { titre: string; description?: ReactNode; actions?: ReactNode; icone?: IconeNav }) {
  const pathname = usePathname()
  const trouvee = trouverEntree(pathname.split('/').slice(2).join('/'))
  const pastille = icone ?? trouvee?.entree.icone
  return (
    <div className="flex flex-wrap items-center justify-between gap-3.5 rounded-l border border-trait bg-surface px-4 py-3.5 shadow-douce">
      <div className="flex min-w-0 items-center gap-3">
        {pastille && <IconeObjet icone={pastille} taille="l" />}
        <div className="min-w-0">
          {trouvee && <p className="text-[12.5px] leading-tight text-encre-3">{trouvee.groupe}</p>}
          <h1 className="text-[20px] font-bold leading-tight sm:text-[22px]">{titre}</h1>
          {description && <p className="mt-0.5 text-[13px] text-encre-2">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
