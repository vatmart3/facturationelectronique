import type { Metadata } from 'next'
import { ListeDocuments } from '@/components/documents/ListeDocuments'

export const metadata: Metadata = { title: 'Factures' }

export default async function Factures({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ statut?: string; q?: string; affichage?: string }> }) {
  const { org } = await params
  const { statut, q, affichage } = await searchParams
  return <ListeDocuments org={org} vue="factures" statut={statut} q={q} affichage={affichage} />
}
