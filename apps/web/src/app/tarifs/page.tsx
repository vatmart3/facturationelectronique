import type { Metadata } from 'next'
import { Tarifs } from '@/components/site/Accueil'
import { AppelAction, PageSite } from '@/components/site/Site'

export const metadata: Metadata = {
  title: 'Tarifs',
  description: 'Pastille Solo, Pro et Studio : factures conformes à la réforme, plateforme agréée, e-reporting. Essai gratuit de 14 jours, sans engagement.',
  robots: { index: true, follow: true },
  alternates: { canonical: '/tarifs' },
}

export default function PageTarifs() {
  return (
    <PageSite>
      <Tarifs titre="Tarifs" />
      <AppelAction />
    </PageSite>
  )
}
