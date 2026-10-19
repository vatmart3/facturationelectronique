'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { trouverEntree, type IconeNav } from '@/lib/navigation'
import { IconeObjet } from './IconeObjet'

/** En-tête de page : icône de la catégorie (déduite de l'adresse), titre, description et actions. */
export function EnTeteVue({ titre, description, actions, icone }: { titre: string; description?: ReactNode; actions?: ReactNode; icone?: IconeNav }) {
  const pathname = usePathname()
  const pastille = icone ?? trouverEntree(pathname.split('/').slice(2).join('/'))?.entree.icone
  return (
    <div className="flex flex-wrap items-end justify-between gap-3.5">
      <div className="flex min-w-0 items-center gap-3">
        {pastille && <IconeObjet icone={pastille} taille="m" />}
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight tracking-[-0.01em] sm:text-[24px]">{titre}</h1>
          {description && <p className="mt-0.5 text-[13.5px] text-encre-2">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
