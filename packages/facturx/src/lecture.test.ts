import { describe, expect, it } from 'vitest'
import { genererCii } from './cii'
import { avoir, factureAutoliquidation, factureMultiTaux } from './exemples'
import { centimes, ErreurLecture, lireFacture } from './lecture'
import { genererUbl } from './ubl'

describe('lecture des factures reçues', () => {
  for (const [syntaxe, generer] of [
    ['cii', genererCii],
    ['ubl', genererUbl],
  ] as const) {
    it(`${syntaxe} : relit ce que l’on écrit`, () => {
      const f = factureMultiTaux()
      const l = lireFacture(generer(f))
      expect(l).toMatchObject({
        syntaxe,
        type: '380',
        numero: 'F-2026-0042',
        dateEmission: '2026-10-12',
        dateEcheance: '2026-11-11',
        devise: 'EUR',
        vendeur: { nom: 'Atelier Lumen', siren: '732829320', tva: 'FR44732829320' },
        acheteur: { nom: 'Atelier Dupont', siren: '404833048', tva: 'FR83404833048' },
        totaux: { ht: 80600, tva: 14755, ttc: 95355, net: 95355 },
        facturePrecedente: null,
      })
      expect(l.ventilation).toEqual([
        { categorie: 'S', taux: 2000, base: 71183, montant: 14237 },
        { categorie: 'S', taux: 550, base: 9417, montant: 518 },
      ])
      expect(l.lignes).toEqual([
        { designation: 'Création logo', quantite: 2000, montant: 75600 },
        { designation: 'Livre', quantite: 1000, montant: 10000 },
      ])
    })

    it(`${syntaxe} : avoir et autoliquidation`, () => {
      const a = lireFacture(generer(avoir()))
      expect(a).toMatchObject({ type: '381', facturePrecedente: 'F-2026-0042' })
      const ae = lireFacture(generer(factureAutoliquidation()))
      expect(ae.ventilation).toEqual([{ categorie: 'AE', taux: 0, base: 18000, montant: 0 }])
      expect(ae.acheteur.tva).toBe('DE123456789')
    })
  }

  it('montants', () => {
    expect(centimes('12.5')).toBe(1250)
    expect(centimes('-3,10')).toBe(-310)
    expect(centimes('1.005')).toBe(101)
    expect(centimes(null)).toBe(0)
    expect(() => centimes('abc')).toThrow(ErreurLecture)
  })

  it('refuse un XML illisible ou inconnu', () => {
    expect(() => lireFacture('<a><b></a>')).toThrow(ErreurLecture)
    expect(() => lireFacture('<Commande/>')).toThrow(/Format non reconnu/)
    expect(() => lireFacture('<rsm:CrossIndustryInvoice xmlns:rsm="x"><rsm:ExchangedDocument/></rsm:CrossIndustryInvoice>')).toThrow(/Numéro/)
  })
})
