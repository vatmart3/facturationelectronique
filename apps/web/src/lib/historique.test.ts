import { describe, expect, it } from 'vitest'
import { construireHistorique, delaiMoyenPaiement } from './historique'

const documents = [
  { id: 'f1', type: 'facture' as const, status: 'paye', number: 'F-2026-0001', issue_date: '2026-09-01', total_ttc: 12000, currency: 'EUR' },
  { id: 'd1', type: 'devis' as const, status: 'accepte', number: 'D-2026-0001', issue_date: '2026-08-20', total_ttc: 12000, currency: 'EUR' },
  { id: 'b1', type: 'facture' as const, status: 'brouillon', number: null, issue_date: '2026-10-01', total_ttc: 500, currency: 'EUR' },
]

describe('construireHistorique', () => {
  it('mêle documents, paiements et envois, du plus récent au plus ancien, sans les brouillons', () => {
    const h = construireHistorique(
      documents,
      [{ id: 'p1', document_id: 'f1', amount_cents: 12000, paid_on: '2026-09-21', method: 'virement' }],
      [{ id: 'r1', document_id: 'f1', kind: 'relance', step: 1, recipient: 'compta@client.fr', sent_at: '2026-09-15T08:00:00Z', status: 'simule' }],
    )
    expect(h.map((e) => e.titre)).toEqual([
      'Paiement reçu · Facture F-2026-0001',
      'Relance n° 1 · Facture F-2026-0001',
      'Facture F-2026-0001 émise',
      'Devis D-2026-0001 créé',
    ])
    expect(h[0]?.icone).toBe('paiements')
    expect(h[1]?.detail).toBe('À compta@client.fr (simulé)')
  })
})

describe('delaiMoyenPaiement', () => {
  it('mesure le délai entre émission et dernier paiement des factures payées', () => {
    expect(
      delaiMoyenPaiement(documents, [
        { document_id: 'f1', paid_on: '2026-09-11' },
        { document_id: 'f1', paid_on: '2026-09-21' },
      ]),
    ).toBe(20)
    expect(delaiMoyenPaiement(documents, [])).toBeNull()
  })
})
