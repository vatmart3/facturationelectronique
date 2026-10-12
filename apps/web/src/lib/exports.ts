/**
 * Exports comptables : écritures de ventes équilibrées, fichier des écritures comptables (FEC,
 * art. A47 A-1 du LPF), journal des ventes et état de TVA au format tableur. Pur et testé.
 */

import { repartir, type CategorieTva } from '@pastille/moteur'

export interface DocExport {
  id: string
  type: 'facture' | 'acompte' | 'avoir'
  number: string
  issue_date: string
  client: { id: string; name: string }
  total_ht: number
  total_ttc: number
  lignes: Array<{ nature: 'bien' | 'service' | 'debours'; montant: number; compte: string | null; categorie: CategorieTva; taux: number }>
  tva: Array<{ categorie: CategorieTva; taux: number; base: number; montant: number }>
}

export interface Ecriture {
  numero: number
  date: string
  piece: string
  compte: string
  libelleCompte: string
  auxiliaire: string | null
  libelleAuxiliaire: string | null
  libelle: string
  debit: number
  credit: number
}

export const COMPTES = {
  clients: { numero: '411000', libelle: 'Clients' },
  acomptes: { numero: '419100', libelle: 'Clients - avances et acomptes reçus' },
  service: { numero: '706000', libelle: 'Prestations de services' },
  bien: { numero: '707000', libelle: 'Ventes de marchandises' },
  debours: { numero: '467000', libelle: 'Débours refacturés' },
} as const

const SUFFIXES_TVA: Record<number, string> = { 2000: '1', 1000: '2', 550: '3', 210: '4', 850: '5' }

export function compteTva(taux: number): { numero: string; libelle: string } {
  return { numero: `44571${SUFFIXES_TVA[taux] ?? '9'}`, libelle: `TVA collectée ${(taux / 100).toString().replace('.', ',')} %` }
}

/** Compte auxiliaire stable d'un client. */
export function codeClient(id: string): string {
  return `C${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`
}

/** Écritures d'un document : débit client TTC, crédit produits HT par compte, crédit TVA par taux. Les avoirs s'inversent. */
export function ecritures(docs: readonly DocExport[]): Ecriture[] {
  const resultat: Ecriture[] = []
  let numero = 0
  for (const d of [...docs].sort((a, b) => (a.issue_date + a.number < b.issue_date + b.number ? -1 : 1))) {
    numero++
    const libelle = `${d.type === 'avoir' ? 'Avoir' : d.type === 'acompte' ? 'Acompte' : 'Facture'} ${d.number} ${d.client.name}`.slice(0, 200)
    const ligne = (compte: { numero: string; libelle: string }, montant: number, cote: 'debit' | 'credit', aux = false): Ecriture | null => {
      if (montant === 0) return null
      // Un montant négatif (avoir) passe dans la colonne opposée.
      const sens = montant < 0 ? (cote === 'debit' ? 'credit' : 'debit') : cote
      return {
        numero,
        date: d.issue_date,
        piece: d.number,
        compte: compte.numero,
        libelleCompte: compte.libelle,
        auxiliaire: aux ? codeClient(d.client.id) : null,
        libelleAuxiliaire: aux ? d.client.name : null,
        libelle,
        debit: sens === 'debit' ? Math.abs(montant) : 0,
        credit: sens === 'credit' ? Math.abs(montant) : 0,
      }
    }
    const lignes: Array<Ecriture | null> = [ligne(COMPTES.clients, d.total_ttc, 'debit', true)]
    if (d.type === 'acompte') {
      lignes.push(ligne(COMPTES.acomptes, d.total_ht, 'credit'))
    } else {
      // Produits : la base HT de chaque taux (remise et acomptes déjà déduits) est répartie
      // sur les comptes de ses lignes ; la somme est donc exactement le total HT.
      const parCompte = new Map<string, { compte: { numero: string; libelle: string }; montant: number }>()
      const ajouter = (c: { numero: string; libelle: string }, montant: number) => {
        const e = parCompte.get(c.numero) ?? { compte: c, montant: 0 }
        e.montant += montant
        parCompte.set(c.numero, e)
      }
      const groupesTva = d.tva.length ? d.tva : [{ categorie: 'S' as CategorieTva, taux: 0, base: d.total_ht, montant: 0 }]
      for (const g of groupesTva) {
        const memes = d.lignes.filter((l) => l.categorie === g.categorie && (l.categorie !== 'S' || l.taux === g.taux) && l.montant !== 0)
        const compte = (l: DocExport['lignes'][number]) => (l.compte ? { numero: l.compte, libelle: 'Ventes' } : COMPTES[l.nature])
        if (memes.length === 0 || memes.some((l) => Math.sign(l.montant) !== Math.sign(memes[0]!.montant))) {
          ajouter(memes[0] ? compte(memes[0]) : COMPTES.service, g.base)
          continue
        }
        const parts = repartir(Math.abs(g.base), memes.map((l) => Math.abs(l.montant)))
        memes.forEach((l, i) => ajouter(compte(l), Math.sign(g.base) * parts[i]!))
      }
      for (const g of parCompte.values()) lignes.push(ligne(g.compte, g.montant, 'credit'))
    }
    for (const t of d.tva) if (t.montant !== 0) lignes.push(ligne(compteTva(t.taux), t.montant, 'credit'))
    resultat.push(...lignes.filter((x): x is Ecriture => x !== null))
  }
  return resultat
}

function decimal(centimes: number): string {
  return (centimes / 100).toFixed(2).replace('.', ',')
}

export const ENTETE_FEC = [
  'JournalCode',
  'JournalLib',
  'EcritureNum',
  'EcritureDate',
  'CompteNum',
  'CompteLib',
  'CompAuxNum',
  'CompAuxLib',
  'PieceRef',
  'PieceDate',
  'EcritureLib',
  'Debit',
  'Credit',
  'EcritureLet',
  'DateLet',
  'ValidDate',
  'Montantdevise',
  'Idevise',
]

/** FEC : 18 colonnes séparées par des tabulations, dates AAAAMMJJ, montants à virgule. */
export function fec(e: readonly Ecriture[]): string {
  const nettoyer = (t: string | null) => (t ?? '').replace(/[\t\r\n|]/g, ' ')
  const date = (iso: string) => iso.replace(/-/g, '')
  const lignes = e.map((x) =>
    [
      'VT',
      'Ventes',
      `VT${String(x.numero).padStart(6, '0')}`,
      date(x.date),
      x.compte,
      nettoyer(x.libelleCompte),
      nettoyer(x.auxiliaire),
      nettoyer(x.libelleAuxiliaire),
      nettoyer(x.piece),
      date(x.date),
      nettoyer(x.libelle),
      decimal(x.debit),
      decimal(x.credit),
      '',
      '',
      date(x.date),
      '',
      '',
    ].join('\t'),
  )
  return [ENTETE_FEC.join('\t'), ...lignes].join('\r\n') + '\r\n'
}

function csv(lignes: ReadonlyArray<ReadonlyArray<string>>): string {
  const cellule = (c: string) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)
  // BOM : Excel ouvre le fichier en UTF-8.
  return '﻿' + lignes.map((l) => l.map(cellule).join(';')).join('\r\n') + '\r\n'
}

export function journalCsv(e: readonly Ecriture[]): string {
  return csv([
    ['Date', 'Pièce', 'Compte', 'Libellé du compte', 'Compte client', 'Client', 'Libellé', 'Débit', 'Crédit'],
    ...e.map((x) => [x.date, x.piece, x.compte, x.libelleCompte, x.auxiliaire ?? '', x.libelleAuxiliaire ?? '', x.libelle, decimal(x.debit), decimal(x.credit)]),
  ])
}

export function etatTvaCsv(docs: readonly DocExport[]): string {
  const groupes = new Map<string, { mois: string; categorie: CategorieTva; taux: number; base: number; montant: number }>()
  for (const d of docs) {
    for (const t of d.tva) {
      const cle = `${d.issue_date.slice(0, 7)}|${t.categorie}|${t.taux}`
      const g = groupes.get(cle) ?? { mois: d.issue_date.slice(0, 7), categorie: t.categorie, taux: t.taux, base: 0, montant: 0 }
      g.base += t.base
      g.montant += t.montant
      groupes.set(cle, g)
    }
  }
  const tri = [...groupes.values()].sort((a, b) => (a.mois === b.mois ? b.taux - a.taux : a.mois < b.mois ? -1 : 1))
  return csv([
    ['Mois', 'Catégorie', 'Taux', 'Base HT', 'TVA collectée'],
    ...tri.map((g) => [g.mois, g.categorie, `${(g.taux / 100).toString().replace('.', ',')} %`, decimal(g.base), decimal(g.montant)]),
    ['Total', '', '', decimal(tri.reduce((s, g) => s + g.base, 0)), decimal(tri.reduce((s, g) => s + g.montant, 0))],
  ])
}

/** Contrôle : chaque pièce est équilibrée. */
export function equilibre(e: readonly Ecriture[]): boolean {
  const parPiece = new Map<number, number>()
  for (const x of e) parPiece.set(x.numero, (parPiece.get(x.numero) ?? 0) + x.debit - x.credit)
  return [...parPiece.values()].every((v) => v === 0)
}
