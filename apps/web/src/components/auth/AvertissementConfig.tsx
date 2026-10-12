import { Message } from '@/components/ui/Message'
import { diagnosticConfig } from '@/lib/supabase/env'

export function AvertissementConfig() {
  const problemes = diagnosticConfig()
  return (
    <Message ton="info">
      <p>
        La connexion à Supabase n’est pas configurée. Vérifiez les variables d’environnement (Vercel : <em>Settings &gt; Environment Variables</em>,
        puis <em>Redeploy</em>).
      </p>
      {problemes.length > 0 && (
        <ul className="mt-1.5 list-disc pl-4">
          {problemes.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </Message>
  )
}
