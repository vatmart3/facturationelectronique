import { describe, expect, it } from 'vitest'
import { slugifier } from './slug'

describe('slugifier', () => {
  it('produit un identifiant d’URL lisible', () => {
    expect(slugifier('Atelier Lumen')).toBe('atelier-lumen')
    expect(slugifier('  Société Générale d’Études & Co. ')).toBe('societe-generale-d-etudes-co')
    expect(slugifier('Café--Crème!!')).toBe('cafe-creme')
  })
  it('garantit au moins 2 caractères et au plus 48', () => {
    expect(slugifier('É')).toBe('org-e')
    expect(slugifier('!!!')).toBe('org')
    expect(slugifier('a'.repeat(80)).length).toBe(48)
    expect(slugifier(`${'a'.repeat(47)} bcd`)).toBe('a'.repeat(47))
  })
})
