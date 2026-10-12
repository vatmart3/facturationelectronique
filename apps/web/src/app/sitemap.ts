import type { MetadataRoute } from 'next'
import { TEXTES } from '@/lib/legal'

const BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000')).replace(/\/$/, '')

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ['', '/tarifs', '/facturation-electronique-2027', '/facture-auto-entrepreneur', '/modele-facture-factur-x', ...TEXTES.map((t) => `/legal/${t.slug}`)]
  return pages.map((p) => ({ url: `${BASE}${p}`, changeFrequency: 'monthly', priority: p === '' ? 1 : p.startsWith('/legal') ? 0.2 : 0.7 }))
}
