/** Initiales et teinte stables d'un avatar, calculées depuis un nom. */

const MOTS_IGNORES = new Set([
  'de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'et',
  'sarl', 'sas', 'sasu', 'eurl', 'sa', 'sci', 'snc', 'scop', 'ei', 'eirl', 'selarl', 'gmbh', 'ltd',
])

export const TEINTES_AVATAR = ['info', 'ok', 'attente', 'avoir', 'alerte', 'neutre'] as const
export type TeinteAvatar = (typeof TEINTES_AVATAR)[number]

export function normaliserNom(nom: string): string {
  return nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function initiales(nom: string): string {
  const mots = normaliserNom(nom)
    .split(/[\s'’\-]+/)
    .filter((m) => m && !MOTS_IGNORES.has(m))
  if (mots.length === 0) return '?'
  if (mots.length === 1) return mots[0]!.slice(0, 2).toUpperCase()
  return (mots[0]![0]! + mots[1]![0]!).toUpperCase()
}

/** FNV-1a 32 bits : rapide, stable entre navigateur et serveur. */
export function fnv1a(texte: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

export function teinteAvatar(nom: string): TeinteAvatar {
  return TEINTES_AVATAR[fnv1a(normaliserNom(nom)) % TEINTES_AVATAR.length]!
}
