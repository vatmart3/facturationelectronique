import { describe, expect, it } from 'vitest'
import { initiales, teinteAvatar, TEINTES_AVATAR } from './avatar'

describe('initiales', () => {
  it('prend les deux premiers mots significatifs', () => {
    expect(initiales('Atelier Dupont')).toBe('AD')
    expect(initiales('SARL Atelier Dupont')).toBe('AD')
    expect(initiales('Mairie de Vannes')).toBe('MV')
    expect(initiales('Studio Nébuleuse')).toBe('SN')
    expect(initiales("L'Atelier d'Émile")).toBe('AE')
  })
  it('gère un seul mot ou une chaîne vide', () => {
    expect(initiales('Northwind')).toBe('NO')
    expect(initiales('')).toBe('?')
    expect(initiales('SAS')).toBe('?')
  })
})

describe('teinteAvatar', () => {
  it('est stable et insensible à la casse et aux accents', () => {
    expect(teinteAvatar('Studio Nébuleuse')).toBe(teinteAvatar('studio nebuleuse'))
    expect(TEINTES_AVATAR).toContain(teinteAvatar('Atelier Dupont'))
  })
  it('répartit les noms sur plusieurs teintes', () => {
    const noms = ['Atelier Dupont', 'Boulangerie Kerlann', 'Mairie de Vannes', 'Hofmann GmbH', 'Jeanne Morel', 'Lucas Bernard', 'Cabinet Leroy']
    expect(new Set(noms.map(teinteAvatar)).size).toBeGreaterThan(2)
  })
})
