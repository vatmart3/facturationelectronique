import { echapper } from './modele'

type Enfant = string | null | undefined | false
type Attributs = Record<string, string | null | undefined>

function attributs(a?: Attributs): string {
  if (!a) return ''
  return Object.entries(a)
    .filter((e): e is [string, string] => e[1] != null)
    .map(([k, v]) => ` ${k}="${echapper(v)}"`)
    .join('')
}

/** Élément composé ; vide (aucun enfant) → rien n'est écrit. */
export function el(nom: string, enfants: Enfant[], attrs?: Attributs): string {
  const contenu = enfants.filter(Boolean).join('')
  return contenu ? `<${nom}${attributs(attrs)}>${contenu}</${nom}>` : ''
}

/** Feuille texte ; valeur absente → rien n'est écrit. */
export function t(nom: string, valeur: string | null | undefined, attrs?: Attributs): string {
  if (valeur == null || valeur === '') return ''
  return `<${nom}${attributs(attrs)}>${echapper(valeur)}</${nom}>`
}
