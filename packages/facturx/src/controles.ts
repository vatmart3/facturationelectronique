/**
 * Contrôles EN 16931 et BR-FR essentiels, exécutés avant de produire le XML.
 * Les jeux de règles officiels (Schematron) sont appliqués dans les tests et la CI ;
 * ceux-ci couvrent les erreurs qu'un utilisateur peut réellement provoquer.
 */

import type { Facture } from './modele'

export interface Anomalie {
  regle: string
  message: string
  /** Bloquante : le XML serait rejeté. Sinon : avertissement (transmission par plateforme). */
  bloquant: boolean
}

const SANS_TVA = new Set(['Z', 'E', 'AE', 'K', 'G', 'O'])

export function controler(f: Facture): Anomalie[] {
  const a: Anomalie[] = []
  const ajouter = (regle: string, message: string, bloquant = true) => a.push({ regle, message, bloquant })

  if (!f.numero) ajouter('BR-02', 'Numéro de facture absent.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.dateEmission)) ajouter('BR-03', 'Date d’émission absente ou invalide.')
  if (!/^[A-Z]{3}$/.test(f.devise)) ajouter('BR-05', 'Devise invalide.')
  if (!f.vendeur.nom) ajouter('BR-06', 'Nom du vendeur absent.')
  if (!f.acheteur.nom) ajouter('BR-07', 'Nom de l’acheteur absent.')
  if (!f.vendeur.adresse.pays) ajouter('BR-09', 'Pays du vendeur absent.')
  if (!f.acheteur.adresse.pays) ajouter('BR-11', 'Pays de l’acheteur absent.')
  if (f.lignes.length === 0) ajouter('BR-16', 'Au moins une ligne est requise.')
  if (f.type === '381' && !f.facturePrecedente) ajouter('BR-55', 'Un avoir doit référencer la facture d’origine.', false)

  // Totaux
  const somme = (xs: number[]) => xs.reduce((s, x) => s + x, 0)
  if (somme(f.lignes.map((l) => l.montantNet)) !== f.totaux.lignes) ajouter('BR-CO-10', 'Le total des lignes ne correspond pas à la somme des lignes.')
  if (somme(f.remises.map((r) => r.montant)) !== f.totaux.remises) ajouter('BR-CO-11', 'Le total des remises ne correspond pas à la somme des remises.')
  if (f.totaux.lignes - f.totaux.remises !== f.totaux.ht) ajouter('BR-CO-13', 'Total HT incohérent.')
  if (somme(f.ventilation.map((g) => g.montant)) !== f.totaux.tva) ajouter('BR-CO-14', 'Total de TVA différent de la somme des taux.')
  if (f.totaux.ht + f.totaux.tva !== f.totaux.ttc) ajouter('BR-CO-15', 'Total TTC incohérent.')
  if (f.totaux.ttc - f.totaux.dejaPaye !== f.totaux.net) ajouter('BR-CO-16', 'Net à payer incohérent.')

  // Ventilation par catégorie et taux
  for (const g of f.ventilation) {
    const memes = <T extends { categorie?: string; taux?: number }>(x: T) => x.categorie === g.categorie && (SANS_TVA.has(g.categorie) || x.taux === g.taux)
    const base = somme(f.lignes.filter(memes).map((l) => l.montantNet)) - somme(f.remises.filter(memes).map((r) => r.montant))
    if (base !== g.base) ajouter(`BR-${g.categorie}-08`, `Base de TVA ${g.categorie} ${g.taux / 100} % incohérente avec les lignes.`)
    if (SANS_TVA.has(g.categorie) && g.montant !== 0) ajouter(`BR-${g.categorie}-09`, `Aucune TVA ne peut être due en catégorie ${g.categorie}.`)
    if (SANS_TVA.has(g.categorie) && g.categorie !== 'Z' && !g.motif && !g.codeMotif) {
      ajouter(`BR-${g.categorie}-10`, `Motif d’exonération manquant pour la catégorie ${g.categorie}.`)
    }
  }

  const categories = new Set(f.lignes.map((l) => l.categorie))
  if (categories.has('AE') && (!f.vendeur.tva || (!f.acheteur.tva && !f.acheteur.siren))) {
    ajouter('BR-AE-02', 'Autoliquidation : les numéros de TVA du vendeur et de l’acheteur sont requis.')
  }
  if (categories.has('K')) {
    if (!f.vendeur.tva || !f.acheteur.tva) ajouter('BR-IC-02', 'Livraison intracommunautaire : numéros de TVA du vendeur et de l’acheteur requis.')
    if (!f.dateLivraison && !f.periode) ajouter('BR-IC-11', 'Livraison intracommunautaire : date de livraison ou période requise.')
    if (!f.paysLivraison) ajouter('BR-IC-12', 'Livraison intracommunautaire : pays de livraison requis.')
  }
  if (categories.has('G') && !f.vendeur.tva) ajouter('BR-G-02', 'Exportation : numéro de TVA du vendeur requis.')
  if (categories.has('O') && categories.size > 1) {
    ajouter('BR-O-11', 'Débours mêlés à des lignes soumises à TVA : non représentable en EN 16931. Facturez les débours séparément.')
  }
  if (categories.has('O') && (f.vendeur.tva || f.acheteur.tva)) {
    ajouter('BR-O-02', 'Opération hors champ : la facture ne doit pas porter de numéro de TVA.', false)
  }

  // Réforme française (BR-FR, flux 2) : avertissements pour la transmission via la plateforme.
  if (f.vendeur.adresse.pays === 'FR' && !f.vendeur.siren) ajouter('BR-FR-10', 'SIREN du vendeur requis.')
  if (!f.vendeur.adresseElectronique) ajouter('BR-FR-13', 'Adresse électronique du vendeur (BT-34) absente.', false)
  if (!f.acheteur.adresseElectronique) ajouter('BR-FR-12', 'Adresse électronique de l’acheteur (BT-49) absente : renseignez-la sur la fiche client.', false)
  if (f.acheteur.adresse.pays === 'FR' && !f.acheteur.siren && f.acheteur.tva) {
    ajouter('BR-FR-11', 'SIREN de l’acheteur requis pour une entreprise française.', false)
  }
  return a
}
