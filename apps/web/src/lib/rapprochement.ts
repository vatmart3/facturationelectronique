import { associerColonnes, lireCsv } from './csv'
import { eurosEnCentimes } from './montant'

/**
 * Rapprochement bancaire : lecture d'un relevé CSV exporté depuis la banque, puis proposition,
 * pour chaque crédit, de la facture qu'il règle (numéro dans le libellé, montant, nom du client).
 */

export interface LigneReleve {
  index: number
  date: string
  libelle: string
  /** Centimes, positif pour un crédit. */
  montant: number
}

export interface FactureOuverte {
  id: string
  numero: string
  client: string | null
  /** Reste à payer, en centimes. */
  reste: number
}

export interface Proposition {
  ligne: LigneReleve
  factureId: string | null
  confiance: 'forte' | 'moyenne' | null
  raison: string
  dejaRapproche: boolean
}

const COLONNES = {
  date: ['date', 'date operation', 'date opération', 'date de l operation', 'date comptable', 'date de comptabilisation', 'booking date', 'date valeur', 'date de valeur'],
  libelle: ['libelle', 'libellé', 'libelle operation', 'libellé opération', 'libelle simplifie', 'description', 'intitule', 'détail', 'details', 'label', 'motif', 'communication', 'nature de l operation'],
  montant: ['montant', 'montant eur', 'montant (eur)', 'montant en euros', 'amount', 'valeur', 'somme'],
  credit: ['credit', 'crédit', 'credit eur', 'crédit (eur)', 'crédit euros', 'recette', 'encaissement'],
  debit: ['debit', 'débit', 'debit eur', 'débit (eur)', 'débit euros', 'depense', 'dépense'],
}

/** « 1 234,56 », « 1.234,56 », « 1,234.56 », « -45,00 € », « +12 » → centimes. */
export function lireMontant(saisie: string): number | null {
  let t = saisie.replace(/[\s  €]|EUR/gi, '').replace(/^\+/, '')
  if (!t) return null
  const virgule = t.lastIndexOf(',')
  const point = t.lastIndexOf('.')
  if (virgule >= 0 && point >= 0) t = virgule > point ? t.replace(/\./g, '') : t.replace(/,/g, '')
  else if ((t.match(/\./g) ?? []).length > 1) t = t.replace(/\./g, '')
  return eurosEnCentimes(t)
}

/** « 05/10/2026 », « 05-10-26 », « 05.10.2026 », « 2026-10-05 » → « 2026-10-05 ». */
export function lireDate(saisie: string): string | null {
  const t = saisie.trim()
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t)
  if (m) return valide(`${m[1]}-${m[2]}-${m[3]}`)
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(t)
  if (!m) return null
  const annee = m[3]!.length === 2 ? `20${m[3]}` : m[3]!
  return valide(`${annee}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`)
}

function valide(iso: string): string | null {
  const d = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso
}

export function lireReleve(contenu: string): { lignes: LigneReleve[]; ignorees: number } | { erreur: string } {
  const csv = lireCsv(contenu)
  const lignes = [csv.entetes, ...csv.lignes]
  // Certaines banques placent quelques lignes d'information (compte, période) avant les en-têtes.
  for (let debut = 0; debut < Math.min(15, lignes.length); debut++) {
    const c = associerColonnes(lignes[debut]!, COLONNES)
    if (c.date == null || c.libelle == null || (c.montant == null && c.credit == null)) continue
    const resultat: LigneReleve[] = []
    let ignorees = 0
    lignes.slice(debut + 1).forEach((l, i) => {
      const date = lireDate(l[c.date!] ?? '')
      const libelle = (l[c.libelle!] ?? '').replace(/\s+/g, ' ').trim()
      let montant: number | null
      if (c.montant != null) montant = lireMontant(l[c.montant] ?? '')
      else {
        const credit = lireMontant(l[c.credit!] ?? '') ?? 0
        const debit = c.debit != null ? (lireMontant(l[c.debit] ?? '') ?? 0) : 0
        montant = credit || debit ? Math.abs(credit) - Math.abs(debit) : null
      }
      if (!date || montant === null) ignorees++
      else resultat.push({ index: i, date, libelle, montant })
    })
    return { lignes: resultat, ignorees }
  }
  return { erreur: 'Colonnes introuvables : le fichier doit comporter une date, un libellé et un montant (ou des colonnes crédit et débit).' }
}

const compact = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

/** Mots distinctifs du nom du client (« Studio Kerozen SARL » → KEROZEN, STUDIO). */
function motsClient(nom: string | null): string[] {
  if (!nom) return []
  const communs = new Set(['SARL', 'SAS', 'SASU', 'EURL', 'SCI', 'SA', 'LES', 'DES', 'ET', 'DE', 'DU', 'LA', 'LE', 'STE', 'SOCIETE', 'CIE'])
  return nom
    .split(/[^\p{L}\p{N}]+/u)
    .map(compact)
    .filter((m) => m.length >= 4 && !communs.has(m))
}

/** Clé d'un paiement importé, pour ne pas enregistrer deux fois la même ligne de relevé. */
export function referenceReleve(libelle: string): string {
  return `Relevé : ${libelle}`.slice(0, 140)
}

export function cleDoublon(date: string, montant: number, reference: string): string {
  return `${date}|${montant}|${reference}`
}

export function proposer(lignes: LigneReleve[], factures: FactureOuverte[], dejaEnregistres: Set<string> = new Set()): Proposition[] {
  const restes = new Map(factures.map((f) => [f.id, f.reste]))
  const credits = lignes.filter((l) => l.montant > 0)
  const resultat = new Map<number, Proposition>()
  const prendre = (l: LigneReleve, f: FactureOuverte, confiance: 'forte' | 'moyenne', raison: string) => {
    restes.set(f.id, restes.get(f.id)! - l.montant)
    resultat.set(l.index, { ligne: l, factureId: f.id, confiance, raison, dejaRapproche: false })
  }

  for (const l of credits) {
    if (dejaEnregistres.has(cleDoublon(l.date, l.montant, referenceReleve(l.libelle)))) {
      resultat.set(l.index, { ligne: l, factureId: null, confiance: null, raison: 'Déjà enregistré lors d’un import précédent', dejaRapproche: true })
    }
  }
  // 1. Le numéro de facture figure dans le libellé du virement.
  for (const l of credits) {
    if (resultat.has(l.index)) continue
    const libelle = compact(l.libelle)
    const f = factures.find((x) => libelle.includes(compact(x.numero)) && restes.get(x.id)! >= l.montant)
    if (f) prendre(l, f, 'forte', l.montant === restes.get(f.id) ? `Numéro ${f.numero} dans le libellé, montant exact` : `Numéro ${f.numero} dans le libellé, paiement partiel`)
  }
  // 2. Même montant que le reste dû, départagé par le nom du client.
  for (const l of credits) {
    if (resultat.has(l.index)) continue
    const libelle = compact(l.libelle)
    const memes = factures.filter((x) => restes.get(x.id) === l.montant)
    const nommees = memes.filter((x) => motsClient(x.client).some((m) => libelle.includes(m)))
    // 3. Le nom du client figure dans le libellé et une seule de ses factures peut absorber le montant.
    const duClient = factures.filter((x) => restes.get(x.id)! >= l.montant && motsClient(x.client).some((m) => libelle.includes(m)))
    if (nommees.length >= 1) prendre(l, nommees[0]!, 'forte', `Montant exact et nom du client dans le libellé`)
    else if (memes.length === 1) prendre(l, memes[0]!, 'moyenne', 'Même montant que le reste dû')
    else if (memes.length === 0 && duClient.length === 1) prendre(l, duClient[0]!, 'moyenne', 'Nom du client dans le libellé, paiement partiel')
    else
      resultat.set(l.index, {
        ligne: l,
        factureId: null,
        confiance: null,
        raison: memes.length > 1 ? `${memes.length} factures ont ce montant : choisissez` : 'Aucune facture ouverte ne correspond',
        dejaRapproche: false,
      })
  }
  return credits.map((l) => resultat.get(l.index)!)
}
