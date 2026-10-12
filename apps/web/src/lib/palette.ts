import { normaliserNom } from './avatar'
import { toutesLesEntrees } from './navigation'

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
    ...toutesLesEntrees().map(({ groupe, entree }) => ({
      id: `nav:${entree.chemin}`,
      libelle: entree.libelle,
      type: groupe,
      href: `/${slug}/${entree.chemin}`,
    })),
    { id: 'reglages:membres', libelle: 'Membres et rôles', type: 'Réglages', href: `/${slug}/reglages/membres` },
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
