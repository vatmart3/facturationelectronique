import type { SVGProps } from 'react'
import type { IconeNav } from '@/lib/navigation'

export type NomIcone =
  | IconeNav
  | 'recherche'
  | 'plus'
  | 'chevrons'
  | 'chevron-gauche'
  | 'chevron-bas'
  | 'lanceur'
  | 'deconnexion'
  | 'menu'
  | 'fermer'
  | 'coche'
  | 'alerte'
  | 'entreprise'
  | 'membres'

/** Tracés 16×16, trait 1,4, dessinés pour PASTILLE (pas de bibliothèque d'icônes). */
const TRACES: Record<NomIcone, string> = {
  tableau: 'M2.5 2.5h4.5v5.5H2.5zM9 2.5h4.5V6H9zM2.5 10H7v3.5H2.5zM9 8h4.5v5.5H9z',
  facture: 'M4 2.5h5.5L12 5v8.5H4zM6 8h4M6 10.5h4',
  devis: 'M4 2.5h5.5L12 5v8.5H4zM6.2 9.2l1.3 1.3 2.4-2.6',
  avoir: 'M4 2.5h5.5L12 5v8.5H4zM6 9.3h4',
  recurrence: 'M3 7.5a5 5 0 0 1 8.6-3.4L13 5.5M13 8.5a5 5 0 0 1-8.6 3.4L3 10.5M13 2.5v3h-3M3 13.5v-3h3',
  clients: 'M8.3 5.5a2.3 2.3 0 1 1-4.6 0 2.3 2.3 0 0 1 4.6 0M2 13c.4-2.3 2-3.6 4-3.6s3.6 1.3 4 3.6M10.5 3.4a2.2 2.2 0 0 1 0 4.2M12 9.6c1 .5 1.7 1.7 2 3.4',
  relances: 'M4 11V7.5a4 4 0 0 1 8 0V11l1 1.5H3zM6.8 14h2.4',
  catalogue: 'M2.5 5 8 2.5 13.5 5v6L8 13.5 2.5 11zM2.5 5 8 7.5 13.5 5M8 7.5v6',
  paiements: 'M3.5 4h9A1.5 1.5 0 0 1 14 5.5v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11V5.5A1.5 1.5 0 0 1 3.5 4zM2 7h12M4.5 10H7',
  recues: 'M2.5 9.5l1.8-6h7.4l1.8 6v4h-11zM2.5 9.5h3l.8 1.5h3.4l.8-1.5h3',
  ereporting: 'M3 13V8M6.5 13V5M10 13V9.5M13.5 13V3',
  reforme: 'M8 2l5 2v4c0 3-2.2 5-5 6-2.8-1-5-3-5-6V4zM6 8l1.5 1.5 2.7-2.7',
  exports: 'M8 2.5V10M5 7l3 3 3-3M3 11v2.5h10V11',
  reglages: 'M3 4.5h6M12 4.5h1M3 11.5h1M7 11.5h6M12 4.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0M7 11.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0',
  aide: 'M13.5 8a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0M6.4 6.4a1.7 1.7 0 0 1 3.2.7c0 1.1-1.6 1.4-1.6 2.4M8 11.3v.2',
  recherche: 'M11.5 7a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0M10.5 10.5 14 14',
  plus: 'M8 3v10M3 8h10',
  chevrons: 'M5 6l3-3 3 3M5 10l3 3 3-3',
  'chevron-bas': 'M4.5 6.5 8 10l3.5-3.5',
  lanceur: 'M3 3h2v2H3zM7 3h2v2H7zM11 3h2v2h-2zM3 7h2v2H3zM7 7h2v2H7zM11 7h2v2h-2zM3 11h2v2H3zM7 11h2v2H7zM11 11h2v2h-2z',
  'chevron-gauche': 'M10 3.5 5.5 8l4.5 4.5',
  deconnexion: 'M9.5 3H4v10h5.5M7.5 8H14M11.5 5.5 14 8l-2.5 2.5',
  menu: 'M2.5 4.5h11M2.5 8h11M2.5 11.5h11',
  fermer: 'M4 4l8 8M12 4l-8 8',
  coche: 'M3.5 8.5l3 3 6-7',
  alerte: 'M8 2.5 14 13H2zM8 6.5v3M8 11.3v.2',
  entreprise: 'M2.5 13.5h11M3.5 13.5V3.5h6v10M9.5 6.5h3v7M5.5 6h2M5.5 8.5h2M5.5 11h2',
  membres: 'M8.3 5.5a2.3 2.3 0 1 1-4.6 0 2.3 2.3 0 0 1 4.6 0M2 13c.4-2.3 2-3.6 4-3.6s3.6 1.3 4 3.6M11 6.5v4M9 8.5h4',
}

interface IconeProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  nom: NomIcone
  taille?: number
}

export function Icone({ nom, taille = 16, className, ...props }: IconeProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={taille}
      height={taille}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      <path d={TRACES[nom]} />
    </svg>
  )
}
