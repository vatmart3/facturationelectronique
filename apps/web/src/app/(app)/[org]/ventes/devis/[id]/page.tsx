import type { Metadata } from 'next'
import { PageEditeur } from '@/components/documents/PageEditeur'

export const metadata: Metadata = { title: 'Devis' }

export default async function Devis({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { org, id } = await params
  return <PageEditeur org={org} type="devis" id={id} />
}
