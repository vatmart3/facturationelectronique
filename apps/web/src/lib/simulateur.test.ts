import { describe, expect, it } from 'vitest'
import { simuler } from './simulateur'

describe('simulateur', () => {
  it('temps et argent récupérés chaque mois', () => {
    expect(simuler({ facturesParMois: 20, minutesParFacture: 12, tauxHoraire: 50 })).toEqual({ heuresPerdues: 4, heuresGagnees: 3.8, euros: 192 })
  })
  it('bornes', () => {
    expect(simuler({ facturesParMois: -5, minutesParFacture: 12, tauxHoraire: 50 })).toEqual({ heuresPerdues: 0, heuresGagnees: 0, euros: 0 })
    expect(simuler({ facturesParMois: 10, minutesParFacture: 0.2, tauxHoraire: 50 }).heuresGagnees).toBe(0)
    expect(simuler({ facturesParMois: 5000, minutesParFacture: 999, tauxHoraire: -1 })).toEqual({ heuresPerdues: 4000, heuresGagnees: 3991.7, euros: 0 })
  })
})
