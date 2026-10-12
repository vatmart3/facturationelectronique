import { NextResponse, type NextRequest } from 'next/server'
import { suiteSure } from '@/lib/auth'
import { creerClientServeur } from '@/lib/supabase/serveur'

/** Retour des liens email (PKCE) et de Google : échange le code contre une session. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const suite = suiteSure(searchParams.get('suite'))

  if (code) {
    const supabase = await creerClientServeur()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(suite, origin))
  }
  return NextResponse.redirect(new URL('/connexion?erreur=lien', origin))
}
