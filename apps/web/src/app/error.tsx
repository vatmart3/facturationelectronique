'use client'

import { ErreurPage } from '@/components/coque/ErreurPage'

export default function Erreur({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-fond px-4">
      <ErreurPage erreur={error} reessayer={reset} />
    </main>
  )
}
