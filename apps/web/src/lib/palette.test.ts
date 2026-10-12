import { describe, expect, it } from 'vitest'
import { construireEntrees, filtrerEntrees } from './palette'

const orgs = [
  { slug: 'atelier-lumen', nom: 'Atelier Lumen' },
  { slug: 'studio-nebuleuse', nom: 'Studio Nébuleuse' },
]

describe('palette', () => {
  const entrees = construireEntrees('atelier-lumen', orgs)

  it('propose la navigation et les autres entreprises, pas la courante', () => {
    expect(entrees.find((e) => e.libelle === 'Factures')?.href).toBe('/atelier-lumen/ventes/factures')
    expect(entrees.some((e) => e.libelle === 'Studio Nébuleuse')).toBe(true)
    expect(entrees.some((e) => e.libelle === 'Atelier Lumen')).toBe(false)
  })

  it('filtre sans tenir compte des accents ni de l’ordre des mots', () => {
    expect(filtrerEntrees(entrees, 'nebuleuse').map((e) => e.libelle)).toEqual(['Studio Nébuleuse'])
    expect(filtrerEntrees(entrees, 'reforme').map((e) => e.libelle)).toEqual(['Réforme 2027'])
    expect(filtrerEntrees(entrees, 'ventes fact').map((e) => e.libelle)).toEqual(['Factures'])
    expect(filtrerEntrees(entrees, '')).toHaveLength(entrees.length)
    expect(filtrerEntrees(entrees, 'zzz')).toHaveLength(0)
  })
})
