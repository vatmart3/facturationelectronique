import { describe, expect, it } from 'vitest'
import { genererCii } from './cii'
import { avoir, factureAutoliquidation, factureMultiTaux, factureSolde } from './exemples'
import { codeUnite, echapper, montant, pourcentage, quantite } from './modele'
import { genererUbl } from './ubl'
import { disponibles, validerSchematron, validerXsd } from './validateurs'

describe('formats', () => {
  it('montants, quantités, taux, échappement, unités', () => {
    expect(montant(12345)).toBe('123.45')
    expect(montant(-5)).toBe('-0.05')
    expect(montant(0)).toBe('0.00')
    expect(quantite(1500)).toBe('1.5')
    expect(quantite(-2000)).toBe('-2')
    expect(pourcentage(550)).toBe('5.5')
    expect(pourcentage(2000)).toBe('20')
    expect(echapper('A & B <c> "d" \'e\'\u0001')).toBe('A &amp; B &lt;c&gt; &quot;d&quot; &apos;e&apos;')
    expect(codeUnite('Heure')).toBe('HUR')
    expect(codeUnite('inconnue')).toBe('C62')
  })
})

describe('CII', () => {
  it('structure et valeurs clés', () => {
    const xml = genererCii(factureMultiTaux())
    expect(xml).toContain('<ram:ID>urn:cen.eu:en16931:2017</ram:ID>')
    expect(xml).toContain('<ram:TypeCode>380</ram:TypeCode>')
    expect(xml).toContain('<udt:DateTimeString format="102">20261012</udt:DateTimeString>')
    expect(xml).toContain('<ram:ID schemeID="0002">732829320</ram:ID>')
    expect(xml).toContain('<ram:URIID schemeID="0225">732829320</ram:URIID>')
    expect(xml).toContain('<ram:TaxTotalAmount currencyID="EUR">147.55</ram:TaxTotalAmount>')
    expect(xml).toContain('Trois pistes &amp; déclinaisons &lt;web&gt;')
    expect(xml).toContain('<ram:SubjectCode>PMT</ram:SubjectCode>')
  })

  it('avoir : type 381 et facture précédente', () => {
    const xml = genererCii(avoir())
    expect(xml).toContain('<ram:TypeCode>381</ram:TypeCode>')
    expect(xml).toContain('<ram:IssuerAssignedID>F-2026-0042</ram:IssuerAssignedID>')
  })
})

describe('UBL', () => {
  it('facture et avoir', () => {
    expect(genererUbl(factureMultiTaux())).toContain('<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"')
    const a = genererUbl(avoir())
    expect(a).toContain('<CreditNote xmlns=')
    expect(a).toContain('<cbc:CreditedQuantity unitCode="C62">2</cbc:CreditedQuantity>')
    expect(a).toContain('<cbc:Note>#PMT#Indemnité')
  })
})

const CAS = { 'multi-taux': factureMultiTaux, autoliquidation: factureAutoliquidation, avoir, solde: factureSolde }

describe.skipIf(!disponibles)('validation officielle', () => {
  for (const [nom, fabrique] of Object.entries(CAS)) {
    it(`${nom} : CII valide (XSD + EN 16931)`, () => {
      const xml = genererCii(fabrique())
      expect(validerXsd(xml, 'cii')).toEqual([])
      expect(validerSchematron(xml, 'cii-en16931').filter((e) => e.gravite === 'fatal')).toEqual([])
    })

    it(`${nom} : UBL valide (XSD + EN 16931)`, () => {
      const f = fabrique()
      const xml = genererUbl(f)
      expect(validerXsd(xml, f.type === '381' ? 'ubl-creditnote' : 'ubl-invoice')).toEqual([])
      expect(validerSchematron(xml, 'ubl-en16931').filter((e) => e.gravite === 'fatal')).toEqual([])
    })
  }

  for (const [nom, fabrique] of Object.entries(CAS)) {
    it(`${nom} : règles françaises BR-FR (flux 2), CII et UBL`, () => {
      const f = fabrique()
      expect(validerSchematron(genererCii(f), 'cii-br-fr').filter((e) => e.gravite === 'fatal')).toEqual([])
      expect(validerSchematron(genererUbl(f), 'ubl-br-fr').filter((e) => e.gravite === 'fatal')).toEqual([])
    })
  }
})
