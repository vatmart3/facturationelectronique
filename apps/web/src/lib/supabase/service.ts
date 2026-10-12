import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

/**
 * Client « service » pour les tâches planifiées (relances, récurrences) : contourne la RLS.
 * N'est jamais utilisé dans une requête d'utilisateur. Null si la clé n'est pas configurée.
 */
export function creerClientService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
  if (!url || !cle) return null
  return createClient<Database>(url, cle, { auth: { persistSession: false, autoRefreshToken: false } })
}
