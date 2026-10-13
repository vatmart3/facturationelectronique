'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { trouverEntree, type IconeNav } from '@/lib/navigation'
import { IconeObjet } from './IconeObjet'

/**
 * En-tête de page façon fiche CRM : pastille colorée de la catégorie, nom de la catégorie,
 * titre et actions. La catégorie est déduite de l'adresse (/[org]/ventes/factures → Factures).
 */
export function EnTeteVue({ titre, description, actions, icone }: { titre: string; description?: ReactNode; actions?: ReactNode; icone?: IconeNav }) {
  const pathname = usePathname()
  const trouvee = trouverEntree(pathname.split('/').slice(2).join('/'))
  const pastille = icone ?? trouvee?.entree.icone
  return (
    <div className="flex flex-wrap items-center justify-between gap-3.5 rounded-l border border-trait bg-surface px-4 py-3.5 shadow-douce sm:px-5">
      <div className="flex min-w-0 items-center gap-3.5">
        {pastille && <IconeObjet icone={pastille} taille="l" />}
        <div className="min-w-0">
          {trouvee && <p className="surtitre text-encre-3">{trouvee.groupe}</p>}
          <h1 className="text-[22px] font-bold leading-tight sm:text-[24px]">{titre}</h1>
          {description && <p className="mt-0.5 text-[13.5px] text-encre-2">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
