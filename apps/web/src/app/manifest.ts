import type { MetadataRoute } from 'next'

/** Application installable (écran d'accueil du téléphone, fenêtre dédiée sur ordinateur). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pastille · Facturation électronique',
    short_name: 'Pastille',
    description: 'Devis, factures conformes, relances et facturation électronique 2027.',
    lang: 'fr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f7f8fa',
    theme_color: '#0f1d33',
    icons: [
      { src: '/icones/icone-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icones/icone-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icones/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Nouvelle facture', url: '/?raccourci=facture' },
      { name: 'Tableau de bord', url: '/' },
    ],
  }
}
