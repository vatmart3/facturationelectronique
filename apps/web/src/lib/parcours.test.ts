import { describe, expect, it } from 'vitest'
import { etapesParcours } from './parcours'

const jour = '2026-10-19'
const doc = (type: 'facture' | 'devis' | 'avoir' | 'acompte', status: Parameters<typeof etapesParcours>[0]['status'], due_date: string | null = null, valid_until: string | null = null) => ({
  type,
  status,
  due_date,
  valid_until,
})
const etats = (e: ReturnType<typeof etapesParcours>) => e.map((x) => `${x.libelle}:${x.etat}`)

describe('etapesParcours', () => {
  it('suit une facture émise puis payée', () => {
    expect(etats(etapesParcours(doc('facture', 'emis', '2026-11-01'), jour))).toEqual(['Brouillon:fait', 'Émise:courant', 'Envoyée:avenir', 'Payée:avenir'])
    expect(etats(etapesParcours(doc('facture', 'paye'), jour))).toEqual(['Brouillon:fait', 'Émise:fait', 'Envoyée:fait', 'Payée:fait'])
  })

  it('signale le retard et le paiement partiel sur l’étape en cours', () => {
    expect(etats(etapesParcours(doc('facture', 'envoye', '2026-10-01'), jour))[2]).toBe('Envoyée · en retard:echec')
    expect(etats(etapesParcours(doc('acompte', 'partiellement_paye', '2026-12-01'), jour))[3]).toBe('Paiement partiel:courant')
  })

  it('termine une facture annulée sur un échec', () => {
    expect(etats(etapesParcours(doc('facture', 'annule'), jour))).toEqual(['Brouillon:fait', 'Émise:fait', 'Annulée:echec'])
  })

  it('suit un devis jusqu’à la facturation, ou son refus', () => {
    expect(etats(etapesParcours(doc('devis', 'accepte'), jour))).toEqual(['Brouillon:fait', 'Envoyé:fait', 'Accepté:courant', 'Facturé:avenir'])
    expect(etats(etapesParcours(doc('devis', 'transforme'), jour)).at(-1)).toBe('Facturé:fait')
    expect(etats(etapesParcours(doc('devis', 'refuse'), jour)).at(-1)).toBe('Refusé:echec')
    expect(etats(etapesParcours(doc('devis', 'envoye', null, '2026-10-01'), jour)).at(-1)).toBe('Expiré:echec')
  })

  it('suit un avoir', () => {
    expect(etats(etapesParcours(doc('avoir', 'emis'), jour))).toEqual(['Brouillon:fait', 'Émis:courant', 'Remboursé:avenir'])
  })
})
