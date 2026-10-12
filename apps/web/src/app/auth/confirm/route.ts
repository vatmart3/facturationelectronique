import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { suiteSure } from '@/lib/auth'
import { creerClientServeur } from '@/lib/supabase/serveur'

const TYPES: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email']

/** Liens email au format token_hash (modèles d'email Supabase personnalisés, voir README). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const suite = suiteSure(searchParams.get('suite'), type === 'recovery' ? '/mot-de-passe/nouveau' : '/')

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await creerClientServeur()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return NextResponse.redirect(new URL(suite, origin))
  }
  return NextResponse.redirect(new URL('/connexion?erreur=lien', origin))
}
