import { describe, expect, it } from 'vitest'
import { analyserLigneRapide, centimesDepuisSaisie, prixHtDepuisTtc, prixTtcDepuisHt, quantiteDepuisSaisie } from './saisie'

describe('saisie des quantités et montants', () => {
  it.each([
    ['1', 1000],
    ['1,5', 1500],
    ['0.125', 125],
    ['12', 12_000],
    ['-2', -2000],
    [' 1 000 ', 1_000_000],
  ])('quantité « %s » → %i', (saisie, attendu) => {
    expect(quantiteDepuisSaisie(saisie)).toBe(attendu)
  })
  it('refuse une quantité invalide', () => {
    expect(quantiteDepuisSaisie('1,2345')).toBeNull()
    expect(quantiteDepuisSaisie('abc')).toBeNull()
  })
  it.each([
    ['450', 45_000],
    ['1 250,5', 125_050],
    ['99.90 €', 9_990],
    ['-12,30', -1_230],
  ])('montant « %s » → %i', (saisie, attendu) => {
    expect(centimesDepuisSaisie(saisie)).toBe(attendu)
  })
  it('refuse un montant invalide', () => {
    expect(centimesDepuisSaisie('12,345')).toBeNull()
  })
})

describe('prix TTC / HT', () => {
  it('convertit dans les deux sens', () => {
    expect(prixHtDepuisTtc(12_000, 2000)).toBe(10_000)
    expect(prixHtDepuisTtc(1_000, 550)).toBe(948)
    expect(prixTtcDepuisHt(10_000, 2000)).toBe(12_000)
    expect(prixTtcDepuisHt(948, 550)).toBe(1_000)
  })
  it('refuse un taux invalide', () => {
    expect(() => prixHtDepuisTtc(100, -1)).toThrow()
    expect(() => prixHtDepuisTtc(100, 5.5)).toThrow()
    expect(() => prixTtcDepuisHt(100, 5.5)).toThrow()
  })
})

describe('ligne rapide', () => {
  it.each([
    ['3 x Création logo 450', { quantite: 3000, designation: 'Création logo', prixUnitaireHt: 45_000 }],
    ['2,5 × Conseil 80,00 €', { quantite: 2500, designation: 'Conseil', prixUnitaireHt: 8_000 }],
    ['Création logo 450', { quantite: 1000, designation: 'Création logo', prixUnitaireHt: 45_000 }],
    ['3x Logo', { quantite: 3000, designation: 'Logo', prixUnitaireHt: null }],
    ['Audit SEO', { quantite: 1000, designation: 'Audit SEO', prixUnitaireHt: null }],
    ['10 * Cartes   de visite 1 250,50', { quantite: 10_000, designation: 'Cartes de visite', prixUnitaireHt: 125_050 }],
  ])('« %s »', (saisie, attendu) => {
    expect(analyserLigneRapide(saisie)).toEqual(attendu)
  })
  it('refuse une saisie vide ou sans désignation', () => {
    expect(analyserLigneRapide('   ')).toBeNull()
    expect(analyserLigneRapide('3 x ')).toBeNull()
  })
})
