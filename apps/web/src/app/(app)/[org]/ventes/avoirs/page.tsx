import type { Metadata } from 'next'
import { ListeDocuments } from '@/components/documents/ListeDocuments'

export const metadata: Metadata = { title: 'Avoirs' }

export default async function Avoirs({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ statut?: string; q?: string }> }) {
  const { org } = await params
  const { statut, q } = await searchParams
  return <ListeDocuments org={org} vue="avoirs" statut={statut} q={q} />
}
