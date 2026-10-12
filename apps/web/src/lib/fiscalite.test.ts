import { describe, expect, it } from 'vitest'
import { canalTransmission, MENTIONS, resoudreTva, type ContexteTva } from './fiscalite'

const service = { nature: 'service', categorie: 'S', taux: 2000 } as const
const bien = { nature: 'bien', categorie: 'S', taux: 550 } as const

function ctx(p: Partial<ContexteTva>): ContexteTva {
  return { regimeEntreprise: 'reel_normal', client: null, article: service, ...p }
}

describe('resoudreTva', () => {
  it('applique le taux de l’article par défaut', () => {
    expect(resoudreTva(ctx({}))).toEqual({ categorie: 'S', taux: 2000 })
    expect(resoudreTva(ctx({ article: bien, client: { kind: 'b2b' } }))).toEqual({ categorie: 'S', taux: 550 })
  })
  it('franchise en base : toujours exonéré avec la mention 293 B', () => {
    expect(resoudreTva(ctx({ regimeEntreprise: 'franchise', client: { kind: 'ue' } }))).toEqual({
      categorie: 'E',
      taux: 0,
      motif: MENTIONS.franchise,
    })
  })
  it('non assujetti : hors champ', () => {
    expect(resoudreTva(ctx({ regimeEntreprise: 'non_assujetti' })).categorie).toBe('O')
  })
  it('client UE : livraison intracommunautaire ou autoliquidation', () => {
    expect(resoudreTva(ctx({ client: { kind: 'ue' }, article: bien }))).toMatchObject({ categorie: 'K', motif: MENTIONS.livraisonIntracom })
    expect(resoudreTva(ctx({ client: { kind: 'ue' } }))).toMatchObject({ categorie: 'AE', motif: MENTIONS.autoliquidationUe })
  })
  it('client hors UE : export ou services hors champ', () => {
    expect(resoudreTva(ctx({ client: { kind: 'hors_ue' }, article: bien }))).toMatchObject({ categorie: 'G', motif: MENTIONS.export })
    expect(resoudreTva(ctx({ client: { kind: 'hors_ue' } }))).toMatchObject({ categorie: 'O', motif: MENTIONS.servicesHorsUe })
  })
  it('les réglages du client l’emportent', () => {
    expect(resoudreTva(ctx({ client: { kind: 'b2b', defaultVatCategory: 'S', defaultVatRate: 1000 } }))).toEqual({ categorie: 'S', taux: 1000 })
    expect(
      resoudreTva(ctx({ client: { kind: 'b2b', defaultVatCategory: 'AE', exemptionReason: MENTIONS.autoliquidationBtp } })),
    ).toEqual({ categorie: 'AE', taux: 0, motif: MENTIONS.autoliquidationBtp })
    expect(resoudreTva(ctx({ client: { kind: 'b2b', defaultVatCategory: 'S' } }))).toEqual({ categorie: 'S', taux: 2000 })
    expect(resoudreTva(ctx({ client: { kind: 'b2b', defaultVatCategory: 'E' } }))).toEqual({ categorie: 'E', taux: 0, motif: undefined })
  })
  it('un taux par défaut du client remplace celui de l’article', () => {
    expect(resoudreTva(ctx({ client: { kind: 'b2c', defaultVatRate: 1000 } }))).toEqual({ categorie: 'S', taux: 1000 })
  })
  it('les débours restent hors champ', () => {
    expect(resoudreTva(ctx({ regimeEntreprise: 'franchise', article: { nature: 'debours', categorie: 'O', taux: 0 } }))).toEqual({
      categorie: 'O',
      taux: 0,
      motif: MENTIONS.debours,
    })
  })
  it('garde une catégorie non taxée choisie sur l’article', () => {
    expect(resoudreTva(ctx({ article: { nature: 'service', categorie: 'E', taux: 0 } }))).toEqual({ categorie: 'E', taux: 0 })
  })
})

describe('canalTransmission', () => {
  it('dépend du type de client', () => {
    expect(canalTransmission('b2b')).toMatch(/plateforme agréée/)
    expect(canalTransmission('b2g')).toMatch(/Chorus/)
    expect(canalTransmission('b2c')).toMatch(/E-reporting/)
    expect(canalTransmission('ue')).toMatch(/international/)
  })
})
