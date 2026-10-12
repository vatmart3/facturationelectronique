import { describe, expect, it } from 'vitest'
import { lignesAcompte, totauxAcompte, ventilerAcompte } from './acompte'
import { calculerDocument, type LigneEntree } from './calcul'

const devis = calculerDocument({
  lignes: [
    { id: 'a', designation: 'Création', quantite: 1000, prixUnitaireHt: 100_000, categorie: 'S', taux: 2000, nature: 'service' },
    { id: 'b', designation: 'Livres', quantite: 1000, prixUnitaireHt: 20_000, categorie: 'S', taux: 550, nature: 'bien' },
    { id: 'c', designation: 'Débours', quantite: 1000, prixUnitaireHt: 3_000, categorie: 'O', taux: 0, nature: 'debours' },
  ] satisfies LigneEntree[],
})

describe('acompte en pourcentage', () => {
  it('ventile le pourcentage sur chaque taux, hors débours', () => {
    expect(ventilerAcompte(devis, { pourcentage: 3000 })).toEqual([
      { categorie: 'S', taux: 2000, baseHt: 30_000 },
      { categorie: 'S', taux: 550, baseHt: 6_000 },
    ])
  })
  it('refuse 0 % et plus de 100 %', () => {
    expect(() => ventilerAcompte(devis, { pourcentage: 0 })).toThrow(/entre 0 et 100/)
    expect(() => ventilerAcompte(devis, { pourcentage: 10_001 })).toThrow(/entre 0 et 100/)
    expect(() => ventilerAcompte(devis, { pourcentage: 12.5 })).toThrow()
  })
})

describe('acompte en montant TTC', () => {
  it.each([100_000, 33_333, 1, 4, 10, 11, 18, 50_001, 141_100])('produit exactement %i centimes TTC', (montant) => {
    const ventilation = ventilerAcompte(devis, { montantTtc: montant })
    expect(totauxAcompte(ventilation, 'Acompte').totalTtc).toBe(montant)
  })
  it('reste à un centime près quand le montant est inatteignable', () => {
    // 3 centimes : 3 de base à 20 % donnent 4, 2 donnent 2 ; aucune combinaison ne donne 3.
    expect(totauxAcompte(ventilerAcompte(devis, { montantTtc: 3 }), 'Acompte').totalTtc).toBe(4)
    for (let montant = 1; montant <= 3_000; montant += 1) {
      const ttc = totauxAcompte(ventilerAcompte(devis, { montantTtc: montant }), 'Acompte').totalTtc
      expect(Math.abs(ttc - montant)).toBeLessThanOrEqual(1)
    }
  })
  it('refuse un montant nul ou supérieur au devis', () => {
    expect(() => ventilerAcompte(devis, { montantTtc: 0 })).toThrow(/positif/)
    expect(() => ventilerAcompte(devis, { montantTtc: 141_101 })).toThrow(/dépasser/)
  })
  it('refuse un devis sans montant taxable', () => {
    const vide = calculerDocument({ lignes: [] })
    expect(() => ventilerAcompte(vide, { pourcentage: 3000 })).toThrow(/aucun montant/)
  })
})

describe('lignes d’une facture d’acompte', () => {
  it('crée une ligne par taux, avec le taux dans le libellé s’il y en a plusieurs', () => {
    const lignes = lignesAcompte(ventilerAcompte(devis, { pourcentage: 3000 }), 'Acompte de 30 % sur devis D-2026-0018')
    expect(lignes.map((l) => [l.designation, l.prixUnitaireHt])).toEqual([
      ['Acompte de 30 % sur devis D-2026-0018 (TVA 20 %)', 30_000],
      ['Acompte de 30 % sur devis D-2026-0018 (TVA 5.5 %)', 6_000],
    ])
  })
  it('garde le libellé simple s’il n’y a qu’un taux', () => {
    const lignes = lignesAcompte([{ categorie: 'S', taux: 2000, baseHt: 10_000 }], 'Acompte')
    expect(lignes[0]!.designation).toBe('Acompte')
  })
  it('la facture de solde retombe sur le total du devis', () => {
    const ventilation = ventilerAcompte(devis, { pourcentage: 3000 })
    const acompte = totauxAcompte(ventilation, 'Acompte')
    const solde = calculerDocument({
      lignes: [
        { id: 'a', designation: 'Création', quantite: 1000, prixUnitaireHt: 100_000, categorie: 'S', taux: 2000, nature: 'service' },
        { id: 'b', designation: 'Livres', quantite: 1000, prixUnitaireHt: 20_000, categorie: 'S', taux: 550, nature: 'bien' },
        { id: 'c', designation: 'Débours', quantite: 1000, prixUnitaireHt: 3_000, categorie: 'O', taux: 0, nature: 'debours' },
      ],
      acomptes: [{ numero: 'F-2026-0040', ventilation }],
    })
    expect(acompte.totalTtc + solde.totalTtc).toBe(devis.totalTtc)
  })
})
