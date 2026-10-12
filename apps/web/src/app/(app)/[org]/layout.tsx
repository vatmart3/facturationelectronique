import type { ReactNode } from 'react'
import { CoqueApp } from '@/components/coque/CoqueApp'
import { REGIMES_TVA } from '@/lib/organisation'
import { chargerContexte } from '@/lib/session'

export default async function LayoutOrganisation({ children, params }: { children: ReactNode; params: Promise<{ org: string }> }) {
  const { org } = await params
  const { organisation, organisations, utilisateur } = await chargerContexte(org)
  const regime = REGIMES_TVA.find((r) => r.valeur === organisation.vat_regime)?.libelle
  const detail = [organisation.legal_form, regime].filter(Boolean).join(' · ') || 'Identité à compléter'

  return (
    <CoqueApp
      organisation={{ slug: organisation.slug, nom: organisation.name, detail }}
      organisations={organisations.map((o) => ({ slug: o.slug, nom: o.nom, role: o.role }))}
      utilisateur={{ email: utilisateur.email, nom: utilisateur.nom }}
    >
      {children}
    </CoqueApp>
  )
}
