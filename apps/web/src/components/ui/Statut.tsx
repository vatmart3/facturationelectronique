import { cn } from '@/lib/cn'

export type CleStatut = 'brouillon' | 'envoyee' | 'retard' | 'payee' | 'avoir' | 'annulee' | 'acceptee' | 'refusee'

const STATUTS: Record<CleStatut, { libelle: string; classes: string }> = {
  brouillon: { libelle: 'Brouillon', classes: 'bg-attente-doux text-attente' },
  envoyee: { libelle: 'Envoyée', classes: 'bg-info-doux text-info' },
  retard: { libelle: 'En retard', classes: 'bg-alerte-doux text-alerte' },
  payee: { libelle: 'Payée', classes: 'bg-ok-doux text-ok' },
  avoir: { libelle: 'Avoir', classes: 'bg-avoir-doux text-avoir' },
  annulee: { libelle: 'Annulée', classes: 'bg-neutre-doux text-neutre' },
  acceptee: { libelle: 'Accepté', classes: 'bg-ok-doux text-ok' },
  refusee: { libelle: 'Refusé', classes: 'bg-neutre-doux text-neutre' },
}

/** Statut d'un document : toujours une couleur ET un libellé. */
export function Statut({ statut, libelle, className }: { statut: CleStatut; libelle?: string; className?: string }) {
  const s = STATUTS[statut]
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-s px-2 text-[12.5px] font-medium',
        s.classes,
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {libelle ?? s.libelle}
    </span>
  )
}
