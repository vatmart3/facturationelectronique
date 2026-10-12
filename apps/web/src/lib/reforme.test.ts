import { describe, expect, it } from 'vitest'
import { EMISSION_PME_TPE, joursAvant } from './reforme'

describe('joursAvant', () => {
  it('compte les jours jusqu’au 1er septembre 2027', () => {
    expect(joursAvant(EMISSION_PME_TPE, new Date('2026-10-12T15:00:00Z'))).toBe(324)
    expect(joursAvant(EMISSION_PME_TPE, new Date('2027-08-31T23:00:00Z'))).toBe(1)
  })
  it('renvoie 0 une fois l’échéance passée', () => {
    expect(joursAvant(EMISSION_PME_TPE, new Date('2027-09-02T08:00:00Z'))).toBe(0)
  })
})
