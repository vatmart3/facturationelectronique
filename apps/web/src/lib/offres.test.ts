import { describe, expect, it } from 'vitest'
import { aLaFonction, etatAbonnement, OFFRES, offre } from './offres'

const maintenant = new Date('2026-10-12T12:00:00Z')
const base = { plan: 'pro' as const, trial_ends_at: null, current_period_end: null, cancel_at_period_end: false }

describe('offres', () => {
  it('trois offres, Pro au centre, prix croissants', () => {
    expect(OFFRES.map((o) => o.code)).toEqual(['solo', 'pro', 'studio'])
    expect(OFFRES.map((o) => o.prix)).toEqual([900, 1900, 4900])
    expect(offre('studio').utilisateurs).toBe(10)
  })

  it('essai en cours, bientôt fini, terminé', () => {
    expect(etatAbonnement({ ...base, status: 'trialing', trial_ends_at: '2026-10-22T12:00:00Z' }, maintenant)).toMatchObject({ actif: true, essai: true, joursRestants: 10, libelle: 'Essai gratuit · 10 jours restants', ton: 'ok' })
    expect(etatAbonnement({ ...base, status: 'trialing', trial_ends_at: '2026-10-13T11:00:00Z' }, maintenant)).toMatchObject({ joursRestants: 1, libelle: 'Essai gratuit · 1 jour restant', ton: 'attente' })
    expect(etatAbonnement({ ...base, status: 'trialing', trial_ends_at: '2026-10-11T12:00:00Z' }, maintenant)).toMatchObject({ actif: false, libelle: 'Essai terminé', ton: 'alerte' })
  })

  it('abonnement actif, en retard, résilié, absent', () => {
    expect(etatAbonnement({ ...base, status: 'active', current_period_end: '2026-11-12T12:00:00Z' }, maintenant)).toMatchObject({ actif: true, joursRestants: 31, libelle: 'Actif' })
    expect(etatAbonnement({ ...base, status: 'active', cancel_at_period_end: true }, maintenant)).toMatchObject({ libelle: 'Résiliation en fin de période', ton: 'attente' })
    expect(etatAbonnement({ ...base, status: 'past_due' }, maintenant)).toMatchObject({ actif: true, libelle: 'Paiement en retard' })
    expect(etatAbonnement({ ...base, status: 'canceled' }, maintenant)).toMatchObject({ actif: false, libelle: 'Résilié' })
    expect(etatAbonnement({ ...base, status: 'unpaid' }, maintenant)).toMatchObject({ actif: false, libelle: 'Paiement requis' })
    expect(etatAbonnement(null)).toMatchObject({ actif: false, libelle: 'Aucun abonnement' })
  })

  it('fonctions par offre', () => {
    const solo = etatAbonnement({ ...base, plan: 'solo', status: 'active' }, maintenant)
    const pro = etatAbonnement({ ...base, status: 'active' }, maintenant)
    expect(aLaFonction(solo, 'plateforme')).toBe(false)
    expect(aLaFonction(pro, 'plateforme')).toBe(true)
    expect(aLaFonction(pro, 'multi')).toBe(false)
    expect(aLaFonction({ ...pro, actif: false }, 'plateforme')).toBe(false)
  })
})
