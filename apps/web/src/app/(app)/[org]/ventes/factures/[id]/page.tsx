import type { Metadata } from 'next'
import { PageEditeur } from '@/components/documents/PageEditeur'

export const metadata: Metadata = { title: 'Facture' }

export default async function Facture({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { org, id } = await params
  return <PageEditeur org={org} type="facture" id={id} />
}
