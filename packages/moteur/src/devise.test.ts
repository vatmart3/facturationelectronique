import { describe, expect, it } from 'vitest'
import { convertir } from './devise'

describe('conversion de devise', () => {
  it('convertit avec un taux décimal', () => {
    expect(convertir(10_000, '0.9234')).toBe(9_234)
    expect(convertir(12_345, '1,0856')).toBe(13_402)
    expect(convertir(500, '2')).toBe(1_000)
  })
  it('refuse un taux invalide', () => {
    expect(() => convertir(100, '0')).toThrow(/Taux de change/)
    expect(() => convertir(100, 'abc')).toThrow(/Taux de change/)
    expect(() => convertir(100, '-1')).toThrow(/Taux de change/)
  })
})
