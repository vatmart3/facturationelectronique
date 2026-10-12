export interface ConfigSupabase {
  url: string
  cle: string
}

/**
 * Lit la configuration publique Supabase. Accepte la clé « publishable » (nouveau format)
 * ou l'ancienne clé « anon ». Retourne null si l'app n'est pas configurée, pour que les
 * pages publiques fonctionnent et que la connexion affiche un message clair.
 */
export function lireConfigSupabase(): ConfigSupabase | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const cle = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !cle) return null
  return { url, cle }
}

export function exigerConfigSupabase(): ConfigSupabase {
  const config = lireConfigSupabase()
  if (!config) {
    throw new Error(
      'Supabase n’est pas configuré : définissez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (voir README).',
    )
  }
  return config
}
