import { describe, expect, it } from 'vitest'
import { dateEcheance, libelleConditions, libelleTypeClient, pourcentageEnPoints, validerClient } from './clients'

const lecteur = (v: Record<string, string>) => (k: string) => (v[k] ?? '').trim()

describe('dateEcheance', () => {
  it.each([
    ['2026-10-12', 'reception', '2026-10-12'],
    ['2026-10-12', '15j', '2026-10-27'],
    ['2026-10-12', '30j', '2026-11-11'],
    ['2026-10-12', '30jfm', '2026-11-30'],
    ['2026-10-31', '30jfm', '2026-11-30'],
    ['2026-12-20', '45jfm', '2027-02-28'],
    ['2026-01-31', '60j', '2026-04-01'],
  ] as const)('%s + %s → %s', (emission, conditions, attendu) => {
    expect(dateEcheance(emission, conditions)).toBe(attendu)
  })
})

describe('validerClient', () => {
  it('valide une entreprise française et déduit la TVA du SIREN', () => {
    const { donnees, erreurs } = validerClient(lecteur({ kind: 'b2b', name: 'Atelier Dupont', siren: '404 833 048', billing_city: 'Nantes' }))
    expect(erreurs).toEqual({})
    expect(donnees).toMatchObject({ siren: '404833048', vat_number: 'FR83404833048', billing_country: 'FR', currency: 'EUR', language: 'fr' })
  })
  it('exige le SIREN en B2B et le n° de TVA en UE', () => {
    expect(validerClient(lecteur({ kind: 'b2b', name: 'X' })).erreurs.siren).toMatch(/obligatoire/)
    expect(validerClient(lecteur({ kind: 'ue', name: 'Hofmann GmbH' })).erreurs.vat_number).toMatch(/obligatoire/)
    expect(validerClient(lecteur({ kind: 'ue', name: 'Hofmann GmbH', vat_number: 'de 811234567', siren: '404833048' })).donnees).toMatchObject({
      vat_number: 'DE811234567',
      siren: null,
    })
  })
  it('signale les champs invalides', () => {
    const { erreurs } = validerClient(
      lecteur({ kind: 'x', name: '', siren: '123456789', siret: '1', vat_number: 'FR00404833048', billing_country: 'France', default_vat_rate: '120', default_discount_value: 'abc', currency: 'euro', default_vat_category: 'Q' }),
    )
    expect(Object.keys(erreurs).sort()).toEqual(
      ['billing_country', 'currency', 'default_discount_value', 'default_vat_category', 'default_vat_rate', 'kind', 'name', 'siren', 'siret', 'vat_number'].sort(),
    )
  })
  it('lit les réglages commerciaux', () => {
    const { donnees, erreurs } = validerClient(
      lecteur({
        kind: 'b2c',
        name: 'Jeanne Morel',
        default_vat_category: 'S',
        default_vat_rate: '5,5',
        default_discount_kind: 'pourcentage',
        default_discount_value: '7,5',
        payment_terms: '30jfm',
        language: 'en',
        purchase_order_required: 'on',
        reminders_enabled: 'off',
        shipping_different: 'on',
        shipping_city: 'Brest',
      }),
    )
    expect(erreurs).toEqual({})
    expect(donnees).toMatchObject({
      default_vat_rate: 550,
      default_discount_kind: 'pourcentage',
      default_discount_value: 750,
      payment_terms: '30jfm',
      language: 'en',
      purchase_order_required: true,
      reminders_enabled: false,
      shipping_city: 'Brest',
      shipping_country: 'FR',
    })
  })
  it('lit une remise en montant', () => {
    const { donnees } = validerClient(lecteur({ kind: 'b2c', name: 'X', default_discount_kind: 'montant', default_discount_value: '25' }))
    expect(donnees).toMatchObject({ default_discount_kind: 'montant', default_discount_value: 2500 })
  })
  it('refuse un SIRET qui ne correspond pas au SIREN', () => {
    expect(validerClient(lecteur({ kind: 'b2b', name: 'X', siren: '404833048', siret: '73282932000074' })).erreurs.siret).toMatch(/commencer/)
  })
})

describe('utilitaires', () => {
  it('convertit les pourcentages saisis', () => {
    expect(pourcentageEnPoints('20')).toBe(2000)
    expect(pourcentageEnPoints('5,5 %')).toBe(550)
    expect(pourcentageEnPoints('2.1')).toBe(210)
    expect(pourcentageEnPoints('101')).toBeNull()
    expect(pourcentageEnPoints('x')).toBeNull()
  })
  it('donne les libellés', () => {
    expect(libelleTypeClient('b2g')).toBe('Administration')
    expect(libelleConditions('45jfm')).toBe('45 jours fin de mois')
  })
})
