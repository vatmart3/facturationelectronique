import { describe, expect, it } from 'vitest'
import { cleSequence, formaterNumero, formatValide } from './numerotation'

describe('numérotation', () => {
  it.each([
    ['F-{AAAA}-{NNNN}', 'F-2026-0042'],
    ['{AAAA}-{MM}-{NNN}', '2026-10-042'],
    ['FA{AA}{NNNNN}', 'FA2600042'],
    ['{NN}', '42'],
  ])('%s → %s', (format, attendu) => {
    expect(formaterNumero(format, 2026, 10, 42)).toBe(attendu)
  })
  it('ne tronque jamais un numéro trop long', () => {
    expect(formaterNumero('F-{NN}', 2026, 1, 12345)).toBe('F-12345')
  })
  it('valide les formats', () => {
    expect(formatValide('F-{AAAA}-{NNNN}')).toBe(true)
    expect(formatValide('F-{AAAA}')).toBe(false)
    expect(formatValide('F {NNN}')).toBe(false)
    expect(formatValide(`${'X'.repeat(40)}{N}`)).toBe(false)
  })
  it('détermine quand la séquence repart', () => {
    expect(cleSequence('F-{AAAA}-{NNNN}', 2026, 10)).toBe('2026')
    expect(cleSequence('{AAAA}-{MM}-{NNN}', 2026, 3)).toBe('2026-03')
    expect(cleSequence('FA{NNNNNN}', 2026, 3)).toBe('unique')
  })
})
