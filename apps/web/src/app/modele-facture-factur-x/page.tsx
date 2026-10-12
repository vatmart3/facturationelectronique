import type { Metadata } from 'next'
import { AppelAction, Article, PageSite } from '@/components/site/Site'

export const metadata: Metadata = {
  title: 'Modèle de facture Factur-X : format, profils et exemple',
  description: 'Le format Factur-X expliqué simplement : un PDF/A-3 lisible par vous, et son XML EN 16931 lisible par les logiciels. Profils, contrôles et exemple.',
  robots: { index: true, follow: true },
  alternates: { canonical: '/modele-facture-factur-x' },
}

export default function ModeleFacturX() {
  return (
    <PageSite>
      <Article titre="Modèle de facture Factur-X" chapo="Un seul fichier, deux lectures : un PDF pour les humains, et les mêmes données en XML pour les logiciels.">
        <h2>Le principe</h2>
        <p>
          Une facture Factur-X est un <strong>PDF/A-3</strong> (format d’archivage) qui contient un fichier <strong>factur-x.xml</strong>. Le PDF
          s’ouvre comme n’importe quelle facture ; le XML, structuré selon la norme européenne <strong>EN 16931</strong>, permet à la comptabilité de
          votre client de l’intégrer sans ressaisie.
        </p>
        <h2>Les profils</h2>
        <table>
          <thead>
            <tr>
              <th>Profil</th>
              <th>Contenu</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>MINIMUM, BASIC WL</td>
              <td>En-tête et totaux seulement : insuffisant pour la réforme.</td>
            </tr>
            <tr>
              <td>BASIC</td>
              <td>Avec les lignes de facture.</td>
            </tr>
            <tr>
              <td>EN 16931</td>
              <td>Le profil complet de la norme européenne, celui que produit Pastille.</td>
            </tr>
          </tbody>
        </table>
        <h2>Ce que contient le XML</h2>
        <ul>
          <li>Numéro, date, type (facture, avoir, acompte) et cadre de facturation ;</li>
          <li>vendeur et acheteur : nom, SIREN, numéro de TVA, adresse, adresse électronique ;</li>
          <li>chaque ligne : désignation, quantité, unité, prix, remise, catégorie et taux de TVA ;</li>
          <li>le récapitulatif de TVA par taux, les totaux et le net à payer ;</li>
          <li>les conditions de paiement, l’IBAN et les mentions (pénalités, indemnité de 40 €).</li>
        </ul>
        <h2>Contrôlé avant de partir</h2>
        <p>
          Les factures Pastille sont vérifiées par les schémas officiels et par les règles de la norme EN 16931 et de la réforme française. Le
          total affiché à l’écran, imprimé sur le PDF et inscrit dans le XML est identique au centime près.
        </p>
      </Article>
      <AppelAction />
    </PageSite>
  )
}
