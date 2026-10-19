import { cn } from '@/lib/cn'
import type { IconeNav } from '@/lib/navigation'
import { Icone } from './Icone'

const TAILLES = {
  xs: { boite: 'size-5 rounded-[3px]', icone: 12 },
  s: { boite: 'size-7 rounded-[4px]', icone: 15 },
  m: { boite: 'size-9 rounded-[4px]', icone: 19 },
  l: { boite: 'size-11 rounded-[5px]', icone: 23 },
} as const

/** Icône d'objet façon Lightning : carré de la couleur de l'objet (factures, devis…), glyphe blanc. Décorative. */
export function IconeObjet({ icone, taille = 's', className }: { icone: IconeNav; taille?: keyof typeof TAILLES; className?: string }) {
  const t = TAILLES[taille]
  return (
    <span
      aria-hidden="true"
      className={cn('inline-grid shrink-0 place-items-center text-[#fff]', t.boite, className)}
      style={{ backgroundColor: `var(--objet-${icone})` }}
    >
      <Icone nom={icone} taille={t.icone} />
    </span>
  )
}
