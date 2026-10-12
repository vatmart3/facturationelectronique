import { describe, expect, it } from 'vitest'
import { formatIban, formatMontant, grouperChiffres, normaliserIban } from './format'

const ESPACE_FINE = ' '

describe('formatMontant', () => {
  it('affiche des centimes en euros au format français', () => {
    expect(formatMontant(421800)).toBe(`4${ESPACE_FINE}218,00${' '}€`)
    expect(formatMontant(0)).toBe(`0,00${' '}€`)
    expect(formatMontant(5)).toBe(`0,05${' '}€`)
  })

  it('gère les montants négatifs des avoirs', () => {
    expect(formatMontant(-24000)).toBe(`-240,00${' '}€`)
  })

  it('refuse les montants non entiers', () => {
    expect(() => formatMontant(12.5)).toThrow(TypeError)
    expect(() => formatMontant(Number.NaN)).toThrow(TypeError)
  })

  it('accepte une autre devise', () => {
    expect(formatMontant(150000, 'USD')).toContain('$US')
  })
})

describe('grouperChiffres', () => {
  it('groupe un SIREN par 3', () => {
    expect(grouperChiffres('732829320')).toBe('732 829 320')
    expect(grouperChiffres('732 829-320')).toBe('732 829 320')
  })
})

describe('IBAN', () => {
  it('normalise et formate par blocs de 4', () => {
    expect(normaliserIban(' fr76 3000 6000 0112 3456 7890 189 ')).toBe('FR7630006000011234567890189')
    expect(formatIban('FR7630006000011234567890189')).toBe('FR76 3000 6000 0112 3456 7890 189')
  })
})
