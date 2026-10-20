import { describe, expect, it } from 'vitest'
import { cleDoublon, lireDate, lireMontant, lireReleve, proposer, referenceReleve, type FactureOuverte } from './rapprochement'

describe('lecture du relevé', () => {
  it('lit les montants et les dates des banques françaises', () => {
    expect(lireMontant('1 234,56')).toBe(123456)
    expect(lireMontant('1.234,56 €')).toBe(123456)
    expect(lireMontant('1,234.56')).toBe(123456)
    expect(lireMontant('-45,00')).toBe(-4500)
    expect(lireMontant('+12')).toBe(1200)
    expect(lireMontant('')).toBeNull()
    expect(lireDate('05/10/2026')).toBe('2026-10-05')
    expect(lireDate('5-10-26')).toBe('2026-10-05')
    expect(lireDate('2026-10-05')).toBe('2026-10-05')
    expect(lireDate('31/02/2026')).toBeNull()
  })

  it('trouve les en-têtes après des lignes d’information, avec colonnes débit et crédit', () => {
    const csv = [
      'Compte courant;FR76 3000 6000 0112 3456 7890 189',
      'Période;01/10/2026 au 15/10/2026',
      '',
      'Date opération;Libellé;Débit;Crédit',
      '05/10/2026;VIR SEPA MAISON FERRAND F-2026-0006;;6 000,00',
      '06/10/2026;PRLV URSSAF;1 200,00;',
      'total;;;',
    ].join('\n')
    const r = lireReleve(csv)
    expect('erreur' in r).toBe(false)
    if ('erreur' in r) return
    expect(r.lignes.map((l) => [l.date, l.montant])).toEqual([
      ['2026-10-05', 600000],
      ['2026-10-06', -120000],
    ])
    expect(r.ignorees).toBe(1)
  })

  it('signale un fichier sans colonnes reconnues', () => {
    expect(lireReleve('a;b\n1;2')).toEqual({ erreur: expect.stringContaining('Colonnes introuvables') })
  })
})

describe('propositions', () => {
  const factures: FactureOuverte[] = [
    { id: 'a', numero: 'F-2026-0006', client: 'Maison Ferrand', reste: 600000 },
    { id: 'b', numero: 'F-2026-0004', client: 'Boulangerie Martin', reste: 32400 },
    { id: 'c', numero: 'F-2026-0005', client: 'Studio Kerozen SARL', reste: 32400 },
    { id: 'd', numero: 'F-2026-0007', client: 'Claire Dubois', reste: 24000 },
  ]
  const ligne = (index: number, libelle: string, montant: number) => ({ index, date: '2026-10-10', libelle, montant })

  it('reconnaît le numéro de facture, même sans tirets, et le paiement partiel', () => {
    const [p1, p2] = proposer([ligne(0, 'VIR F20260006 FERRAND', 600000), ligne(1, 'VIR ACOMPTE F-2026-0007', 10000)], factures)
    expect(p1).toMatchObject({ factureId: 'a', confiance: 'forte' })
    expect(p2).toMatchObject({ factureId: 'd', confiance: 'forte', raison: expect.stringContaining('partiel') })
  })

  it('départage deux factures de même montant par le nom du client', () => {
    const [p] = proposer([ligne(0, 'VIREMENT STUDIO KEROZEN', 32400)], factures)
    expect(p).toMatchObject({ factureId: 'c', confiance: 'forte' })
    const [q] = proposer([ligne(0, 'VIREMENT RECU', 32400)], factures)
    expect(q).toMatchObject({ factureId: null, raison: '2 factures ont ce montant : choisissez' })
  })

  it('propose un montant unique avec une confiance moyenne et ignore les débits', () => {
    const r = proposer([ligne(0, 'VIR INST', 24000), ligne(1, 'CB RESTAURANT', -3500)], factures)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ factureId: 'd', confiance: 'moyenne' })
  })

  it('propose un paiement partiel quand seul le nom du client apparaît', () => {
    const [p] = proposer([ligne(0, 'VIR INST BOULANGERIE MARTIN', 10000)], factures)
    expect(p).toMatchObject({ factureId: 'b', confiance: 'moyenne', raison: expect.stringContaining('partiel') })
  })

  it('ne propose pas deux fois la même facture et repère les lignes déjà importées', () => {
    const r = proposer([ligne(0, 'VIR CLAIRE DUBOIS', 24000), ligne(1, 'VIR DUBOIS', 24000)], factures)
    expect(r.map((p) => p.factureId)).toEqual(['d', null])
    const deja = new Set([cleDoublon('2026-10-10', 24000, referenceReleve('VIR CLAIRE DUBOIS'))])
    expect(proposer([ligne(0, 'VIR CLAIRE DUBOIS', 24000)], factures, deja)[0]).toMatchObject({ dejaRapproche: true, factureId: null })
  })
})
