'use client'

/** Dernier recours (erreur dans la mise en page racine) : page autonome, sans dépendance. */
export default function ErreurGlobale({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f3f6fb', color: '#16192a' }}>
        <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 16 }}>
          <div style={{ maxWidth: 460, textAlign: 'center' }}>
            <h1 style={{ fontSize: 22 }}>Pastille n’a pas pu s’afficher</h1>
            <p style={{ color: '#4c5566' }}>Un problème passager. Réessayez dans un instant.</p>
            <button
              type="button"
              onClick={reset}
              style={{ marginTop: 8, background: '#0b6bcb', color: '#fff', border: 0, borderRadius: 8, padding: '10px 18px', fontWeight: 600, cursor: 'pointer' }}
            >
              Réessayer
            </button>
          </div>
        </main>
      </body>
    </html>
  )
}
