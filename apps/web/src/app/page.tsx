import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Accueil, FAQ } from '@/components/site/Accueil'
import { listerOrganisations, lireUtilisateur } from '@/lib/session'
import { lireConfigSupabase } from '@/lib/supabase/env'

export const metadata: Metadata = {
  title: { absolute: 'Pastille · Facturation électronique conforme 2027 pour indépendants et TPE' },
  description:
    'Créez une facture conforme en 30 secondes : Factur-X EN 16931, plateforme agréée, e-reporting, relances et devis signés en ligne. Essai gratuit de 14 jours sans carte.',
  robots: { index: true, follow: true },
  alternates: { canonical: '/' },
  openGraph: { title: 'Pastille · Une facture conforme en 30 secondes', type: 'website', locale: 'fr_FR' },
}

/** Visiteur : page d'accueil. Utilisateur connecté : son tableau de bord. */
export default async function Racine() {
  if (lireConfigSupabase()) {
    let destination: string | null = null
    try {
      const utilisateur = await lireUtilisateur()
      if (utilisateur) {
        const organisations = await listerOrganisations()
        destination = organisations[0] ? `/${organisations[0].slug}/tableau-de-bord` : '/bienvenue'
      }
    } catch (e) {
      // Supabase injoignable : la page d'accueil reste affichée.
      console.error('[accueil] session illisible', e instanceof Error ? e.message : e)
    }
    if (destination) redirect(destination)
  }
  const donnees = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(([q, r]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: r } })),
  }
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(donnees) }} />
      <Accueil />
    </>
  )
}
