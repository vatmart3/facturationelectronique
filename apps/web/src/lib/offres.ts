/** Offres PASTILLE et état de l'abonnement d'une entreprise. Pur et testé. */

export type CodeOffre = 'solo' | 'pro' | 'studio'
export type Fonction = 'plateforme' | 'ereporting' | 'recurrences' | 'comptable' | 'multi' | 'marque_blanche' | 'api'

export interface Offre {
  code: CodeOffre
  nom: string
  cible: string
  /** Prix mensuel HT en centimes. */
  prix: number
  utilisateurs: number
  points: string[]
  fonctions: Fonction[]
}

export const OFFRES: Offre[] = [
  {
    code: 'solo',
    nom: 'Pastille Solo',
    cible: 'Micro-entrepreneurs et indépendants',
    prix: 900,
    utilisateurs: 1,
    points: ['1 entreprise, 1 utilisateur', 'Factures, devis et avoirs illimités', 'PDF Factur-X conforme EN 16931', 'Relances automatiques', 'Exports comptables'],
    fonctions: [],
  },
  {
    code: 'pro',
    nom: 'Pastille Pro',
    cible: 'TPE prêtes pour la réforme',
    prix: 1900,
    utilisateurs: 3,
    points: ['Tout Solo, plus :', 'Transmission via la plateforme agréée', 'E-reporting', 'Factures récurrentes', '3 utilisateurs dont votre expert-comptable'],
    fonctions: ['plateforme', 'ereporting', 'recurrences', 'comptable'],
  },
  {
    code: 'studio',
    nom: 'Pastille Studio',
    cible: 'Agences et cabinets',
    prix: 4900,
    utilisateurs: 10,
    points: ['Tout Pro, plus :', 'Plusieurs entreprises', '10 utilisateurs', 'Emails à vos couleurs', 'Accès API'],
    fonctions: ['plateforme', 'ereporting', 'recurrences', 'comptable', 'multi', 'marque_blanche', 'api'],
  },
]

export function offre(code: CodeOffre): Offre {
  return OFFRES.find((o) => o.code === code)!
}

export interface Abonnement {
  plan: CodeOffre
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'unpaid'
  trial_ends_at: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
}

export interface EtatAbonnement {
  actif: boolean
  plan: CodeOffre
  essai: boolean
  joursRestants: number | null
  libelle: string
  ton: 'ok' | 'attente' | 'alerte'
}

export function etatAbonnement(a: Abonnement | null, maintenant = new Date()): EtatAbonnement {
  if (!a) return { actif: false, plan: 'solo', essai: false, joursRestants: null, libelle: 'Aucun abonnement', ton: 'alerte' }
  const jours = (iso: string | null) => (iso ? Math.max(0, Math.ceil((Date.parse(iso) - maintenant.getTime()) / 86_400_000)) : null)
  if (a.status === 'trialing') {
    const restants = jours(a.trial_ends_at) ?? 0
    const actif = Boolean(a.trial_ends_at && Date.parse(a.trial_ends_at) > maintenant.getTime())
    return {
      actif,
      plan: a.plan,
      essai: true,
      joursRestants: restants,
      libelle: actif ? `Essai gratuit · ${restants} jour${restants > 1 ? 's' : ''} restant${restants > 1 ? 's' : ''}` : 'Essai terminé',
      ton: actif ? (restants <= 3 ? 'attente' : 'ok') : 'alerte',
    }
  }
  if (a.status === 'active') {
    return { actif: true, plan: a.plan, essai: false, joursRestants: jours(a.current_period_end), libelle: a.cancel_at_period_end ? 'Résiliation en fin de période' : 'Actif', ton: a.cancel_at_period_end ? 'attente' : 'ok' }
  }
  if (a.status === 'past_due') return { actif: true, plan: a.plan, essai: false, joursRestants: null, libelle: 'Paiement en retard', ton: 'attente' }
  return { actif: false, plan: a.plan, essai: false, joursRestants: null, libelle: a.status === 'canceled' ? 'Résilié' : 'Paiement requis', ton: 'alerte' }
}

export function aLaFonction(etat: EtatAbonnement, fonction: Fonction): boolean {
  return etat.actif && offre(etat.plan).fonctions.includes(fonction)
}
