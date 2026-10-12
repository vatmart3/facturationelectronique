/** Identifiant d'URL d'une organisation. Doit rester aligné sur private.slugify() en SQL. */
export function slugifier(texte: string): string {
  const slug = texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '')
  return slug.length >= 2 ? slug : `org-${slug}`.replace(/-+$/, '')
}
