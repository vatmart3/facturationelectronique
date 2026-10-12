import 'server-only'
import { lireConfigSupabase } from './env'

export interface ReglagesAuth {
  /** Fournisseur Google activé dans Supabase (Authentication > Providers). */
  google: boolean
  /** Les nouveaux comptes doivent confirmer leur adresse avant de se connecter. */
  confirmationEmail: boolean
}

/**
 * Réglages publics du service d'authentification (GET /auth/v1/settings), mis en cache une minute.
 * Sert à n'afficher « Continuer avec Google » que si le fournisseur est réellement activé :
 * sinon le bouton mènerait à une page d'erreur de Supabase. Null si le service ne répond pas.
 */
export async function lireReglagesAuth(): Promise<ReglagesAuth | null> {
  const config = lireConfigSupabase()
  if (!config) return null
  try {
    const r = await fetch(`${config.url}/auth/v1/settings`, {
      headers: { apikey: config.cle },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(3000),
    })
    if (!r.ok) return null
    const s = (await r.json()) as { external?: Record<string, boolean>; mailer_autoconfirm?: boolean }
    return { google: Boolean(s.external?.google), confirmationEmail: !s.mailer_autoconfirm }
  } catch {
    return null
  }
}
