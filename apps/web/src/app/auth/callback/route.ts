import { NextResponse, type NextRequest } from 'next/server'
import { suiteSure } from '@/lib/auth'
import { creerClientServeur } from '@/lib/supabase/serveur'

/** Retour des liens email (PKCE) et de Google : échange le code contre une session. */
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

  // Refus ou annulation chez Google (ou lien invalide signalé par Supabase).
  const refus = searchParams.get('error')
  if (refus) {
    // Supabase signale aussi un lien email expiré par error=access_denied : le code d'erreur les distingue.
    const codeErreur = searchParams.get('error_code')
    return retour(codeErreur === 'otp_expired' || codeErreur === 'flow_state_expired' ? 'lien' : refus === 'access_denied' ? 'annule' : 'google')
  }

  if (code) {
    const supabase = await creerClientServeur()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(suite, origin))
  }
  return retour('lien')
}
