import type { Metadata } from 'next'
import { ListeDocuments } from '@/components/documents/ListeDocuments'

export const metadata: Metadata = { title: 'Devis' }

export default async function Devis({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ statut?: string; q?: string }> }) {
  const { org } = await params
  const { statut, q } = await searchParams
  return <ListeDocuments org={org} vue="devis" statut={statut} q={q} />
}
