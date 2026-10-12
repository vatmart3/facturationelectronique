'use client'

import { usePathname } from 'next/navigation'
import { Segments } from '@/components/ui/Segments'

export function OngletsReglages({ slug }: { slug: string }) {
  const pathname = usePathname()
  const onglets = [
    { href: `/${slug}/reglages`, libelle: 'Entreprise' },
    { href: `/${slug}/reglages/facturation`, libelle: 'Facturation' },
    { href: `/${slug}/reglages/membres`, libelle: 'Membres et rôles' },
    { href: `/${slug}/reglages/abonnement`, libelle: 'Abonnement' },
  ]
  return <Segments libelle="Sections des réglages" segments={onglets.map((o) => ({ ...o, actif: pathname === o.href }))} />
}
