/**
 * Catégories de l'application. Source unique pour la barre latérale, le fil d'Ariane
 * et la palette de commande. `phase` indique quand la vue est construite.
 */

export type IconeNav =
  | 'tableau'
  | 'facture'
  | 'devis'
  | 'avoir'
  | 'recurrence'
  | 'clients'
  | 'relances'
  | 'catalogue'
  | 'paiements'
  | 'recues'
  | 'ereporting'
  | 'reforme'
  | 'exports'
  | 'reglages'
  | 'aide'

export interface EntreeNav {
  /** Chemin relatif à /[org], sans barre initiale. */
  chemin: string
  libelle: string
  icone: IconeNav
  phase: number
  description: string
}

export interface GroupeNav {
  titre: string
  entrees: EntreeNav[]
}

export const NAVIGATION: GroupeNav[] = [
  {
    titre: 'Pilotage',
    entrees: [
      {
        chemin: 'tableau-de-bord',
        libelle: 'Tableau de bord',
        icone: 'tableau',
        phase: 8,
        description: 'Encaissé, en attente, en retard, chiffre d’affaires et TVA collectée par taux.',
      },
    ],
  },
  {
    titre: 'Ventes',
    entrees: [
      {
        chemin: 'ventes/factures',
        libelle: 'Factures',
        icone: 'facture',
        phase: 4,
        description: 'Création, émission, envoi et suivi des factures, avec contrôle de conformité.',
      },
      {
        chemin: 'ventes/devis',
        libelle: 'Devis',
        icone: 'devis',
        phase: 4,
        description: 'Devis envoyés, acceptés, refusés ou expirés, signature en ligne et conversion en facture.',
      },
      {
        chemin: 'ventes/avoirs',
        libelle: 'Avoirs',
        icone: 'avoir',
        phase: 4,
        description: 'Avoirs totaux ou partiels, toujours rattachés à la facture d’origine.',
      },
      {
        chemin: 'ventes/recurrences',
        libelle: 'Récurrences',
        icone: 'recurrence',
        phase: 8,
        description: 'Factures mensuelles, trimestrielles ou annuelles, en brouillon ou émises automatiquement.',
      },
    ],
  },
  {
    titre: 'Relation client',
    entrees: [
      {
        chemin: 'clients',
        libelle: 'Clients',
        icone: 'clients',
        phase: 3,
        description: 'Fiches clients par catégorie fiscale, contacts, tarifs spécifiques et historique.',
      },
      {
        chemin: 'relances',
        libelle: 'Relances',
        icone: 'relances',
        phase: 8,
        description: 'Scénarios de relance, modèles d’emails et historique des envois.',
      },
    ],
  },
  {
    titre: 'Catalogue',
    entrees: [
      {
        chemin: 'catalogue',
        libelle: 'Articles et prestations',
        icone: 'catalogue',
        phase: 3,
        description: 'Articles, unités, prix HT ou TTC, taux de TVA, nature bien ou service.',
      },
    ],
  },
  {
    titre: 'Trésorerie',
    entrees: [
      {
        chemin: 'tresorerie/paiements',
        libelle: 'Paiements',
        icone: 'paiements',
        phase: 8,
        description: 'Encaissements, paiements partiels et rapprochement avec les factures.',
      },
    ],
  },
  {
    titre: 'Facturation électronique',
    entrees: [
      {
        chemin: 'e-facturation/recues',
        libelle: 'Factures reçues',
        icone: 'recues',
        phase: 9,
        description: 'Factures fournisseurs reçues via la plateforme agréée, à approuver ou refuser.',
      },
      {
        chemin: 'e-facturation/e-reporting',
        libelle: 'E-reporting',
        icone: 'ereporting',
        phase: 9,
        description: 'Données de transactions et de paiements transmises via la plateforme agréée.',
      },
      {
        chemin: 'e-facturation/reforme',
        libelle: 'Réforme 2027',
        icone: 'reforme',
        phase: 9,
        description: 'Réception, émission, e-reporting, annuaire : ce qui est prêt et ce qu’il reste à faire.',
      },
    ],
  },
  {
    titre: 'Comptabilité',
    entrees: [
      {
        chemin: 'comptabilite/exports',
        libelle: 'Exports comptables',
        icone: 'exports',
        phase: 8,
        description: 'Écritures de ventes, journal des ventes, état de TVA et archives par période.',
      },
    ],
  },
]

export const NAVIGATION_COMPTE: EntreeNav[] = [
  {
    chemin: 'reglages',
    libelle: 'Réglages',
    icone: 'reglages',
    phase: 1,
    description: 'Identité de l’entreprise, membres et rôles.',
  },
  {
    chemin: 'aide',
    libelle: 'Aide',
    icone: 'aide',
    phase: 11,
    description: 'Centre d’aide et tutoriels courts.',
  },
]

export interface EntreeTrouvee {
  groupe: string
  entree: EntreeNav
}

export function toutesLesEntrees(): EntreeTrouvee[] {
  return [
    ...NAVIGATION.flatMap((g) => g.entrees.map((entree) => ({ groupe: g.titre, entree }))),
    ...NAVIGATION_COMPTE.map((entree) => ({ groupe: 'Compte', entree })),
  ]
}

/** Retrouve l'entrée la plus spécifique correspondant à un chemin relatif à l'organisation. */
export function trouverEntree(cheminRelatif: string): EntreeTrouvee | undefined {
  const chemin = cheminRelatif.replace(/^\/+|\/+$/g, '')
  return toutesLesEntrees()
    .filter(({ entree }) => chemin === entree.chemin || chemin.startsWith(`${entree.chemin}/`))
    .sort((a, b) => b.entree.chemin.length - a.entree.chemin.length)[0]
}

/** Chemin relatif à l'organisation à partir d'un pathname complet (/mon-org/ventes/factures → ventes/factures). */
export function cheminDansOrganisation(pathname: string, slug: string): string {
  const prefixe = `/${slug}`
  if (pathname === prefixe) return ''
  return pathname.startsWith(`${prefixe}/`) ? pathname.slice(prefixe.length + 1) : ''
}
