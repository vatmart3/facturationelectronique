import type { Metadata } from 'next'
import { PageEditeur } from '@/components/documents/PageEditeur'

export const metadata: Metadata = { title: 'Avoir' }

export default async function Avoir({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { org, id } = await params
  return <PageEditeur org={org} type="avoir" id={id} />
}
