import { describe, expect, it } from 'vitest'
import { cleVentilation, exigeMotif, formatTaux, TAUX, TAUX_PAR_TERRITOIRE, tauxEffectif } from './tva'

describe('TVA', () => {
  it('connaît les taux métropole et DOM', () => {
    expect(TAUX_PAR_TERRITOIRE.metropole).toEqual([2000, 1000, 550, 210, 0])
    expect(TAUX_PAR_TERRITOIRE.dom).toEqual([850, 210, 0])
    expect(TAUX.domNormal).toBe(850)
  })
  it('force à 0 le taux des catégories non taxées', () => {
    expect(tauxEffectif('S', 2000)).toBe(2000)
    for (const c of ['Z', 'E', 'AE', 'K', 'G', 'O'] as const) expect(tauxEffectif(c, 2000)).toBe(0)
  })
  it('sait quelles catégories exigent un motif', () => {
    expect(exigeMotif('S')).toBe(false)
    expect(exigeMotif('Z')).toBe(false)
    for (const c of ['E', 'AE', 'K', 'G', 'O'] as const) expect(exigeMotif(c)).toBe(true)
  })
  it('formate les taux à la française', () => {
    expect(formatTaux(2000)).toBe('20 %')
    expect(formatTaux(550)).toBe('5,5 %')
    expect(formatTaux(210)).toBe('2,1 %')
    expect(formatTaux(850)).toBe('8,5 %')
    expect(formatTaux(1025)).toBe('10,25 %')
    expect(formatTaux(0)).toBe('0 %')
  })
  it('construit une clé de ventilation stable', () => {
    expect(cleVentilation('S', 2000)).toBe('S:2000')
    expect(cleVentilation('K', 2000)).toBe('K:0')
  })
})
