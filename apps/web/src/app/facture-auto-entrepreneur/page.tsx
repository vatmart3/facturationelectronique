import type { Metadata } from 'next'
import { AppelAction, Article, PageSite } from '@/components/site/Site'

export const metadata: Metadata = {
  title: 'Facture auto-entrepreneur : mentions obligatoires et modèle conforme',
  description: 'Comment faire une facture d’auto-entrepreneur conforme : mentions obligatoires, TVA non applicable art. 293 B du CGI, numérotation, et passage à la facture électronique en 2027.',
  robots: { index: true, follow: true },
  alternates: { canonical: '/facture-auto-entrepreneur' },
}

export default function FactureAutoEntrepreneur() {
  return (
    <PageSite>
      <Article titre="Facture auto-entrepreneur : le guide pour être conforme" chapo="Mentions obligatoires, franchise de TVA, numérotation : tout ce qu’une facture de micro-entrepreneur doit contenir, et ce qui change en 2027.">
        <h2>Les mentions obligatoires</h2>
        <ul>
          <li>Votre nom, l’adresse de votre entreprise et votre numéro SIREN ;</li>
          <li>le nom et l’adresse de votre client, et son SIREN s’il est une entreprise ;</li>
          <li>la date d’émission et un numéro unique, dans une suite continue et sans trou ;</li>
          <li>la date de la vente ou de la prestation ;</li>
          <li>pour chaque ligne : désignation, quantité, prix unitaire hors taxes ;</li>
          <li>le total à payer, la date d’échéance, les pénalités de retard et, pour un client professionnel, l’indemnité forfaitaire de 40 € ;</li>
          <li>la catégorie de l’opération : livraison de biens, prestation de services, ou les deux.</li>
        </ul>
        <h2>La TVA en franchise</h2>
        <p>
          Si vous bénéficiez de la franchise en base, vous ne facturez pas de TVA et la facture doit porter la mention{' '}
          <strong>« TVA non applicable, art. 293 B du CGI »</strong>. Pastille l’ajoute automatiquement selon le régime choisi.
        </p>
        <h2>La numérotation</h2>
        <p>
          Chaque facture a un numéro unique, attribué dans l’ordre chronologique, sans trou ni doublon. Une facture émise ne se modifie plus : une
          erreur se corrige par un avoir.
        </p>
        <h2>Et en 2027 ?</h2>
        <p>
          À partir du 1er septembre 2027, les micro-entrepreneurs émettent leurs factures entre professionnels au format électronique (Factur-X,
          UBL ou CII), via une plateforme agréée. Les ventes aux particuliers sont déclarées par l’e-reporting.
        </p>
      </Article>
      <AppelAction titre="Votre première facture conforme en 30 secondes" />
    </PageSite>
  )
}
