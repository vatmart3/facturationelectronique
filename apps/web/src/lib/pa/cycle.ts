/**
 * Statuts du cycle de vie des factures électroniques (réforme française, norme XP Z12-012).
 * Quatre sont obligatoires : déposée, rejetée, refusée, encaissée.
 */

export interface Statut {
  libelle: string
  description: string
  obligatoire?: boolean
  /** Le flux n'évolue plus. */
  final?: boolean
  ton: 'neutre' | 'info' | 'ok' | 'attente' | 'alerte'
}

export const STATUTS: Record<number, Statut> = {
  200: { libelle: 'Déposée', description: 'Déposée sur la plateforme de l’émetteur.', obligatoire: true, ton: 'info' },
  201: { libelle: 'Émise', description: 'Émise par la plateforme de l’émetteur.', ton: 'info' },
  202: { libelle: 'Reçue', description: 'Reçue par la plateforme du destinataire.', ton: 'info' },
  203: { libelle: 'Mise à disposition', description: 'Mise à disposition du destinataire.', ton: 'info' },
  204: { libelle: 'Prise en charge', description: 'En cours de traitement chez le destinataire.', ton: 'attente' },
  205: { libelle: 'Approuvée', description: 'Approuvée par le destinataire.', ton: 'ok' },
  206: { libelle: 'Approuvée partiellement', description: 'Approuvée en partie par le destinataire.', ton: 'attente' },
  207: { libelle: 'En litige', description: 'Contestée par le destinataire.', ton: 'alerte' },
  208: { libelle: 'Suspendue', description: 'Suspendue dans l’attente d’un complément.', ton: 'attente' },
  209: { libelle: 'Complétée', description: 'Complétée par l’émetteur.', ton: 'info' },
  210: { libelle: 'Refusée', description: 'Refusée par le destinataire.', obligatoire: true, final: true, ton: 'alerte' },
  211: { libelle: 'Paiement transmis', description: 'Le destinataire a ordonné le paiement.', ton: 'ok' },
  212: { libelle: 'Encaissée', description: 'Paiement encaissé par l’émetteur.', obligatoire: true, final: true, ton: 'ok' },
  213: { libelle: 'Rejetée', description: 'Rejetée par une plateforme (contrôle de format ou de données).', obligatoire: true, final: true, ton: 'alerte' },
}

export function libelleStatut(code: number): string {
  return STATUTS[code]?.libelle ?? `Statut ${code}`
}

export interface Evenement {
  code: number
  libelle: string
  date: string
  motif?: string | null
}

export function evenement(code: number, date = new Date(), motif?: string | null): Evenement {
  return { code, libelle: libelleStatut(code), date: date.toISOString(), ...(motif ? { motif } : {}) }
}

/** Parcours simulé d'une facture émise : un pas par consultation, jusqu'à l'approbation. */
const PARCOURS = [200, 201, 202, 203, 204, 205]

export function suivantSimule(code: number): number | null {
  const i = PARCOURS.indexOf(code)
  return i >= 0 && i < PARCOURS.length - 1 ? PARCOURS[i + 1]! : null
}

/** Décision sur une facture reçue → statut à renvoyer à l'émetteur. */
export const DECISIONS = {
  approuvee: 205,
  refusee: 210,
  litige: 207,
  payee: 211,
} as const

export type Decision = keyof typeof DECISIONS
