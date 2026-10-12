'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

/** Client Supabase du navigateur (envoi de fichiers vers le stockage). */
export function creerClientNavigateur() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const cle = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !cle) throw new Error('Supabase n’est pas configuré.')
  return createBrowserClient<Database>(url, cle)
}

export { urlPublique } from './stockage'
