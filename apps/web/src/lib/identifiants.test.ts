import { describe, expect, it } from 'vitest'
import {
  bicValide,
  ibanValide,
  luhnValide,
  sirenValide,
  siretValide,
  tvaIntracomDepuisSiren,
  tvaIntracomFrValide,
} from './identifiants'

describe('Luhn', () => {
  it('valide et rejette', () => {
    expect(luhnValide('79927398713')).toBe(true)
    expect(luhnValide('79927398710')).toBe(false)
    expect(luhnValide('12a')).toBe(false)
    expect(luhnValide('')).toBe(false)
  })
})

describe('SIREN', () => {
  it('accepte un SIREN valide, avec ou sans espaces', () => {
    expect(sirenValide('732829320')).toBe(true)
    expect(sirenValide('732 829 320')).toBe(true)
    expect(sirenValide('404833048')).toBe(true)
  })
  it('rejette une clé fausse ou une mauvaise longueur', () => {
    expect(sirenValide('732829321')).toBe(false)
    expect(sirenValide('73282932')).toBe(false)
    expect(sirenValide('7328293200')).toBe(false)
  })
})

describe('SIRET', () => {
  it('accepte un SIRET valide', () => {
    expect(siretValide('73282932000074')).toBe(true)
    expect(siretValide('732 829 320 00074')).toBe(true)
  })
  it('rejette un SIRET invalide', () => {
    expect(siretValide('73282932000075')).toBe(false)
    expect(siretValide('7328293200007')).toBe(false)
  })
  it('applique la règle propre aux établissements de La Poste', () => {
    expect(siretValide('35600000000048')).toBe(true)
    expect(siretValide('35600000049837')).toBe(true)
    expect(siretValide('35600000049838')).toBe(false)
  })
})

describe('TVA intracommunautaire', () => {
  it('calcule la clé depuis le SIREN', () => {
    expect(tvaIntracomDepuisSiren('404833048')).toBe('FR83404833048')
  })
  it('vérifie un numéro FR complet', () => {
    expect(tvaIntracomFrValide('FR83404833048')).toBe(true)
    expect(tvaIntracomFrValide('fr 83 404 833 048')).toBe(true)
    expect(tvaIntracomFrValide('FR84404833048')).toBe(false)
    expect(tvaIntracomFrValide('DE811234567')).toBe(false)
  })
  it('refuse un SIREN invalide', () => {
    expect(() => tvaIntracomDepuisSiren('123456789')).toThrow()
  })
})

describe('IBAN', () => {
  it('accepte des IBAN valides', () => {
    expect(ibanValide('FR76 3000 6000 0112 3456 7890 189')).toBe(true)
    expect(ibanValide('FR1420041010050500013M02606')).toBe(true)
    expect(ibanValide('DE89370400440532013000')).toBe(true)
    expect(ibanValide('GB82WEST12345698765432')).toBe(true)
  })
  it('rejette une clé fausse ou une longueur incorrecte', () => {
    expect(ibanValide('FR7630006000011234567890188')).toBe(false)
    expect(ibanValide('FR763000600001123456789018')).toBe(false)
    expect(ibanValide('FR76')).toBe(false)
  })
})

describe('BIC', () => {
  it('accepte 8 ou 11 caractères', () => {
    expect(bicValide('BNPAFRPP')).toBe(true)
    expect(bicValide('bnpafrppxxx')).toBe(true)
    expect(bicValide('BNPAFRP')).toBe(false)
  })
})
