import { cn } from '@/lib/cn'

/** Catégorie fiscale d'un client : pilote TVA, mentions et canal de transmission. */
export type CleCategorie = 'b2b' | 'b2c' | 'b2g' | 'ue' | 'hors_ue'

export const CATEGORIES: Record<CleCategorie, { libelle: string; pastille: string }> = {
  b2b: { libelle: 'Entreprise France', pastille: 'bg-info' },
  b2c: { libelle: 'Particulier', pastille: 'bg-attente' },
  b2g: { libelle: 'Administration', pastille: 'bg-ok' },
  ue: { libelle: 'Entreprise UE', pastille: 'bg-avoir' },
  hors_ue: { libelle: 'Hors UE', pastille: 'bg-alerte' },
}

export function Categorie({ categorie, className }: { categorie: CleCategorie; className?: string }) {
  const c = CATEGORIES[categorie]
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-s border border-trait bg-surface px-2 text-[12px] text-encre-2',
        className,
      )}
    >
      <span className={cn('size-[7px] rounded-[2px]', c.pastille)} aria-hidden="true" />
      {c.libelle}
    </span>
  )
}

/** Étiquette neutre (ex. « Reçoit les factures »). */
export function Etiquette({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center whitespace-nowrap rounded-s border border-trait bg-surface px-2 text-[12px] text-encre-2',
        className,
      )}
    >
      {children}
    </span>
  )
}
