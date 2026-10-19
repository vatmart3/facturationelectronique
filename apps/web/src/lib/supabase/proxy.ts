import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { lireConfigSupabase } from './env'
import type { Database } from './types'

/** Chemins accessibles sans session. Tout le reste exige d'être connecté. */
const PUBLICS = ['/manifest.webmanifest', '/sante', '/connexion', '/inscription', '/auth', '/systeme', '/mot-de-passe', '/d', '/api/taches', '/api/plateforme', '/api/stripe', '/invitation', '/legal', '/tarifs', '/facture-auto-entrepreneur', '/facturation-electronique-2027', '/modele-facture-factur-x', '/sitemap.xml', '/robots.txt']

export function estCheminPublic(pathname: string): boolean {
  return pathname === '/' || PUBLICS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/**
 * Rafraîchit le jeton de session à chaque requête (cookies réécrits sur la réponse)
 * et redirige vers /connexion les pages privées consultées sans session.
 */
export async function mettreAJourSession(request: NextRequest): Promise<NextResponse> {
  const config = lireConfigSupabase()
  const publique = estCheminPublic(request.nextUrl.pathname)

  if (!config) {
    return publique ? NextResponse.next() : rediriger(request, '/connexion')
  }

  let reponse = NextResponse.next({ request })
  const supabase = createServerClient<Database>(config.url, config.cle, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(aEcrire) {
        for (const { name, value } of aEcrire) request.cookies.set(name, value)
        reponse = NextResponse.next({ request })
        for (const { name, value, options } of aEcrire) reponse.cookies.set(name, value, options)
      },
    },
  })

  // Ne rien intercaler ici : getClaims() vérifie le jeton (localement avec des clés asymétriques)
  // et rafraîchit la session s'il expire.
  let user: { id: string } | null = null
  try {
    const claims = (await supabase.auth.getClaims()).data?.claims
    user = claims?.sub ? { id: claims.sub } : null
  } catch (e) {
    // Supabase injoignable ou mal configuré : le site reste consultable, la connexion explique.
    console.error('[proxy] session illisible', e instanceof Error ? e.message : e)
  }

  if (!user && !publique) {
    const cible = rediriger(request, '/connexion', request.nextUrl.pathname + request.nextUrl.search)
    for (const c of reponse.cookies.getAll()) cible.cookies.set(c)
    return cible
  }
  return reponse
}

function rediriger(request: NextRequest, chemin: string, suite?: string) {
  const url = request.nextUrl.clone()
  url.pathname = chemin
  url.search = ''
  if (suite && suite !== '/') url.searchParams.set('suite', suite)
  return NextResponse.redirect(url)
}
