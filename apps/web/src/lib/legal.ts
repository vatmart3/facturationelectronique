/**
 * Textes juridiques du service. Le contenu est structuré (titre, sections, paragraphes)
 * pour être rendu en HTML et, pour le DPA, en PDF téléchargeable.
 * À faire relire par un juriste avant la mise en vente.
 */

import { EDITEUR } from './societe'

export interface Section {
  titre: string
  paragraphes: string[]
}

export interface TexteLegal {
  slug: string
  titre: string
  description: string
  maj: string
  sections: Section[]
}

const MAJ = '12 octobre 2026'

export const TEXTES: TexteLegal[] = [
  {
    slug: 'mentions-legales',
    titre: 'Mentions légales',
    description: 'Éditeur, hébergeurs et contact du service Pastille.',
    maj: MAJ,
    sections: [
      { titre: 'Éditeur', paragraphes: [`${EDITEUR.nom}, ${EDITEUR.forme}, immatriculée au RCS de ${EDITEUR.rcs} sous le numéro ${EDITEUR.siren}, TVA ${EDITEUR.tva}, dont le siège est situé ${EDITEUR.adresse}.`, `Directeur de la publication : ${EDITEUR.directeur}. Contact : ${EDITEUR.email}.`] },
      { titre: 'Hébergement', paragraphes: [EDITEUR.hebergeur + '.'] },
      { titre: 'Propriété intellectuelle', paragraphes: ['Le service, sa marque, ses textes et son code sont protégés. Toute reproduction sans autorisation est interdite. Les polices Onest et Source Serif 4 sont utilisées sous licence SIL Open Font License.'] },
    ],
  },
  {
    slug: 'cgu',
    titre: 'Conditions générales d’utilisation',
    description: 'Règles d’utilisation du service Pastille.',
    maj: MAJ,
    sections: [
      { titre: 'Objet', paragraphes: ['Les présentes conditions encadrent l’utilisation de Pastille, service en ligne de création, d’émission, de transmission et de suivi de devis et de factures, édité par ' + EDITEUR.nom + '.'] },
      { titre: 'Compte', paragraphes: ['L’utilisateur crée un compte avec une adresse email valide et garde ses identifiants confidentiels. Il peut gérer plusieurs entreprises et y inviter des membres, dont les droits dépendent du rôle attribué (propriétaire, administrateur, facturation, lecture seule, expert-comptable).'] },
      {
        titre: 'Responsabilité de l’utilisateur',
        paragraphes: [
          'L’utilisateur reste seul responsable du contenu de ses documents, de l’exactitude des informations de son entreprise et de ses clients, et du respect de ses obligations fiscales et comptables.',
          'Pastille applique les règles de calcul, de numérotation et de mentions en vigueur et contrôle la conformité des documents avant leur émission ; ces contrôles ne remplacent pas le conseil d’un expert-comptable.',
        ],
      },
      {
        titre: 'Intégrité des documents',
        paragraphes: [
          'Un document émis reçoit un numéro définitif dans une série continue ; son contenu est figé et chaîné aux documents précédents par une empreinte numérique. Il ne peut être ni modifié ni supprimé : une correction passe par un avoir.',
        ],
      },
      { titre: 'Disponibilité', paragraphes: ['Le service est accessible en continu, sauf maintenance ou incident. L’éditeur met en œuvre les moyens raisonnables pour en assurer la disponibilité et la sécurité.'] },
      { titre: 'Données', paragraphes: ['L’utilisateur peut exporter à tout moment l’ensemble de ses données et de ses factures. Le traitement des données personnelles est décrit dans la politique de confidentialité.'] },
      { titre: 'Droit applicable', paragraphes: ['Les présentes conditions sont soumises au droit français.'] },
    ],
  },
  {
    slug: 'cgv',
    titre: 'Conditions générales de vente',
    description: 'Abonnements, essai, paiement et résiliation.',
    maj: MAJ,
    sections: [
      { titre: 'Offres', paragraphes: ['Pastille est proposé en abonnement mensuel par entreprise : Solo, Pro et Studio, dont le contenu et les prix hors taxes sont présentés sur la page Tarifs au jour de la souscription.'] },
      { titre: 'Essai gratuit', paragraphes: ['Chaque nouvelle entreprise bénéficie de 14 jours d’essai de l’offre Pro, sans moyen de paiement. À l’issue de l’essai, sans abonnement, les documents restent consultables et téléchargeables, mais la création et l’émission sont suspendues.'] },
      { titre: 'Paiement', paragraphes: ['Le paiement est mensuel, par carte bancaire ou prélèvement SEPA, via notre prestataire Stripe. Une facture est émise à chaque échéance.'] },
      { titre: 'Résiliation', paragraphes: ['L’abonnement est sans engagement et résiliable à tout moment depuis l’espace Abonnement ; la résiliation prend effet à la fin de la période en cours. Les données restent exportables.'] },
      { titre: 'Droit de rétractation', paragraphes: ['Le service s’adresse aux professionnels ; le droit de rétractation des consommateurs ne s’applique pas.'] },
      { titre: 'Médiation', paragraphes: [`Médiateur : ${EDITEUR.mediateur}.`] },
    ],
  },
  {
    slug: 'confidentialite',
    titre: 'Politique de confidentialité',
    description: 'Données collectées, finalités, durées de conservation et droits.',
    maj: MAJ,
    sections: [
      { titre: 'Responsable de traitement', paragraphes: [`${EDITEUR.nom} est responsable du traitement des données des utilisateurs du service. Contact : ${EDITEUR.dpo}.`, 'Pour les données des clients des utilisateurs (figurant sur leurs factures), l’utilisateur est responsable de traitement et Pastille agit en sous-traitant, selon l’accord de traitement (DPA).'] },
      { titre: 'Données traitées', paragraphes: ['Compte : nom, email, journal des connexions. Entreprises : identité légale, coordonnées bancaires, réglages. Documents et clients saisis par l’utilisateur. Paiement de l’abonnement : géré par Stripe, Pastille ne conserve aucun numéro de carte.'] },
      { titre: 'Finalités et bases légales', paragraphes: ['Fournir le service (exécution du contrat) ; respecter les obligations légales de conservation des factures (obligation légale) ; sécuriser le service et prévenir la fraude (intérêt légitime).'] },
      { titre: 'Durées de conservation', paragraphes: ['Compte : pendant la durée d’utilisation. Factures émises : 10 ans à compter de la clôture de l’exercice (article L102 B du livre des procédures fiscales), y compris après la suppression du compte. Journaux techniques : 12 mois.'] },
      { titre: 'Hébergement et transferts', paragraphes: ['Les données sont hébergées dans l’Union européenne (Supabase, région Paris). Les prestataires hors UE (Vercel pour l’affichage, Stripe pour le paiement, Resend pour l’envoi d’emails) sont encadrés par des clauses contractuelles types.'] },
      { titre: 'Vos droits', paragraphes: [`Accès, rectification, effacement, limitation, opposition et portabilité : depuis la page Mon compte (export complet, suppression) ou à ${EDITEUR.dpo}. Vous pouvez saisir la CNIL (www.cnil.fr).`] },
    ],
  },
  {
    slug: 'cookies',
    titre: 'Cookies',
    description: 'Pastille n’utilise que des cookies strictement nécessaires.',
    maj: MAJ,
    sections: [
      { titre: 'Cookies utilisés', paragraphes: ['Pastille dépose uniquement des cookies strictement nécessaires au fonctionnement du service : la session de connexion (Supabase Auth). Le choix du thème et des annonces masquées est conservé dans votre navigateur (stockage local).'] },
      { titre: 'Pas de traceurs', paragraphes: ['Aucun cookie publicitaire ni de mesure d’audience tierce n’est utilisé. Conformément aux lignes directrices de la CNIL, ces cookies nécessaires ne requièrent pas de consentement ; aucun bandeau ne vous est donc imposé.'] },
    ],
  },
  {
    slug: 'dpa',
    titre: 'Accord de traitement des données (DPA)',
    description: 'Engagements de Pastille comme sous-traitant (article 28 du RGPD).',
    maj: MAJ,
    sections: [
      { titre: 'Parties et objet', paragraphes: [`Le présent accord lie l’utilisateur (responsable de traitement) et ${EDITEUR.nom} (sous-traitant) pour le traitement des données personnelles de ses clients et contacts dans le cadre du service Pastille.`] },
      { titre: 'Nature et finalité', paragraphes: ['Hébergement, création, émission, transmission (plateforme agréée, email), archivage et export des devis et factures, relances, e-reporting.'] },
      { titre: 'Données et personnes concernées', paragraphes: ['Clients et contacts de l’utilisateur : identité, coordonnées, identifiants fiscaux, données de facturation et de paiement.'] },
      { titre: 'Obligations du sous-traitant', paragraphes: ['Traiter les données sur instruction documentée du responsable ; garantir la confidentialité des personnes autorisées ; mettre en œuvre les mesures de sécurité de l’article 32 ; aider le responsable à répondre aux demandes d’exercice des droits ; notifier toute violation de données dans les meilleurs délais ; supprimer ou restituer les données en fin de contrat, sous réserve des obligations légales de conservation.'] },
      { titre: 'Mesures de sécurité', paragraphes: ['Chiffrement en transit (TLS) et au repos ; isolement des données de chaque entreprise par des règles d’accès en base (Row Level Security) testées automatiquement ; documents émis figés et chaînés par empreinte SHA-256 ; journal d’audit non modifiable ; sauvegardes quotidiennes.'] },
      { titre: 'Sous-traitants ultérieurs', paragraphes: ['Supabase (hébergement des données, UE), Vercel (hébergement de l’application), Resend (envoi d’emails), Stripe (paiement de l’abonnement), la plateforme agréée choisie par l’utilisateur. Toute modification est notifiée au responsable, qui peut s’y opposer.'] },
      { titre: 'Durée', paragraphes: ['Le présent accord s’applique pendant toute la durée d’utilisation du service et jusqu’à la suppression ou la restitution des données.'] },
    ],
  },
]

export function texte(slug: string): TexteLegal | undefined {
  return TEXTES.find((t) => t.slug === slug)
}
