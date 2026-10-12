import 'server-only'
import { headers } from 'next/headers'

/** Adresse publique du site : NEXT_PUBLIC_SITE_URL, l'URL de production Vercel, sinon l'hôte de la requête. */
export async function origineSite(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  try {
    const h = await headers()
    const hote = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
    const proto = h.get('x-forwarded-proto') ?? (hote.startsWith('localhost') ? 'http' : 'https')
    return `${proto}://${hote}`
  } catch {
    return 'http://localhost:3000'
  }
}
