import type { Metadata } from 'next'
import { ImportClients } from '@/components/clients/ImportClients'
import { EnTeteVue } from '@/components/ui/EnTeteVue'

export const metadata: Metadata = { title: 'Importer des clients' }

export default async function Import({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params
  return (
    <>
      <EnTeteVue titre="Importer des clients" description="Chaque ligne est vérifiée comme une fiche saisie à la main : les lignes invalides sont signalées, pas importées." />
      <ImportClients slug={org} />
    </>
  )
}
