import type { Metadata } from 'next'
import { PageEditeur } from '@/components/documents/PageEditeur'

export const metadata: Metadata = { title: 'Nouvelle facture' }

export default async function NouvelleFacture({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ client?: string }> }) {
  const { org } = await params
  const { client } = await searchParams
  return <PageEditeur org={org} type="facture" clientId={client} />
}
