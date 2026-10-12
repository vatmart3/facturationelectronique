import { describe, expect, it } from 'vitest'
import { emailValide, motDePasseValide, suiteSure, traduireErreurAuth } from './auth'

describe('suiteSure', () => {
  it('garde un chemin interne', () => {
    expect(suiteSure('/atelier-lumen/clients?categorie=b2b')).toBe('/atelier-lumen/clients?categorie=b2b')
  })
  it('refuse les redirections externes ou malformées', () => {
    expect(suiteSure('https://pirate.example')).toBe('/')
    expect(suiteSure('//pirate.example')).toBe('/')
    expect(suiteSure('/\\pirate.example')).toBe('/')
    expect(suiteSure('/a\nb')).toBe('/')
    expect(suiteSure(null, '/bienvenue')).toBe('/bienvenue')
  })
})

describe('validations', () => {
  it('email', () => {
    expect(emailValide('claire@atelier-dupont.fr')).toBe(true)
    expect(emailValide('claire@')).toBe(false)
    expect(emailValide('claire atelier@x.fr')).toBe(false)
  })
  it('mot de passe', () => {
    expect(motDePasseValide('facture2027')).toBe(true)
    expect(motDePasseValide('court1')).toBe(false)
    expect(motDePasseValide('sanschiffresdutout')).toBe(false)
  })
  it('traduit les codes d’erreur Supabase', () => {
    expect(traduireErreurAuth('invalid_credentials')).toMatch(/incorrect/)
    expect(traduireErreurAuth('inconnu')).toMatch(/erreur/)
    expect(traduireErreurAuth(undefined)).toMatch(/erreur/)
  })
})
