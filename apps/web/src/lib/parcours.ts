import type { StatutDb, TypeDocument } from './document'

export type EtatEtape = 'fait' | 'courant' | 'avenir' | 'echec'
export interface Etape {
  libelle: string
  etat: EtatEtape
}

/** Étapes du cycle de vie d'un document, façon « path » Lightning : ce qui est fait, l'étape en cours, la suite. */
export function etapesParcours(
  d: { type: TypeDocument; status: StatutDb; due_date: string | null; valid_until: string | null },
  jour: string,
): Etape[] {
  const suite = (libelles: string[], courant: number, final = false): Etape[] =>
    libelles.map((libelle, i) => ({ libelle, etat: i < courant || (final && i === courant) ? 'fait' : i === courant ? 'courant' : 'avenir' }))
  const echec = (libelles: string[], dernier: string): Etape[] => [...libelles.map((libelle) => ({ libelle, etat: 'fait' as const })), { libelle: dernier, etat: 'echec' }]

  if (d.type === 'devis') {
    const etapes = ['Brouillon', 'Envoyé', 'Accepté', 'Facturé']
    if (d.status === 'refuse') return echec(['Brouillon', 'Envoyé'], 'Refusé')
    if (d.status === 'expire' || (d.status === 'envoye' && d.valid_until && d.valid_until < jour)) return echec(['Brouillon', 'Envoyé'], 'Expiré')
    const index = { brouillon: 0, envoye: 1, accepte: 2, transforme: 3 } as Partial<Record<StatutDb, number>>
    return suite(etapes, index[d.status] ?? 0, d.status === 'transforme')
  }
  if (d.type === 'avoir') return suite(['Brouillon', 'Émis', 'Remboursé'], d.status === 'brouillon' ? 0 : d.status === 'paye' ? 2 : 1, d.status === 'paye')
  if (d.status === 'annule') return echec(['Brouillon', 'Émise'], 'Annulée')

  const etapes = suite(['Brouillon', 'Émise', 'Envoyée', 'Payée'], { brouillon: 0, emis: 1, envoye: 2, partiellement_paye: 3, paye: 3 }[d.status as 'emis'] ?? 0, d.status === 'paye')
  if (d.status === 'partiellement_paye') etapes[3] = { libelle: 'Paiement partiel', etat: 'courant' }
  const ouverte = d.status === 'emis' || d.status === 'envoye' || d.status === 'partiellement_paye'
  if (ouverte && d.due_date && d.due_date < jour) {
    const courante = etapes.find((e) => e.etat === 'courant')
    if (courante) Object.assign(courante, { libelle: `${courante.libelle} · en retard`, etat: 'echec' })
  }
  return etapes
}
