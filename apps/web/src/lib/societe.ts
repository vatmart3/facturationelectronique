/**
 * Éditeur du service (mentions légales, CGU, CGV, confidentialité, DPA).
 * À renseigner par variables d'environnement avant la mise en vente.
 */
export const EDITEUR = {
  nom: process.env.EDITEUR_RAISON_SOCIALE ?? '[Raison sociale de l’éditeur]',
  forme: process.env.EDITEUR_FORME ?? '[forme juridique et capital]',
  siren: process.env.EDITEUR_SIREN ?? '[SIREN]',
  rcs: process.env.EDITEUR_RCS ?? '[ville d’immatriculation au RCS]',
  tva: process.env.EDITEUR_TVA ?? '[n° de TVA intracommunautaire]',
  adresse: process.env.EDITEUR_ADRESSE ?? '[adresse du siège]',
  directeur: process.env.EDITEUR_DIRECTEUR_PUBLICATION ?? '[directeur de la publication]',
  email: process.env.EDITEUR_EMAIL ?? 'contact@pastille.app',
  dpo: process.env.EDITEUR_EMAIL_DONNEES ?? 'donnees@pastille.app',
  hebergeur:
    'Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis (application) ; Supabase Inc., données hébergées dans l’Union européenne (région Paris, eu-west-3)',
  mediateur: process.env.EDITEUR_MEDIATEUR ?? '[médiateur de la consommation, si applicable]',
}
