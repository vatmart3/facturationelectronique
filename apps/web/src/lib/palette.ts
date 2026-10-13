import { normaliserNom } from './avatar'
import { toutesLesEntrees } from './navigation'

/** Créations les plus fréquentes : proposées en premier dans la palette et dans le menu « Créer ». */
export const CREATIONS = [
  { id: 'creer:facture', libelle: 'Nouvelle facture', chemin: 'ventes/factures/nouvelle', icone: 'facture' },
  { id: 'creer:devis', libelle: 'Nouveau devis', chemin: 'ventes/devis/nouveau', icone: 'devis' },
  { id: 'creer:client', libelle: 'Nouveau client', chemin: 'clients/nouveau', icone: 'clients' },
  { id: 'creer:article', libelle: 'Nouvel article', chemin: 'catalogue/nouveau', icone: 'catalogue' },
  { id: 'creer:import', libelle: 'Importer des clients', chemin: 'clients/import', icone: 'clients' },
] as const

/** Entrées de la palette de commande (Ctrl K). */
export interface EntreePalette {
  id: string
  libelle: string
  type: string
  href: string
  avatar?: string
}

export function construireEntrees(slug: string, organisations: Array<{ slug: string; nom: string }>): EntreePalette[] {
  return [
    ...CREATIONS.map((c) => ({ id: c.id, libelle: c.libelle, type: 'Créer', href: `/${slug}/${c.chemin}` })),
    ...toutesLesEntrees().map(({ groupe, entree }) => ({
      id: `nav:${entree.chemin}`,
      libelle: entree.libelle,
      type: groupe,
      href: `/${slug}/${entree.chemin}`,
    })),
    { id: 'reglages:membres', libelle: 'Membres et rôles', type: 'Réglages', href: `/${slug}/reglages/membres` },
    { id: 'reglages:facturation', libelle: 'Réglages de facturation', type: 'Réglages', href: `/${slug}/reglages/facturation` },
    { id: 'reglages:abonnement', libelle: 'Abonnement', type: 'Réglages', href: `/${slug}/reglages/abonnement` },
    { id: 'compte', libelle: 'Mon compte et mes données', type: 'Compte', href: '/compte' },
    ...organisations
      .filter((o) => o.slug !== slug)
      .map((o) => ({ id: `org:${o.slug}`, libelle: o.nom, type: 'Changer d’entreprise', href: `/${o.slug}/tableau-de-bord`, avatar: o.nom })),
    { id: 'org:nouvelle', libelle: 'Créer une entreprise', type: 'Action', href: '/bienvenue?nouvelle=1' },
  ]
}

export function filtrerEntrees(entrees: EntreePalette[], requete: string): EntreePalette[] {
  const mots = normaliserNom(requete).split(/\s+/).filter(Boolean)
  if (mots.length === 0) return entrees
  return entrees.filter((e) => {
    const texte = normaliserNom(`${e.type} ${e.libelle}`)
    return mots.every((m) => texte.includes(m))
  })
}
