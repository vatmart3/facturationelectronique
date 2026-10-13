'use client'

import { useParams } from 'next/navigation'
import { ErreurPage } from '@/components/coque/ErreurPage'

export default function Erreur({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { org } = useParams<{ org: string }>()
  return <ErreurPage erreur={error} reessayer={reset} retour={`/${org}/tableau-de-bord`} />
}
