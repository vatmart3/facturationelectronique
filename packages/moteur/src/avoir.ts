/**
 * Avoirs : lignes en négatif, toujours rattachées à la facture d'origine.
 * L'arrondi symétrique garantit qu'un avoir total vaut exactement −facture.
 */

import { ErreurMontant, exigerEntier, multiplierDiviser } from './arrondi'
import type { LigneEntree, Remise } from './calcul'

function inverserRemise(remise: Remise | undefined): Remise | undefined {
  if (!remise || remise.type === 'pourcentage') return remise
  return { type: 'montant', valeur: -remise.valeur }
}

/**
 * Lignes d'un avoir. Sans sélection : avoir total. Avec sélection : identifiant de ligne →
 * quantité à créditer (en millièmes, positive, au plus la quantité facturée).
 */
export function lignesAvoir(lignes: readonly LigneEntree[], selection?: Readonly<Record<string, number>>): LigneEntree[] {
  const resultat: LigneEntree[] = []
  for (const ligne of lignes) {
    let quantite = ligne.quantite
    if (selection) {
      const choisie = selection[ligne.id]
      if (choisie === undefined) continue
      exigerEntier(choisie, `Avoir, ligne ${ligne.id} : quantité`)
      if (choisie <= 0 || choisie > Math.abs(ligne.quantite)) {
        throw new ErreurMontant(`Avoir, ligne ${ligne.id} : quantité supérieure à la quantité facturée`)
      }
      quantite = choisie * Math.sign(ligne.quantite)
    }
    // Une remise en montant est proratisée sur la quantité créditée.
    const remise: Remise | undefined =
      ligne.remise?.type === 'montant' && quantite !== ligne.quantite
        ? { type: 'montant', valeur: -multiplierDiviser(ligne.remise.valeur, quantite, ligne.quantite) }
        : inverserRemise(ligne.remise)
    resultat.push({
      ...ligne,
      id: `avoir-${ligne.id}`,
      quantite: -quantite,
      remise,
    })
  }
  if (resultat.length === 0) throw new ErreurMontant('Sélectionnez au moins une ligne à créditer')
  return resultat
}

export function remiseGlobaleAvoir(remise: Remise | undefined): Remise | undefined {
  return inverserRemise(remise)
}
