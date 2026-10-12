/**
 * Factures d'acompte et facture de solde.
 *
 * Un acompte est ventilé sur les taux du devis, au prorata : chaque taux reçoit
 * sa part de base HT. La facture de solde déduit ensuite ces bases, taux par taux.
 */

import { ErreurMontant, exigerEntier, multiplierDiviser, repartir } from './arrondi'
import { calculerDocument, type LigneEntree, type Totaux, type VentilationAcompte } from './calcul'

export type DemandeAcompte =
  /** Pourcentage du devis en points de base : 30 % = 3000. */
  | { pourcentage: number }
  /** Montant TTC souhaité, en centimes. */
  | { montantTtc: number }

function ttcDe(ventilation: readonly VentilationAcompte[]): number {
  return ventilation.reduce((s, v) => s + v.baseHt + multiplierDiviser(v.baseHt, v.taux, 10_000), 0)
}

/** Ventile un acompte sur les taux du devis (hors débours). */
export function ventilerAcompte(devis: Totaux, demande: DemandeAcompte): VentilationAcompte[] {
  const groupes = devis.ventilation.filter((g) => g.categorie !== 'O' && g.baseHt !== 0)
  if (groupes.length === 0) throw new ErreurMontant('Le devis ne contient aucun montant soumis à acompte')

  if ('pourcentage' in demande) {
    exigerEntier(demande.pourcentage, 'Pourcentage d’acompte')
    if (demande.pourcentage <= 0 || demande.pourcentage > 10_000) {
      throw new ErreurMontant('Le pourcentage d’acompte doit être compris entre 0 et 100 %')
    }
    return groupes.map((g) => ({
      categorie: g.categorie,
      taux: g.taux,
      baseHt: multiplierDiviser(g.baseHt, demande.pourcentage, 10_000),
    }))
  }

  exigerEntier(demande.montantTtc, 'Montant d’acompte')
  const ttcDevis = groupes.reduce((s, g) => s + g.baseHt + g.tva, 0)
  if (demande.montantTtc <= 0 || demande.montantTtc > ttcDevis) {
    throw new ErreurMontant('Le montant d’acompte doit être positif et ne pas dépasser le total TTC du devis')
  }
  const parts = repartir(
    demande.montantTtc,
    groupes.map((g) => g.baseHt + g.tva),
  )
  const ventilation = groupes.map((g, i) => ({
    categorie: g.categorie,
    taux: g.taux,
    baseHt: multiplierDiviser(parts[i]!, 10_000, 10_000 + g.taux),
  }))

  // Ajustement au centime. La TVA étant arrondie sur la base, certains montants TTC sont
  // inatteignables (à 20 %, un montant sur six) : on retient alors le plus proche, à 1 centime près.
  for (let essai = 0; essai < 6; essai++) {
    const ecart = demande.montantTtc - ttcDe(ventilation)
    if (ecart === 0) break
    const pas = Math.sign(ecart)
    let meilleur = -1
    let meilleurEcart = Math.abs(ecart)
    ventilation.forEach((v, i) => {
      if (v.baseHt + pas < 0) return
      v.baseHt += pas
      const e = Math.abs(demande.montantTtc - ttcDe(ventilation))
      v.baseHt -= pas
      if (e < meilleurEcart) {
        meilleur = i
        meilleurEcart = e
      }
    })
    if (meilleur < 0) break
    ventilation[meilleur]!.baseHt += pas
  }
  return ventilation
}

/** Lignes d'une facture d'acompte, une par taux. */
export function lignesAcompte(ventilation: readonly VentilationAcompte[], libelle: string): LigneEntree[] {
  return ventilation.map((v, i) => ({
    id: `acompte-${i + 1}`,
    designation: ventilation.length > 1 ? `${libelle} (TVA ${v.taux / 100} %)` : libelle,
    quantite: 1000,
    prixUnitaireHt: v.baseHt,
    categorie: v.categorie,
    taux: v.taux,
    nature: 'service',
  }))
}

/** Totaux d'une facture d'acompte à partir de sa ventilation. */
export function totauxAcompte(ventilation: readonly VentilationAcompte[], libelle: string): Totaux {
  return calculerDocument({ lignes: lignesAcompte(ventilation, libelle) })
}
