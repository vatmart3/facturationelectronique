import type { Metadata } from 'next'
import Link from 'next/link'
import { AppelAction, Article, PageSite } from '@/components/site/Site'
import { EMISSION_PME_TPE, joursAvant } from '@/lib/reforme'

export const metadata: Metadata = {
  title: 'Facturation électronique 2027 : calendrier, obligations, sanctions',
  description: 'Ce que la réforme de la facturation électronique change pour les PME, TPE et indépendants : réception dès 2026, émission en septembre 2027, e-reporting, plateformes agréées.',
  robots: { index: true, follow: true },
  alternates: { canonical: '/facturation-electronique-2027' },
}

export default function Reforme2027() {
  return (
    <PageSite>
      <Article
        titre="Facturation électronique 2027 : ce qui change pour vous"
        chapo={`Au 1er septembre 2027, les PME, TPE et micro-entreprises devront émettre leurs factures au format électronique. Il reste ${joursAvant(EMISSION_PME_TPE)} jours.`}
      >
        <h2>Le calendrier</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Obligation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1er septembre 2026</td>
              <td>Toutes les entreprises reçoivent des factures électroniques. Les grandes entreprises et les ETI les émettent.</td>
            </tr>
            <tr>
              <td>1er septembre 2027</td>
              <td>PME, TPE et micro-entreprises émettent à leur tour et transmettent leur e-reporting.</td>
            </tr>
          </tbody>
        </table>
        <h2>Une facture électronique, c’est quoi ?</h2>
        <p>
          Ce n’est pas un PDF envoyé par email. C’est une facture <strong>structurée</strong>, lisible par une machine, dans l’un des trois formats
          reconnus : <strong>Factur-X</strong> (un PDF qui contient ses données en XML), <strong>UBL</strong> ou <strong>CII</strong>. Elle doit
          respecter la norme européenne EN 16931.
        </p>
        <h2>Les plateformes agréées</h2>
        <p>
          Les factures entre entreprises françaises passent par une <strong>plateforme agréée</strong> (PA), immatriculée par l’administration.
          Elle transmet vos factures à la plateforme de votre client, reçoit les vôtres, suit leur statut (déposée, reçue, approuvée, refusée,
          encaissée) et communique à l’administration les données utiles.
        </p>
        <h2>L’e-reporting</h2>
        <p>
          Les ventes aux particuliers et à l’étranger ne passent pas par la facture électronique : leurs montants sont déclarés par
          l’e-reporting, par période, avec les encaissements des prestations de services.
        </p>
        <h2>Les sanctions</h2>
        <ul>
          <li>15 € par facture non émise au format électronique, plafonné à 15 000 € par an ;</li>
          <li>250 € par manquement à l’e-reporting, plafonné à 15 000 € par an.</li>
        </ul>
        <h2>Comment s’y préparer</h2>
        <ul>
          <li>Vérifier le SIREN et l’adresse de chaque client professionnel : ils deviennent obligatoires.</li>
          <li>Choisir une solution qui produit des factures Factur-X conformes et se connecte à une plateforme agréée.</li>
          <li>Prévoir la catégorie de l’opération (biens, services) et l’adresse de livraison sur les factures.</li>
        </ul>
        <p>
          <Link href="/modele-facture-factur-x">Voir ce que contient une facture Factur-X</Link>
        </p>
      </Article>
      <AppelAction />
    </PageSite>
  )
}
