import { describe, expect, it } from 'vitest'
import { centimesEnSaisie, eurosEnCentimes } from './montant'

describe('eurosEnCentimes', () => {
  it('lit les saisies françaises et anglaises', () => {
    expect(eurosEnCentimes('10 000')).toBe(1_000_000)
    expect(eurosEnCentimes('1 250,5')).toBe(125_050)
    expect(eurosEnCentimes('99.90')).toBe(9_990)
    expect(eurosEnCentimes('0,07 €')).toBe(7)
    expect(eurosEnCentimes('-12,30')).toBe(-1_230)
  })
  it('évite les erreurs de flottant', () => {
    expect(eurosEnCentimes('0,29')).toBe(29)
    expect(eurosEnCentimes('1,13')).toBe(113)
  })
  it('rejette les saisies invalides', () => {
    expect(eurosEnCentimes('')).toBeNull()
    expect(eurosEnCentimes('12,345')).toBeNull()
    expect(eurosEnCentimes('abc')).toBeNull()
    expect(eurosEnCentimes('1,2,3')).toBeNull()
  })
  it('fait l’aller-retour', () => {
    expect(centimesEnSaisie(1_000_050)).toBe('10000,50')
    expect(eurosEnCentimes(centimesEnSaisie(123_456))).toBe(123_456)
    expect(centimesEnSaisie(-5)).toBe('-0,05')
  })
})
