import { describe, expect, it } from 'vitest'
import { codeClient, compteTva, ecritures, ENTETE_FEC, equilibre, etatTvaCsv, fec, journalCsv, type DocExport } from './exports'

const client = { id: '1234abcd-0000-0000-0000-000000000000', name: 'Atelier Dupont' }

const facture: DocExport = {
  id: 'f1',
  type: 'facture',
  number: 'F-2026-0042',
  issue_date: '2026-10-12',
  client,
  total_ht: 80600,
  total_ttc: 95355,
  lignes: [
    { nature: 'service', montant: 75600, compte: null, categorie: 'S', taux: 2000 },
    { nature: 'bien', montant: 10000, compte: null, categorie: 'S', taux: 550 },
  ],
  tva: [
    { categorie: 'S', taux: 2000, base: 71183, montant: 14237 },
    { categorie: 'S', taux: 550, base: 9417, montant: 518 },
  ],
}

const avoir: DocExport = {
  ...facture,
  id: 'a1',
  type: 'avoir',
  number: 'A-2026-0001',
  issue_date: '2026-10-13',
  total_ht: -10000,
  total_ttc: -12000,
  lignes: [{ nature: 'service', montant: -10000, compte: '706100', categorie: 'S', taux: 2000 }],
  tva: [{ categorie: 'S', taux: 2000, base: -10000, montant: -2000 }],
}

const acompte: DocExport = { ...facture, id: 'c1', type: 'acompte', number: 'F-2026-0040', issue_date: '2026-10-01', total_ht: 30000, total_ttc: 36000, tva: [{ categorie: 'S', taux: 2000, base: 30000, montant: 6000 }] }

describe('écritures de ventes', () => {
  const e = ecritures([avoir, facture, acompte])

  it('équilibrées, dans l’ordre chronologique, numérotées par pièce', () => {
    expect(equilibre(e)).toBe(true)
    expect([...new Set(e.map((x) => x.piece))]).toEqual(['F-2026-0040', 'F-2026-0042', 'A-2026-0001'])
    expect(e.filter((x) => x.piece === 'F-2026-0042').every((x) => x.numero === 2)).toBe(true)
  })

  it('facture : client au débit, produits répartis au centime près, TVA par taux', () => {
    const f = e.filter((x) => x.piece === 'F-2026-0042')
    expect(f[0]).toMatchObject({ compte: '411000', auxiliaire: 'C1234ABCD', debit: 95355, credit: 0 })
    const produits = f.filter((x) => x.compte.startsWith('70'))
    expect(produits.map((x) => [x.compte, x.credit])).toEqual([
      ['706000', 71183],
      ['707000', 9417],
    ])
    expect(f.filter((x) => x.compte.startsWith('4457')).map((x) => [x.compte, x.credit])).toEqual([
      ['445711', 14237],
      ['445713', 518],
    ])
  })

  it('avoir inversé, compte de produit spécifique ; acompte en 4191', () => {
    const a = e.filter((x) => x.piece === 'A-2026-0001')
    expect(a.map((x) => [x.compte, x.debit, x.credit])).toEqual([
      ['411000', 0, 12000],
      ['706100', 10000, 0],
      ['445711', 2000, 0],
    ])
    expect(e.filter((x) => x.piece === 'F-2026-0040').map((x) => x.compte)).toEqual(['411000', '419100', '445711'])
  })

  it('sans ligne exploitable : 706 par défaut ; montants nuls ignorés', () => {
    const vide = ecritures([{ ...facture, lignes: [{ nature: 'service', montant: 0, compte: null, categorie: 'E', taux: 0 }], tva: [{ categorie: 'E', taux: 0, base: 80600, montant: 0 }], total_ttc: 80600 }])
    expect(vide.map((x) => x.compte)).toEqual(['411000', '706000'])
    expect(equilibre(vide)).toBe(true)
    const sansTva = ecritures([{ ...facture, tva: [], total_ttc: 80600, lignes: [] }])
    expect(sansTva.map((x) => [x.compte, x.credit])).toEqual([['411000', 0], ['706000', 80600]])
  })
})

describe('fichiers', () => {
  const e = ecritures([facture, avoir])

  it('FEC : 18 colonnes, tabulations, dates compactes, montants à virgule', () => {
    const lignes = fec(e).trimEnd().split('\r\n')
    expect(lignes[0]).toBe(ENTETE_FEC.join('\t'))
    const premiere = lignes[1]!.split('\t')
    expect(premiere).toHaveLength(18)
    expect(premiere.slice(0, 5)).toEqual(['VT', 'Ventes', 'VT000001', '20261012', '411000'])
    expect(premiere[11]).toBe('953,55')
    expect(fec([{ ...e[0]!, libelle: 'a\tb|c' }])).toContain('a b c')
  })

  it('journal et état de TVA au format tableur', () => {
    const j = journalCsv(e)
    expect(j.startsWith('﻿Date;Pièce;')).toBe(true)
    expect(j).toContain('2026-10-12;F-2026-0042;411000;Clients;C1234ABCD;Atelier Dupont;Facture F-2026-0042 Atelier Dupont;953,55;0,00')
    const t = etatTvaCsv([facture, avoir, { ...facture, number: 'X', issue_date: '2026-09-01', lignes: [], tva: [{ categorie: 'S', taux: 2000, base: 100, montant: 20 }] }])
    expect(t).toContain('2026-09;S;20 %;1,00;0,20')
    expect(t).toContain('2026-10;S;20 %;611,83;122,37')
    expect(t).toContain('2026-10;S;5,5 %;94,17;5,18')
    expect(t.trimEnd().split('\r\n').at(-1)).toBe('Total;;;707,00;127,75')
    expect(journalCsv([{ ...e[0]!, libelle: 'Avec ; point-virgule' }])).toContain('"Avec ; point-virgule"')
  })

  it('comptes', () => {
    expect(compteTva(1000).numero).toBe('445712')
    expect(compteTva(1300)).toEqual({ numero: '445719', libelle: 'TVA collectée 13 %' })
    expect(codeClient('abcdef12-3456')).toBe('CABCDEF12')
  })
})
