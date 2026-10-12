import type { ReactNode } from 'react'
import { OngletsReglages } from '@/components/organisation/OngletsReglages'
import { EnTeteVue } from '@/components/ui/EnTeteVue'

export default async function LayoutReglages({ children, params }: { children: ReactNode; params: Promise<{ org: string }> }) {
  const { org } = await params
  return (
    <>
      <EnTeteVue titre="Réglages" description="Identité de l’entreprise, membres et rôles." />
      <OngletsReglages slug={org} />
      {children}
    </>
  )
}
