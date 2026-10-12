import type { Metadata } from 'next'
import { FormulaireClient } from '@/components/clients/FormulaireClient'
import { EnTeteVue } from '@/components/ui/EnTeteVue'

export const metadata: Metadata = { title: 'Nouveau client' }

export default async function NouveauClient({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params
  return (
    <>
      <EnTeteVue titre="Nouveau client" description="Une fiche complète évite les erreurs de mentions à l’émission." />
      <FormulaireClient slug={org} />
    </>
  )
}
