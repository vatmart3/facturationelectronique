export interface ConfigSupabase {
  url: string
  cle: string
}

/** Retire espaces, guillemets collés par erreur et retours à la ligne autour d'une valeur. */
function nettoyer(valeur: string | undefined): string {
  return (valeur ?? '').trim().replace(/^["']+|["']+$/g, '').trim()
}

/**
 * Normalise l'URL du projet telle qu'elle est souvent copiée depuis Supabase :
 * « https://xxxx.supabase.co/rest/v1/ » (endpoint REST), barre finale, sans https://.
 * Retourne null si ce n'est pas une adresse http(s) exploitable.
 */
export function normaliserUrlSupabase(valeur: string | undefined): string | null {
  let url = nettoyer(valeur)
  if (!url) return null
  // Référence du projet retrouvée dans ce qui a été collé : lien du tableau de bord
  // (supabase.com/dashboard/project/<ref>), référence seule, ou chaîne de connexion Postgres.
  const ref =
    url.match(/supabase\.com\/dashboard\/project\/([a-z0-9]{20})/i)?.[1] ??
    url.match(/^([a-z0-9]{20})$/)?.[1] ??
    url.match(/^postgres(?:ql)?:\/\/.*(?:db\.([a-z0-9]{20})\.supabase\.co|postgres\.([a-z0-9]{20})[:@])/i)?.slice(1).find(Boolean)
  if (ref) return `https://${ref.toLowerCase()}.supabase.co`
  // Adresse d'un service du projet (…supabase.co/storage/v1, /auth/v1…) : seule l'origine compte.
  const projet = url.match(/^(?:https?:\/\/)?([a-z0-9]{20}\.supabase\.(?:co|in))(?:[/?#]|$)/i)?.[1]
  if (projet) return `https://${projet.toLowerCase()}`
  if (!/^https?:\/\//i.test(url) && /^[\w.-]+\.supabase\.(co|in|com)/i.test(url)) url = `https://${url}`
  url = url.replace(/\/+$/, '').replace(/\/(rest|auth)\/v1$/i, '').replace(/\/+$/, '')
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    if (u.pathname !== '/' && u.pathname !== '') return null
    return u.origin
  } catch {
    return null
  }
}

export function normaliserCle(valeur: string | undefined): string | null {
  const cle = nettoyer(valeur).replace(/\s+/g, '')
  return cle || null
}

/**
 * Lit la configuration publique Supabase. Accepte la clé « publishable » (nouveau format)
 * ou l'ancienne clé « anon ». Retourne null si l'app n'est pas configurée ou mal configurée,
 * pour que les pages publiques fonctionnent et que la connexion affiche un message clair.
 */
export function lireConfigSupabase(): ConfigSupabase | null {
  const url = normaliserUrlSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const cle = normaliserCle(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  if (!url || !cle) return null
  return { url, cle }
}

/** Ce qui manque ou cloche dans la configuration (sans jamais afficher les clés). */
export function diagnosticConfig(): string[] {
  const problemes: string[] = []
  const brute = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!nettoyer(brute)) problemes.push('NEXT_PUBLIC_SUPABASE_URL est vide ou absente.')
  else if (!normaliserUrlSupabase(brute)) problemes.push('NEXT_PUBLIC_SUPABASE_URL doit ressembler à https://xxxx.supabase.co (URL du projet, pas celle du tableau de bord).')
  if (!normaliserCle(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    problemes.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY est vide ou absente.')
  }
  return problemes
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
