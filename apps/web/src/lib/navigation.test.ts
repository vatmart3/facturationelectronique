import { describe, expect, it } from 'vitest'
import { cheminDansOrganisation, toutesLesEntrees, trouverEntree } from './navigation'

describe('navigation', () => {
  it('a des chemins uniques', () => {
    const chemins = toutesLesEntrees().map((e) => e.entree.chemin)
    expect(new Set(chemins).size).toBe(chemins.length)
  })

  it('retrouve l’entrée la plus spécifique', () => {
    expect(trouverEntree('ventes/factures')?.entree.libelle).toBe('Factures')
    expect(trouverEntree('ventes/factures/123')?.entree.libelle).toBe('Factures')
    expect(trouverEntree('reglages/membres')?.groupe).toBe('Compte')
    expect(trouverEntree('inconnu')).toBeUndefined()
    expect(trouverEntree('ventes')).toBeUndefined()
  })

  it('extrait le chemin relatif à l’organisation', () => {
    expect(cheminDansOrganisation('/atelier-lumen/ventes/factures', 'atelier-lumen')).toBe('ventes/factures')
    expect(cheminDansOrganisation('/atelier-lumen', 'atelier-lumen')).toBe('')
    expect(cheminDansOrganisation('/atelier-lumenx/clients', 'atelier-lumen')).toBe('')
  })
})
