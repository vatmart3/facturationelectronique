import { describe, expect, it } from 'vitest'
import { calculer, ligneVide, type DocumentEdition } from './document'
import { acompteDepuis, avoirDepuis, copieDe, deductions, factureDepuis } from './derives'

function doc(p: Partial<DocumentEdition> = {}): DocumentEdition {
  return {
    id: 'd1',
    type: 'facture',
    clientId: 'c1',
    issueDate: '2026-09-01',
    serviceDate: null,
    servicePeriodStart: null,
    servicePeriodEnd: null,
    validUntil: null,
    purchaseOrder: 'BC-1',
    subject: 'Refonte',
    publicNotes: 'Merci',
    internalNotes: 'secret',
    currency: 'EUR',
    language: 'fr',
    paymentTerms: '30j',
    earlyPaymentDiscount: '',
    remise: null,
    lignes: [
      ligneVide({ designation: 'Logo', quantite: 2000, prixUnitaireHt: 45000, remise: { type: 'montant', valeur: 5000 } }),
      ligneVide({ designation: 'Impression', prixUnitaireHt: 10000, taux: 550, nature: 'bien' }),
    ],
    acomptes: [],
    originDocumentId: null,
    ...p,
  }
}

describe('avoir', () => {
  it('total : annule exactement la facture', () => {
    const facture = doc({ remise: { type: 'montant', valeur: 1000 } })
    const avoir = avoirDepuis(facture, 'f1', '2026-10-12')
    expect(avoir).toMatchObject({ type: 'avoir', originDocumentId: 'f1', issueDate: '2026-10-12', internalNotes: '', remise: { type: 'montant', valeur: -1000 } })
    expect(avoir.lignes[0]).toMatchObject({ quantite: -2000, remise: { type: 'montant', valeur: -5000 } })
    const t = calculer(facture)
    const a = calculer(avoir)
    if (!t.ok || !a.ok) throw new Error('calcul')
    expect(a.totaux.totalTtc).toBe(-t.totaux.totalTtc)
    expect(a.totaux.totalTva).toBe(-t.totaux.totalTva)
  })

  it('d’une facture de solde : les acomptes déjà facturés sont réintégrés', () => {
    const solde = doc({ acomptes: [{ numero: 'F-2026-0001', ventilation: [{ categorie: 'S', taux: 2000, baseHt: 20000 }] }] })
    const avoir = avoirDepuis(solde, 'f2', '2026-10-12')
    expect(avoir.acomptes).toEqual([])
    expect(avoir.lignes.at(-1)).toMatchObject({ designation: 'Acompte F-2026-0001 déjà facturé', prixUnitaireHt: 20000, quantite: 1000 })
    const t = calculer(solde)
    const a = calculer(avoir)
    if (!t.ok || !a.ok) throw new Error('calcul')
    expect(a.totaux.netAPayer).toBe(-t.totaux.netAPayer)
  })

  it('une remise en pourcentage garde son signe', () => {
    const avoir = avoirDepuis(doc({ lignes: [ligneVide({ designation: 'X', prixUnitaireHt: 100, remise: { type: 'pourcentage', valeur: 1000 } })] }), 'f', '2026-10-12')
    expect(avoir.lignes[0]!.remise).toEqual({ type: 'pourcentage', valeur: 1000 })
  })
})

describe('acompte', () => {
  const devis = doc({ type: 'devis', validUntil: '2026-12-01' })

  it('30 % ventilé sur les taux du devis', () => {
    const r = acompteDepuis(devis, 'q1', 'D-2026-0001', { pourcentage: 3000 }, '2026-10-12')
    if (!r.ok) throw new Error(r.erreur)
    expect(r.doc).toMatchObject({ type: 'acompte', originDocumentId: 'q1', validUntil: null, remise: null })
    expect(r.doc.lignes).toHaveLength(2)
    expect(r.doc.lignes[0]!.designation).toContain('Acompte de 30 % sur le devis D-2026-0001')
    expect(r.doc.lignes.map((l) => l.prixUnitaireHt)).toEqual([25500, 3000])
  })

  it('montant TTC et mentions d’exonération reprises', () => {
    const ue = doc({ type: 'devis', lignes: [ligneVide({ designation: 'Conseil', prixUnitaireHt: 100000, categorie: 'AE', taux: 0, motif: 'Autoliquidation' })] })
    const r = acompteDepuis(ue, 'q2', 'D-2', { montantTtc: 30000 }, '2026-10-12')
    if (!r.ok) throw new Error(r.erreur)
    expect(r.doc.lignes[0]).toMatchObject({ designation: 'Acompte sur le devis D-2', prixUnitaireHt: 30000, categorie: 'AE', motif: 'Autoliquidation' })
  })

  it('erreurs', () => {
    expect(acompteDepuis(devis, 'q', 'D', { pourcentage: 0 }, '2026-10-12')).toMatchObject({ ok: false })
    expect(acompteDepuis(doc({ lignes: [ligneVide({ prixUnitaireHt: 1, quantite: 1, remise: { type: 'pourcentage', valeur: 20000 } })] }), 'q', 'D', { pourcentage: 1 }, 'j')).toMatchObject({
      ok: false,
    })
  })
})

describe('facture depuis un devis, copie', () => {
  it('solde : lien vers le devis et acomptes déduits', () => {
    const d = deductions([
      {
        number: 'F-1',
        vat: [
          { vat_category: 'S', vat_rate: 2000, base_cents: 25500 },
          { vat_category: 'S', vat_rate: 550, base_cents: 0 },
        ],
      },
    ])
    expect(d).toEqual([{ numero: 'F-1', ventilation: [{ categorie: 'S', taux: 2000, baseHt: 25500 }] }])
    const f = factureDepuis(doc({ type: 'devis' }), 'q1', '2026-10-12', d)
    expect(f).toMatchObject({ type: 'facture', originDocumentId: 'q1', acomptes: d, internalNotes: '' })
    expect(f.lignes[0]!.cle).not.toBe(doc().lignes[0]!.cle)
  })

  it('d’une facture : pas de lien ni d’acompte', () => {
    expect(factureDepuis(doc(), 'f1', '2026-10-12', [{ numero: 'x', ventilation: [] }])).toMatchObject({ originDocumentId: null, acomptes: [] })
  })

  it('copie : avoir et acompte redeviennent des factures, devis valable 30 jours', () => {
    expect(copieDe(doc({ type: 'avoir' }), '2026-10-12').type).toBe('facture')
    expect(copieDe(doc({ type: 'acompte' }), '2026-10-12').type).toBe('facture')
    expect(copieDe(doc({ type: 'devis' }), '2026-10-12')).toMatchObject({ type: 'devis', validUntil: '2026-11-11', originDocumentId: null })
  })
})
