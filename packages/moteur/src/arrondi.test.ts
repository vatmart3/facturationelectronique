import { describe, expect, it } from 'vitest'
import { diviserArrondi, ErreurMontant, exigerEntier, multiplierDiviser, repartir } from './arrondi'

describe('diviserArrondi : demis loin de zéro', () => {
  it.each([
    [5n, 2n, 3n],
    [-5n, 2n, -3n],
    [5n, -2n, -3n],
    [-5n, -2n, 3n],
    [7n, 2n, 4n],
    [4n, 3n, 1n],
    [5n, 3n, 2n],
    [-4n, 3n, -1n],
    [0n, 7n, 0n],
  ])('%s / %s = %s', (n, d, attendu) => {
    expect(diviserArrondi(n, d)).toBe(attendu)
  })

  it('refuse la division par zéro', () => {
    expect(() => diviserArrondi(1n, 0n)).toThrow(ErreurMontant)
  })
})

describe('multiplierDiviser', () => {
  it('calcule exactement au-delà de la précision des flottants', () => {
    // 0,1 + 0,2 n'existe pas ici : tout est entier.
    expect(multiplierDiviser(1_500, 8_333, 1_000)).toBe(12_500)
    expect(multiplierDiviser(9_007_199_254, 1_000_000, 1_000_000)).toBe(9_007_199_254)
  })
  it('refuse les valeurs non entières et les dépassements', () => {
    expect(() => multiplierDiviser(1.5, 2, 1)).toThrow(ErreurMontant)
    expect(() => multiplierDiviser(1, Number.NaN, 1)).toThrow(ErreurMontant)
    expect(() => multiplierDiviser(1, 1, 0.5)).toThrow(ErreurMontant)
    expect(() => multiplierDiviser(1_000_000_000, 10_000_000_000, 1_000)).toThrow(/hors limites/)
    expect(() => multiplierDiviser(-1_000_000_000, 10_000_000_000, 1_000)).toThrow(/hors limites/)
  })
  it('exigerEntier renvoie la valeur', () => {
    expect(exigerEntier(42, 'x')).toBe(42)
  })
})

describe('repartir', () => {
  it('répartit sans perte au prorata', () => {
    expect(repartir(100, [100, 200])).toEqual([33, 67])
    expect(repartir(10, [1, 1, 1])).toEqual([4, 3, 3])
    expect(repartir(15_000, [100_000, 50_000])).toEqual([10_000, 5_000])
  })
  it('départage les restes égaux dans l’ordre', () => {
    expect(repartir(2, [1, 1, 1])).toEqual([1, 1, 0])
  })
  it('gère les totaux et les poids négatifs', () => {
    expect(repartir(-10, [1, 1, 1])).toEqual([-4, -3, -3])
    expect(repartir(-100, [-100, -200])).toEqual([-33, -67])
    expect(repartir(0, [-5, 0])).toEqual([0, 0])
  })
  it('gère les cas limites', () => {
    expect(repartir(0, [])).toEqual([])
    expect(repartir(0, [0, 0])).toEqual([0, 0])
    expect(() => repartir(1, [])).toThrow(ErreurMontant)
    expect(() => repartir(1, [0, 0])).toThrow(ErreurMontant)
    expect(() => repartir(10, [5, -5])).toThrow(/même signe/)
  })
  it('conserve toujours la somme', () => {
    for (let total = -97; total <= 97; total += 7) {
      const parts = repartir(total, [3, 11, 29, 1])
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total)
    }
  })
})
