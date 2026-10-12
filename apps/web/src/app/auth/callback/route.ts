import { NextResponse, type NextRequest } from 'next/server'
import { suiteSure } from '@/lib/auth'
import { creerClientServeur } from '@/lib/supabase/serveur'

/** Retour des liens email (PKCE) : échange le code contre une session. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const suite = suiteSure(searchParams.get('suite'))
  const retour = (erreur: string) => {
    const url = new URL('/connexion', origin)
    url.searchParams.set('erreur', erreur)
    if (suite !== '/') url.searchParams.set('suite', suite)
    return NextResponse.redirect(url)
  }

  // Lien expiré ou déjà utilisé, signalé par Supabase (error=access_denied&error_code=otp_expired…).
  if (searchParams.get('error')) return retour('lien')

  if (code) {
    const supabase = await creerClientServeur()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(suite, origin))
  }
  return retour('lien')
}
