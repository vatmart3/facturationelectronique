import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { exigerConfigSupabase } from './env'
import type { Database } from './types'

/** Client Supabase côté serveur (composants serveur, actions, routes), lié aux cookies de session. */
export async function creerClientServeur() {
  // Lire les cookies d'abord : la route devient dynamique avant toute vérification de config.
  const magasin = await cookies()
  const { url, cle } = exigerConfigSupabase()
  return createServerClient<Database>(url, cle, {
    cookies: {
      getAll() {
        return magasin.getAll()
      },
      setAll(aEcrire) {
        try {
          for (const { name, value, options } of aEcrire) magasin.set(name, value, options)
        } catch {
          // Appel depuis un composant serveur : le proxy se charge de rafraîchir la session.
        }
      },
    },
  })
}
