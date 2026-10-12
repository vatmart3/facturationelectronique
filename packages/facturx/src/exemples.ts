/** Factures d'exemple couvrant les cas de la norme : taux multiples, remises, UE, avoir, acompte. */

import type { Facture, Partie } from './modele'

export const VENDEUR: Partie = {
  nom: 'Atelier Lumen',
  siren: '732829320',
  siret: '73282932000074',
  tva: 'FR44732829320',
  mentionsJuridiques: 'SAS au capital de 10 000 € · RCS Paris 732 829 320',
  adresse: { ligne1: '12 rue des Lilas', ligne2: null, codePostal: '75011', ville: 'Paris', pays: 'FR' },
  adresseElectronique: { valeur: '732829320', schema: '0225' },
}

export const ACHETEUR: Partie = {
  nom: 'Atelier Dupont',
  siren: '404833048',
  siret: null,
  tva: 'FR83404833048',
  mentionsJuridiques: null,
  adresse: { ligne1: '3 place du Marché', ligne2: 'Bâtiment B', codePostal: '69002', ville: 'Lyon', pays: 'FR' },
  adresseElectronique: { valeur: '404833048', schema: '0225' },
}

const NOTES = [
  { texte: 'Pénalités de retard : taux BCE majoré de 10 points', sujet: 'PMD' as const },
  { texte: 'Indemnité forfaitaire pour frais de recouvrement : 40 €', sujet: 'PMT' as const },
  { texte: 'Pas d’escompte pour paiement anticipé', sujet: 'AAB' as const },
]

/** 2 × 420 € à 20 % avec 10 % de remise de ligne, 100 € à 5,5 %, remise globale 50 € répartie. */
export function factureMultiTaux(): Facture {
  return {
    numero: 'F-2026-0042',
    cadre: 'M1',
    type: '380',
    dateEmission: '2026-10-12',
    dateEcheance: '2026-11-11',
    devise: 'EUR',
    referenceAcheteur: null,
    commande: 'BC-77',
    notes: NOTES,
    facturePrecedente: null,
    vendeur: VENDEUR,
    acheteur: ACHETEUR,
    dateLivraison: '2026-10-10',
    periode: null,
    paysLivraison: null,
    paiement: { moyen: '58', iban: 'FR7630006000011234567890189', bic: 'AGRIFRPP', reference: 'F-2026-0042', conditions: '30 jours' },
    lignes: [
      {
        id: '1',
        designation: 'Création logo',
        description: 'Trois pistes & déclinaisons <web>',
        quantite: 2000,
        unite: 'C62',
        prixUnitaire: 42000,
        remise: { montant: 8400, motif: 'Remise' },
        montantNet: 75600,
        categorie: 'S',
        taux: 2000,
      },
      { id: '2', designation: 'Livre', description: null, quantite: 1000, unite: 'H87', prixUnitaire: 10000, remise: null, montantNet: 10000, categorie: 'S', taux: 550 },
    ],
    remises: [
      { montant: 4417, motif: 'Remise globale', categorie: 'S', taux: 2000 },
      { montant: 583, motif: 'Remise globale', categorie: 'S', taux: 550 },
    ],
    ventilation: [
      { categorie: 'S', taux: 2000, base: 71183, montant: 14237, motif: null, codeMotif: null },
      { categorie: 'S', taux: 550, base: 9417, montant: 518, motif: null, codeMotif: null },
    ],
    totaux: { lignes: 85600, remises: 5000, ht: 80600, tva: 14755, ttc: 95355, dejaPaye: 0, net: 95355 },
  }
}

/** Prestation de services à une entreprise allemande : autoliquidation. */
export function factureAutoliquidation(): Facture {
  return {
    ...factureMultiTaux(),
    numero: 'F-2026-0043',
    cadre: 'S1',
    commande: null,
    acheteur: {
      ...ACHETEUR,
      nom: 'Müller GmbH',
      siren: null,
      tva: 'DE123456789',
      adresse: { ligne1: 'Hauptstraße 1', ligne2: null, codePostal: '10115', ville: 'Berlin', pays: 'DE' },
      adresseElectronique: { valeur: 'rechnung@mueller.de', schema: 'EM' },
    },
    lignes: [{ id: '1', designation: 'Conseil', description: null, quantite: 1500, unite: 'HUR', prixUnitaire: 12000, remise: null, montantNet: 18000, categorie: 'AE', taux: 0 }],
    remises: [],
    ventilation: [{ categorie: 'AE', taux: 0, base: 18000, montant: 0, motif: 'Autoliquidation, art. 283-2 du CGI', codeMotif: 'VATEX-EU-AE' }],
    totaux: { lignes: 18000, remises: 0, ht: 18000, tva: 0, ttc: 18000, dejaPaye: 0, net: 18000 },
  }
}

/** Avoir total de la facture multi-taux : montants positifs, type 381, facture précédente. */
export function avoir(): Facture {
  const f = factureMultiTaux()
  return { ...f, numero: 'A-2026-0001', type: '381', dateEcheance: null, facturePrecedente: { numero: 'F-2026-0042', date: '2026-10-12' }, paiement: { ...f.paiement, conditions: null } }
}

/** Facture de solde : un acompte de 300 € HT à 20 % déduit au niveau du document. */
export function factureSolde(): Facture {
  return {
    ...factureMultiTaux(),
    numero: 'F-2026-0050',
    cadre: 'S4',
    lignes: [{ id: '1', designation: 'Site vitrine', description: null, quantite: 1000, unite: 'LS', prixUnitaire: 100000, remise: null, montantNet: 100000, categorie: 'S', taux: 2000 }],
    remises: [{ montant: 30000, motif: 'Acompte F-2026-0044 déjà facturé', categorie: 'S', taux: 2000 }],
    ventilation: [{ categorie: 'S', taux: 2000, base: 70000, montant: 14000, motif: null, codeMotif: null }],
    totaux: { lignes: 100000, remises: 30000, ht: 70000, tva: 14000, ttc: 84000, dejaPaye: 0, net: 84000 },
  }
}
