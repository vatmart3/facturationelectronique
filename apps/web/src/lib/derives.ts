/**
 * Documents dérivés d'un autre : avoir d'une facture, facture d'acompte d'un devis,
 * facture de solde (devis transformé, acomptes déduits). Pur et testé.
 */

import { lignesAcompte, remiseGlobaleAvoir, ventilerAcompte, type DeductionAcompte, type DemandeAcompte, type Remise } from '@pastille/moteur'
import { ajouterJours, calculer, copierLignes, ligneVide, type DocumentEdition, type LigneEdition } from './document'

function inverserRemiseLigne(r: Remise | null): Remise | null {
  if (!r || r.type === 'pourcentage') return r
  return { type: 'montant', valeur: -r.valeur }
}

/** Avoir total d'une facture : lignes en quantités négatives ; les acomptes déjà déduits sont réintégrés. */
export function avoirDepuis(facture: DocumentEdition, factureId: string, jour: string): DocumentEdition {
  const lignes = copierLignes(facture.lignes).map((l) => ({ ...l, quantite: -l.quantite, remise: inverserRemiseLigne(l.remise) }))
  const reintegres = facture.acomptes.flatMap((a) =>
    a.ventilation.map((v) =>
      ligneVide({
        designation: `Acompte ${a.numero} déjà facturé`,
        prixUnitaireHt: v.baseHt,
        categorie: v.categorie,
        taux: v.taux,
        unite: 'forfait',
      }),
    ),
  )
  return {
    ...facture,
    id: '',
    type: 'avoir',
    issueDate: jour,
    validUntil: null,
    purchaseOrder: facture.purchaseOrder,
    internalNotes: '',
    publicNotes: '',
    remise: remiseGlobaleAvoir(facture.remise ?? undefined) ?? null,
    lignes: [...lignes, ...reintegres],
    acomptes: [],
    originDocumentId: factureId,
  }
}

/** Facture d'acompte d'un devis, ventilée sur ses taux de TVA. */
export function acompteDepuis(
  devis: DocumentEdition,
  devisId: string,
  numeroDevis: string,
  demande: DemandeAcompte,
  jour: string,
): { ok: true; doc: DocumentEdition } | { ok: false; erreur: string } {
  const calcul = calculer(devis)
  if (!calcul.ok) return calcul
  let ventilation
  try {
    ventilation = ventilerAcompte(calcul.totaux, demande)
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : 'Acompte impossible.' }
  }
  const libelle =
    'pourcentage' in demande
      ? `Acompte de ${(demande.pourcentage / 100).toString().replace('.', ',')} % sur le devis ${numeroDevis}`
      : `Acompte sur le devis ${numeroDevis}`
  const lignes: LigneEdition[] = lignesAcompte(ventilation, libelle).map((l) =>
    ligneVide({ designation: l.designation, prixUnitaireHt: l.prixUnitaireHt, categorie: l.categorie, taux: l.taux, unite: 'forfait', nature: 'service' }),
  )
  // Mentions d'exonération reprises des lignes du devis pour les catégories sans TVA.
  for (const l of lignes) {
    if (l.categorie !== 'S' && l.categorie !== 'Z') l.motif = devis.lignes.find((x) => x.categorie === l.categorie)?.motif ?? null
  }
  return {
    ok: true,
    doc: {
      ...devis,
      id: '',
      type: 'acompte',
      issueDate: jour,
      validUntil: null,
      serviceDate: null,
      servicePeriodStart: null,
      servicePeriodEnd: null,
      internalNotes: '',
      remise: null,
      lignes,
      acomptes: [],
      originDocumentId: devisId,
    },
  }
}

export interface AcompteEmis {
  number: string
  vat: Array<{ vat_category: DeductionAcompte['ventilation'][number]['categorie']; vat_rate: number; base_cents: number }>
}

/** Acomptes émis à déduire de la facture de solde. */
export function deductions(acomptes: readonly AcompteEmis[]): DeductionAcompte[] {
  return acomptes.map((a) => ({
    numero: a.number,
    ventilation: a.vat.filter((v) => v.base_cents > 0).map((v) => ({ categorie: v.vat_category, taux: v.vat_rate, baseHt: Number(v.base_cents) })),
  }))
}

/** Facture issue d'un devis (ou duplication d'un document), datée du jour. */
export function factureDepuis(source: DocumentEdition, sourceId: string, jour: string, acomptes: DeductionAcompte[] = []): DocumentEdition {
  const depuisDevis = source.type === 'devis'
  return {
    ...source,
    id: '',
    type: 'facture',
    issueDate: jour,
    validUntil: null,
    internalNotes: '',
    lignes: copierLignes(source.lignes),
    acomptes: depuisDevis ? acomptes : [],
    originDocumentId: depuisDevis ? sourceId : null,
  }
}

/** Copie à l'identique en nouveau brouillon (même type), sans lien. */
export function copieDe(source: DocumentEdition, jour: string): DocumentEdition {
  const type = source.type === 'acompte' || source.type === 'avoir' ? 'facture' : source.type
  return {
    ...source,
    id: '',
    type,
    issueDate: jour,
    validUntil: type === 'devis' ? ajouterJours(jour, 30) : null,
    internalNotes: '',
    lignes: copierLignes(source.lignes),
    acomptes: [],
    originDocumentId: null,
  }
}
