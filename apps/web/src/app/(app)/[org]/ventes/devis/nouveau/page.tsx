import type { Metadata } from 'next'
import { PageEditeur } from '@/components/documents/PageEditeur'

export const metadata: Metadata = { title: 'Nouveau devis' }

export default async function NouveauDevis({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ client?: string }> }) {
  const { org } = await params
  const { client } = await searchParams
  return <PageEditeur org={org} type="devis" clientId={client} />
}
