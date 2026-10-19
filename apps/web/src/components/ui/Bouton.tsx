import Link from 'next/link'
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Icone, type NomIcone } from './Icone'

export type VarianteBouton = 'primaire' | 'secondaire' | 'fantome' | 'danger'
export type TailleBouton = 's' | 'compact' | 'm' | 'l'

const VARIANTES: Record<VarianteBouton, string> = {
  primaire: 'bg-accent text-sur-accent border-accent hover:bg-accent-fort hover:border-accent-fort',
  secondaire: 'bg-surface text-accent border-trait-fort hover:bg-survol hover:text-accent-fort',
  fantome: 'bg-transparent text-encre-2 border-transparent hover:bg-survol hover:text-encre',
  danger: 'bg-surface text-alerte border-trait-fort hover:bg-alerte-doux',
}

const TAILLES: Record<TailleBouton, string> = {
  s: 'h-7 px-2.5 text-[12.5px] gap-1.5',
  compact: 'h-8 px-3 text-[13.5px] gap-1.5',
  m: 'h-[34px] px-3.5 text-[13.5px] gap-2',
  l: 'h-11 px-5 text-[15px] gap-2',
}

export function classesBouton(variante: VarianteBouton = 'secondaire', taille: TailleBouton = 'm') {
  return cn(
    'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-m border font-semibold',
    'transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50',
    VARIANTES[variante],
    TAILLES[taille],
  )
}

interface ContenuProps {
  icone?: NomIcone
  chargement?: boolean
  children: ReactNode
}

function Contenu({ icone, chargement, children }: ContenuProps) {
  return (
    <>
      {chargement ? (
        <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
      ) : (
        icone && <Icone nom={icone} taille={15} />
      )}
      {children}
    </>
  )
}

interface BoutonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBouton
  taille?: TailleBouton
  icone?: NomIcone
  chargement?: boolean
}

export function Bouton({
  variante,
  taille,
  icone,
  chargement = false,
  className,
  children,
  type = 'button',
  disabled,
  ...props
}: BoutonProps) {
  return (
    <button
      type={type}
      className={cn(classesBouton(variante, taille), className)}
      disabled={disabled || chargement}
      aria-busy={chargement || undefined}
      {...props}
    >
      <Contenu icone={icone} chargement={chargement}>
        {children}
      </Contenu>
    </button>
  )
}

interface BoutonLienProps extends ComponentProps<typeof Link> {
  variante?: VarianteBouton
  taille?: TailleBouton
  icone?: NomIcone
}

export function BoutonLien({ variante, taille, icone, className, children, ...props }: BoutonLienProps) {
  return (
    <Link className={cn(classesBouton(variante, taille), className)} {...props}>
      <Contenu icone={icone}>{children}</Contenu>
    </Link>
  )
}
