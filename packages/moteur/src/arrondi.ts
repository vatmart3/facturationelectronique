/**
 * Arithmétique monétaire exacte.
 *
 * Règle d'arrondi PASTILLE (constante, appliquée à l'écran, dans le PDF et dans le XML) :
 * au centime le plus proche, les demis s'éloignant de zéro (« half-up » commercial).
 * Le choix « loin de zéro » rend l'arrondi symétrique : un avoir est exactement
 * l'opposé de la facture qu'il annule.
 *
 * Les produits intermédiaires passent par BigInt : aucune perte de précision,
 * même pour des quantités ou des prix très grands.
 */

export class ErreurMontant extends TypeError {
  override name = 'ErreurMontant'
}

/** Vérifie qu'une valeur est un entier sûr (centimes, millièmes, points de base). */
export function exigerEntier(valeur: number, nom: string): number {
  if (!Number.isSafeInteger(valeur)) {
    throw new ErreurMontant(`${nom} doit être un entier (reçu : ${valeur})`)
  }
  return valeur
}

/** Division entière arrondie au plus proche, demis loin de zéro. */
export function diviserArrondi(numerateur: bigint, diviseur: bigint): bigint {
  if (diviseur === 0n) throw new ErreurMontant('Division par zéro')
  const negatif = numerateur < 0n !== diviseur < 0n
  const n = numerateur < 0n ? -numerateur : numerateur
  const d = diviseur < 0n ? -diviseur : diviseur
  const q = (n * 2n + d) / (d * 2n)
  return negatif ? -q : q
}

/** round(a × b / d) exact. */
export function multiplierDiviser(a: number, b: number, d: number): number {
  exigerEntier(a, 'a')
  exigerEntier(b, 'b')
  exigerEntier(d, 'd')
  const r = diviserArrondi(BigInt(a) * BigInt(b), BigInt(d))
  if (r > BigInt(Number.MAX_SAFE_INTEGER) || r < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new ErreurMontant('Montant hors limites')
  }
  return Number(r)
}

/**
 * Répartit un montant entier au prorata de poids entiers, sans perte :
 * la somme des parts vaut exactement `total` (méthode du plus fort reste,
 * égalités départagées par l'ordre des poids).
 */
export function repartir(total: number, poids: readonly number[]): number[] {
  exigerEntier(total, 'total')
  poids.forEach((p, i) => exigerEntier(p, `poids[${i}]`))
  const somme = poids.reduce((s, p) => s + p, 0)
  if (poids.length === 0) {
    if (total !== 0) throw new ErreurMontant('Impossible de répartir un montant sans poids')
    return []
  }
  if (poids.some((p) => p > 0) && poids.some((p) => p < 0)) {
    throw new ErreurMontant('Les poids d’une répartition doivent être de même signe')
  }
  if (somme === 0) {
    if (total !== 0) throw new ErreurMontant('Impossible de répartir un montant sur des poids nuls')
    return poids.map(() => 0)
  }
  if (somme < 0) {
    return repartir(-total, poids.map((p) => -p)).map((p) => (p === 0 ? 0 : -p))
  }

  const signe = total < 0 ? -1n : 1n
  const t = BigInt(total) * signe
  const s = BigInt(somme)
  const parts = poids.map((p) => (t * BigInt(p)) / s)
  const restes = poids.map((p, i) => ({ i, reste: t * BigInt(p) - parts[i]! * s }))
  let aDistribuer = t - parts.reduce((a, b) => a + b, 0n)
  restes.sort((a, b) => (b.reste > a.reste ? 1 : b.reste < a.reste ? -1 : a.i - b.i))
  for (const { i } of restes) {
    if (aDistribuer === 0n) break
    parts[i] = parts[i]! + 1n
    aDistribuer -= 1n
  }
  return parts.map((p) => Number(p * signe))
}
