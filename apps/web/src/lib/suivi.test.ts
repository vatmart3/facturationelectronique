import { describe, expect, it } from 'vitest'
import {
  analyserEtapes,
  echeancesDues,
  libelleEtape,
  libelleMoyen,
  periodeLibelle,
  prochaineDate,
  relancesDues,
  remplacerVariables,
  validerPaiement,
} from './suivi'

describe('paiements', () => {
  const s = { montant: '120,50', date: '2026-10-10', moyen: 'virement', reference: '  VIR 123 ' }
  it('valide un paiement', () => {
    expect(validerPaiement(s, 20000, '2026-10-12')).toEqual({ ok: true, amount_cents: 12050, paid_on: '2026-10-10', method: 'virement', reference: 'VIR 123' })
    expect(validerPaiement({ ...s, reference: '' }, 20000, '2026-10-12')).toMatchObject({ reference: null })
    expect(libelleMoyen('cheque')).toBe('Chèque')
  })
  it('refuse les saisies invalides', () => {
    expect(validerPaiement({ ...s, montant: 'abc' }, 20000, '2026-10-12')).toMatchObject({ ok: false })
    expect(validerPaiement({ ...s, montant: '0' }, 20000, '2026-10-12')).toMatchObject({ ok: false })
    expect(validerPaiement(s, 1000, '2026-10-12')).toMatchObject({ erreur: 'Le montant dépasse le reste à payer.' })
    expect(validerPaiement({ ...s, date: '10/10' }, 20000, '2026-10-12')).toMatchObject({ erreur: 'Date invalide.' })
    expect(validerPaiement({ ...s, date: '2026-10-13' }, 20000, '2026-10-12')).toMatchObject({ ok: false })
    expect(validerPaiement({ ...s, moyen: 'bitcoin' }, 20000, '2026-10-12')).toMatchObject({ ok: false })
  })
})

describe('relances', () => {
  const etapes = [-3, 7, 15, 30]
  const f = (id: string, due_date: string | null, status = 'envoye', relancesClient = true) => ({ id, due_date, status, relancesClient })

  it('choisit l’étape la plus récente atteinte, jamais deux fois', () => {
    const factures = [
      f('avant', '2026-10-14'), // J-2 : étape -3 atteinte
      f('loin', '2026-10-30'), // J-18 : rien
      f('retard', '2026-09-25'), // J+17 : étape 15
      f('envoyee', '2026-10-04'), // J+8 : étape 7 déjà envoyée
      f('payee', '2026-09-01', 'paye'),
      f('sans', null),
      f('optout', '2026-09-01', 'envoye', false),
    ]
    const deja = new Map([['envoyee', new Set([7])]])
    expect(relancesDues(factures, etapes, deja, '2026-10-12')).toEqual([
      { id: 'avant', etape: -3, retard: -2 },
      { id: 'retard', etape: 15, retard: 17 },
    ])
  })

  it('libellés et saisie du scénario', () => {
    expect(libelleEtape(-3)).toBe('3 jours avant l’échéance')
    expect(libelleEtape(-1)).toBe('1 jour avant l’échéance')
    expect(libelleEtape(0)).toBe('Le jour de l’échéance')
    expect(libelleEtape(1)).toBe('1 jour après l’échéance')
    expect(libelleEtape(15)).toBe('15 jours après l’échéance')
    expect(analyserEtapes('15, -3; 7 7')).toEqual([-3, 7, 15])
    expect(analyserEtapes('1,2,3,4,5,6,7,8,9')).toBeNull()
    expect(analyserEtapes('500')).toBeNull()
    expect(analyserEtapes('x')).toBeNull()
  })
})

describe('récurrences', () => {
  it('date suivante avec jour d’ancrage', () => {
    expect(prochaineDate('2026-01-31', 'mensuelle')).toBe('2026-02-28')
    expect(prochaineDate('2026-02-28', 'mensuelle', 31)).toBe('2026-03-31')
    expect(prochaineDate('2028-01-31', 'mensuelle')).toBe('2028-02-29')
    expect(prochaineDate('2026-11-15', 'trimestrielle')).toBe('2027-02-15')
    expect(prochaineDate('2026-10-01', 'semestrielle')).toBe('2027-04-01')
    expect(prochaineDate('2026-10-01', 'annuelle')).toBe('2027-10-01')
  })

  it('échéances à rattraper, bornées par la fin et le maximum', () => {
    expect(echeancesDues({ next_date: '2026-08-01', end_date: null, frequency: 'mensuelle' }, '2026-10-12')).toEqual(['2026-08-01', '2026-09-01', '2026-10-01'])
    expect(echeancesDues({ next_date: '2026-08-01', end_date: '2026-09-15', frequency: 'mensuelle' }, '2026-10-12')).toEqual(['2026-08-01', '2026-09-01'])
    expect(echeancesDues({ next_date: '2026-11-01', end_date: null, frequency: 'mensuelle' }, '2026-10-12')).toEqual([])
    expect(echeancesDues({ next_date: '2020-01-01', end_date: null, frequency: 'mensuelle' }, '2026-10-12', 3)).toHaveLength(3)
  })

  it('libellés de période et variables', () => {
    expect(periodeLibelle('2026-10-01', 'mensuelle')).toBe('octobre 2026')
    expect(periodeLibelle('2026-11-01', 'trimestrielle')).toBe('T4 2026')
    expect(periodeLibelle('2026-04-01', 'semestrielle')).toBe('S1 2026')
    expect(periodeLibelle('2026-09-01', 'semestrielle')).toBe('S2 2026')
    expect(periodeLibelle('2026-04-01', 'annuelle')).toBe('2026')
    expect(remplacerVariables('Maintenance {periode} ({mois})', '2026-11-01', 'trimestrielle')).toBe('Maintenance T4 2026 (novembre 2026)')
  })
})
