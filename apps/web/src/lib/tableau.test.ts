import { describe, expect, it } from 'vitest'
import { calculerTableau, type DocStat } from './tableau'

const d = (p: Partial<DocStat> & Pick<DocStat, 'id'>): DocStat => ({
  type: 'facture',
  status: 'emis',
  issue_date: '2026-10-01',
  due_date: '2026-10-31',
  valid_until: null,
  total_ht: 10000,
  total_ttc: 12000,
  amount_due: 12000,
  amount_paid: 0,
  ...p,
})

describe('tableau de bord', () => {
  const docs = [
    d({ id: 'attente' }),
    d({ id: 'retard', due_date: '2026-10-01', amount_paid: 2000, status: 'partiellement_paye' }),
    d({ id: 'payee', issue_date: '2026-09-01', status: 'paye', amount_paid: 12000 }),
    d({ id: 'avoir', type: 'avoir', issue_date: '2026-10-05', total_ht: -5000, total_ttc: -6000, amount_due: -6000 }),
    d({ id: 'brouillon', status: 'brouillon', total_ht: 99999 }),
    d({ id: 'devis', type: 'devis', status: 'envoye', valid_until: '2026-11-01', total_ttc: 50000 }),
    d({ id: 'devis-expire', type: 'devis', status: 'envoye', valid_until: '2026-10-01' }),
    d({ id: 'ancienne', issue_date: '2025-06-01', status: 'paye' }),
  ]
  const paiements = [
    { document_id: 'payee', paid_on: '2026-09-21', amount_cents: 12000 },
    { document_id: 'retard', paid_on: '2026-10-05', amount_cents: 2000 },
  ]
  const tva = [
    { document_id: 'attente', vat_category: 'S' as const, vat_rate: 2000, base_cents: 10000, vat_cents: 2000 },
    { document_id: 'retard', vat_category: 'S' as const, vat_rate: 2000, base_cents: 10000, vat_cents: 2000 },
    { document_id: 'avoir', vat_category: 'S' as const, vat_rate: 550, base_cents: -5000, vat_cents: -275 },
    { document_id: 'payee', vat_category: 'S' as const, vat_rate: 2000, base_cents: 10000, vat_cents: 2000 },
  ]
  const t = calculerTableau(docs, paiements, tva, '2026-10-12')

  it('encaissements, attente et retard', () => {
    expect(t.encaisseMois).toBe(2000)
    expect(t.nbPaiementsMois).toBe(1)
    expect(t.enAttente).toEqual({ montant: 12000, nombre: 1 })
    expect(t.enRetard).toEqual({ montant: 10000, nombre: 1 })
    expect(t.brouillons).toBe(1)
  })

  it('chiffre d’affaires : exercice et 12 mois, avoirs déduits, brouillons exclus', () => {
    expect(t.caExercice).toBe(10000 + 10000 + 10000 - 5000)
    expect(t.caMensuel).toHaveLength(12)
    expect(t.caMensuel.at(-1)).toMatchObject({ mois: '2026-10', ht: 15000 })
    expect(t.caMensuel.at(-2)).toMatchObject({ mois: '2026-09', ht: 10000 })
    expect(t.caMensuel[0]!.mois).toBe('2025-11')
  })

  it('TVA du mois par taux, devis en attente, délai moyen', () => {
    expect(t.tvaMois).toEqual([
      { categorie: 'S', taux: 2000, base: 20000, tva: 4000 },
      { categorie: 'S', taux: 550, base: -5000, tva: -275 },
    ])
    expect(t.devisEnAttente).toEqual({ montant: 50000, nombre: 1 })
    expect(t.delaiMoyen).toBe(20)
    expect(calculerTableau([], [], [], '2026-10-12').delaiMoyen).toBeNull()
  })
})
