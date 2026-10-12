import { describe, expect, it } from 'vitest'
import { validerProduit } from './produits'

const lecteur = (v: Record<string, string>) => (k: string) => (v[k] ?? '').trim()

describe('validerProduit', () => {
  it('lit un article simple', () => {
    const { donnees, erreurs } = validerProduit(lecteur({ name: 'Création logo', price: '450', vat: 'S:2000', unit: 'forfait' }))
    expect(erreurs).toEqual({})
    expect(donnees).toMatchObject({ unit_price_cents: 45_000, vat_category: 'S', vat_rate: 2000, nature: 'service', unit: 'forfait' })
  })
  it('convertit un prix saisi TTC', () => {
    expect(validerProduit(lecteur({ name: 'Livre', price: '21,10', price_mode: 'ttc', vat: 'S:550' })).donnees.unit_price_cents).toBe(2_000)
  })
  it('accepte un taux libre et force les débours hors TVA', () => {
    expect(validerProduit(lecteur({ name: 'X', price: '1', vat: '13' })).donnees.vat_rate).toBe(1300)
    expect(validerProduit(lecteur({ name: 'Frais de greffe', price: '35', nature: 'debours', vat: 'S:2000' })).donnees).toMatchObject({
      vat_category: 'O',
      vat_rate: 0,
    })
    expect(validerProduit(lecteur({ name: 'X', price: '1', vat: 'E:0' })).donnees).toMatchObject({ vat_category: 'E', vat_rate: 0 })
  })
  it('signale les erreurs', () => {
    const { erreurs } = validerProduit(lecteur({ name: '', price: 'abc', vat: '0', unit: 'x'.repeat(31), accounting_account: '7-06' }))
    expect(Object.keys(erreurs).sort()).toEqual(['accounting_account', 'name', 'prix', 'unit', 'vat_rate'])
  })
})
