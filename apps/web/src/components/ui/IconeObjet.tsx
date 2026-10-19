import { cn } from '@/lib/cn'
import type { IconeNav } from '@/lib/navigation'
import { Icone } from './Icone'

const TAILLES = {
  xs: { boite: 'size-[22px] rounded-[6px]', icone: 13 },
  s: { boite: 'size-7 rounded-[7px]', icone: 15 },
  m: { boite: 'size-9 rounded-[9px]', icone: 18 },
  l: { boite: 'size-11 rounded-[11px]', icone: 22 },
} as const

/**
 * Icône de catégorie (factures, devis, clients…) dans un carré bleu pâle. Décorative.
 */
export function IconeObjet({ icone, taille = 's', className }: { icone: IconeNav; taille?: keyof typeof TAILLES; className?: string }) {
  const t = TAILLES[taille]
  return (
    <span
      aria-hidden="true"
      className={cn('inline-grid shrink-0 place-items-center bg-accent-doux text-accent', t.boite, className)}
    >
      <Icone nom={icone} taille={t.icone} />
    </span>
  )
}
