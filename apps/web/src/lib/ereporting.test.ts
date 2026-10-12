import { describe, expect, it } from 'vitest'
import { periodeDe, periodePrecedente, rapportPaiements, rapportTransactions, type DocTransaction } from './ereporting'

describe('périodes', () => {
  it('décade, mois, bimestre', () => {
    expect(periodeDe('decade', '2026-10-05')).toMatchObject({ debut: '2026-10-01', fin: '2026-10-10', libelle: '1re décade de octobre 2026' })
    expect(periodeDe('decade', '2026-10-15')).toMatchObject({ debut: '2026-10-11', fin: '2026-10-20' })
    expect(periodeDe('decade', '2026-02-25')).toMatchObject({ debut: '2026-02-21', fin: '2026-02-28', libelle: '3e décade de février 2026' })
    expect(periodeDe('mois', '2026-10-12')).toMatchObject({ debut: '2026-10-01', fin: '2026-10-31', libelle: 'octobre 2026' })
    expect(periodeDe('bimestre', '2026-10-12')).toMatchObject({ debut: '2026-09-01', fin: '2026-10-31', libelle: 'septembre-octobre 2026' })
    expect(periodeDe('bimestre', '2026-11-03')).toMatchObject({ debut: '2026-11-01', fin: '2026-12-31' })
  })

  it('période précédente', () => {
    expect(periodePrecedente('decade', '2026-10-12')).toMatchObject({ debut: '2026-10-01', fin: '2026-10-10' })
    expect(periodePrecedente('mois', '2026-01-15')).toMatchObject({ debut: '2025-12-01', fin: '2025-12-31' })
    expect(periodePrecedente('bimestre', '2026-10-12')).toMatchObject({ debut: '2026-07-01', fin: '2026-08-31' })
  })
})

const doc = (p: Partial<DocTransaction> & Pick<DocTransaction, 'numero'>): DocTransaction => ({
  type: 'facture',
  date: '2026-10-05',
  client: { kind: 'b2c', pays: 'FR', tva: null, nom: 'Particulier' },
  categorieOperation: 'services',
  ventilation: [{ categorie: 'S', taux: 2000, base: 10000, tva: 2000 }],
  ...p,
})

describe('transactions', () => {
  const docs = [
    doc({ numero: 'F1' }),
    doc({ numero: 'F2', ventilation: [{ categorie: 'S', taux: 2000, base: 5000, tva: 1000 }, { categorie: 'S', taux: 550, base: 1000, tva: 55 }] }),
    doc({ numero: 'A1', type: 'avoir', ventilation: [{ categorie: 'S', taux: 2000, base: -2000, tva: -400 }] }),
    doc({ numero: 'B2B', client: { kind: 'b2b', pays: 'FR', tva: 'FR1', nom: 'Entreprise' } }),
    doc({ numero: 'UE', date: '2026-10-07', client: { kind: 'ue', pays: 'DE', tva: 'DE1', nom: 'GmbH' }, ventilation: [{ categorie: 'AE', taux: 0, base: 30000, tva: 0 }] }),
    doc({ numero: 'HORS', date: '2026-10-20' }),
  ]
  const r = rapportTransactions(docs, { debut: '2026-10-01', fin: '2026-10-10' })

  it('particuliers agrégés par jour, opération et taux ; B2B exclu ; hors période exclu', () => {
    expect(r.particuliers).toEqual([
      { date: '2026-10-05', operation: 'services', categorie: 'S', taux: 2000, base: 13000, tva: 2600, nombre: 3 },
      { date: '2026-10-05', operation: 'services', categorie: 'S', taux: 550, base: 1000, tva: 55, nombre: 0 },
    ])
  })

  it('international détaillé, totaux', () => {
    expect(r.international).toEqual([{ numero: 'UE', date: '2026-10-07', client: 'GmbH', pays: 'DE', tva: 'DE1', base: 30000, montantTva: 0 }])
    expect(r.totaux).toEqual({ base: 44000, tva: 2655, documents: 4 })
  })
})

describe('paiements', () => {
  const p = [
    { date: '2026-10-03', numero: 'F1', montant: 6000, categorieOperation: 'services' as const, ventilation: [{ taux: 2000, base: 5000, tva: 1000 }] },
    { date: '2026-10-03', numero: 'F2', montant: 1000, categorieOperation: 'mixte' as const, ventilation: [{ taux: 2000, base: 500, tva: 100 }, { taux: 550, base: 379, tva: 21 }] },
    { date: '2026-10-04', numero: 'F3', montant: 5000, categorieOperation: 'biens' as const, ventilation: [{ taux: 2000, base: 1, tva: 0 }] },
    { date: '2026-10-25', numero: 'F4', montant: 5000, categorieOperation: 'services' as const, ventilation: [{ taux: 2000, base: 1, tva: 0 }] },
    { date: '2026-10-05', numero: 'F5', montant: 100, categorieOperation: 'services' as const, ventilation: [] },
  ]
  it('services encaissés, répartis par taux ; biens et hors période exclus', () => {
    expect(rapportPaiements(p, { debut: '2026-10-01', fin: '2026-10-10' }, false)).toEqual([
      { date: '2026-10-03', taux: 2000, montant: 6600 },
      { date: '2026-10-03', taux: 550, montant: 400 },
    ])
  })
  it('TVA sur les débits : rien à déclarer', () => {
    expect(rapportPaiements(p, { debut: '2026-10-01', fin: '2026-10-31' }, true)).toEqual([])
  })
})
