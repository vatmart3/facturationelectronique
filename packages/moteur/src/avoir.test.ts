import { describe, expect, it } from 'vitest'
import { lignesAvoir, remiseGlobaleAvoir } from './avoir'
import { calculerDocument, type LigneEntree } from './calcul'

const lignes: LigneEntree[] = [
  { id: 'a', designation: 'Conseil', quantite: 2500, prixUnitaireHt: 8_333, categorie: 'S', taux: 2000, nature: 'service', remise: { type: 'pourcentage', valeur: 750 } },
  { id: 'b', designation: 'Fournitures', quantite: 4000, prixUnitaireHt: 1_999, categorie: 'S', taux: 550, nature: 'bien', remise: { type: 'montant', valeur: 1_000 } },
  { id: 'c', designation: 'Débours', quantite: 1000, prixUnitaireHt: 2_500, categorie: 'O', taux: 0, nature: 'debours' },
]

describe('avoir total', () => {
  it('est exactement l’opposé de la facture', () => {
    const facture = calculerDocument({ lignes, remiseGlobale: { type: 'montant', valeur: 1_234 } })
    const avoir = calculerDocument({ lignes: lignesAvoir(lignes), remiseGlobale: remiseGlobaleAvoir({ type: 'montant', valeur: 1_234 }) })
    expect(avoir.totalHt).toBe(-facture.totalHt)
    expect(avoir.totalTva).toBe(-facture.totalTva)
    expect(avoir.totalTtc).toBe(-facture.totalTtc)
    expect(avoir.ventilation.map((v) => v.tva)).toEqual(facture.ventilation.map((v) => 0 - v.tva))
  })
  it('garde les remises en pourcentage telles quelles', () => {
    expect(remiseGlobaleAvoir({ type: 'pourcentage', valeur: 1000 })).toEqual({ type: 'pourcentage', valeur: 1000 })
    expect(remiseGlobaleAvoir(undefined)).toBeUndefined()
  })
  it('préfixe les identifiants et inverse les quantités', () => {
    const a = lignesAvoir(lignes)
    expect(a.map((l) => [l.id, l.quantite])).toEqual([
      ['avoir-a', -2500],
      ['avoir-b', -4000],
      ['avoir-c', -1000],
    ])
  })
})

describe('avoir partiel', () => {
  it('ne crédite que les lignes et quantités choisies', () => {
    const a = lignesAvoir(lignes, { a: 1000 })
    expect(a).toHaveLength(1)
    const t = calculerDocument({ lignes: a })
    // 1 × 83,33 − 7,5 % = 83,33 − 6,25 = 77,08
    expect(t.totalHt).toBe(-7_708)
  })
  it('proratise une remise en montant', () => {
    const a = lignesAvoir(lignes, { b: 1000 })
    expect(a[0]!.remise).toEqual({ type: 'montant', valeur: -250 })
    expect(calculerDocument({ lignes: a }).totalHt).toBe(-1_749)
  })
  it('refuse une quantité supérieure à la quantité facturée ou nulle', () => {
    expect(() => lignesAvoir(lignes, { a: 2501 })).toThrow(/supérieure/)
    expect(() => lignesAvoir(lignes, { a: 0 })).toThrow(/supérieure/)
    expect(() => lignesAvoir(lignes, { a: 1.5 })).toThrow()
  })
  it('exige au moins une ligne', () => {
    expect(() => lignesAvoir(lignes, {})).toThrow(/au moins une ligne/)
  })
})
