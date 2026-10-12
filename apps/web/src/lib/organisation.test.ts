import { describe, expect, it } from 'vitest'
import { validerIdentite } from './organisation'

function lecteur(valeurs: Record<string, string>) {
  return (cle: string) => (valeurs[cle] ?? '').trim()
}

describe('validerIdentite', () => {
  it('normalise une identité complète et valide', () => {
    const { donnees, erreurs } = validerIdentite(
      lecteur({
        name: 'Atelier Lumen',
        legal_form: 'SAS',
        share_capital: '10 000',
        siren: '404 833 048',
        siret: '40483304800006',
        vat_number: 'fr 83 404833048',
        naf_code: '7410z',
        postal_code: '44000',
        city: 'Nantes',
        country_code: 'fr',
        vat_regime: 'reel_normal',
        vat_on_debits: 'on',
        iban: 'fr76 3000 6000 0112 3456 7890 189',
        bic: 'bnpafrpp',
      }),
    )
    expect(erreurs).toEqual({})
    expect(donnees).toMatchObject({
      share_capital_cents: 1_000_000,
      siren: '404833048',
      vat_number: 'FR83404833048',
      naf_code: '74.10Z',
      country_code: 'FR',
      vat_on_debits: true,
      iban: 'FR7630006000011234567890189',
      bic: 'BNPAFRPP',
    })
  })

  it('transforme les champs vides en null', () => {
    const { donnees, erreurs } = validerIdentite(lecteur({ name: 'Solo' }))
    expect(erreurs).toEqual({})
    expect(donnees.siren).toBeNull()
    expect(donnees.vat_regime).toBeNull()
    expect(donnees.vat_on_debits).toBe(false)
    expect(donnees.country_code).toBe('FR')
  })

  it('signale chaque champ invalide', () => {
    const { erreurs } = validerIdentite(
      lecteur({
        name: '',
        siren: '123456789',
        vat_number: 'FR00123',
        iban: 'FR76 0000',
        bic: 'XX',
        share_capital: '12,345',
        naf_code: 'abc',
        vat_regime: 'inconnu',
      }),
    )
    expect(Object.keys(erreurs).sort()).toEqual(
      ['bic', 'iban', 'naf_code', 'name', 'share_capital_cents', 'siren', 'vat_number', 'vat_regime'].sort(),
    )
  })

  it('vérifie la cohérence SIREN / SIRET / TVA', () => {
    const { erreurs } = validerIdentite(
      lecteur({ name: 'X', siren: '404833048', siret: '73282932000074', vat_number: 'FR44732829320' }),
    )
    expect(erreurs.siret).toMatch(/commencer par le SIREN/)
    expect(erreurs.vat_number).toMatch(/ne correspond pas/)
  })
})
