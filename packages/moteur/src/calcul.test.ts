import { describe, expect, it } from 'vitest'
import { ErreurMontant } from './arrondi'
import { calculerDocument, calculerLigne, categorieOperation, type LigneEntree } from './calcul'

let n = 0
function ligne(p: Partial<LigneEntree> = {}): LigneEntree {
  n += 1
  return {
    id: `l${n}`,
    designation: 'Prestation',
    quantite: 1000,
    prixUnitaireHt: 10_000,
    categorie: 'S',
    taux: 2000,
    nature: 'service',
    ...p,
  }
}

describe('calcul d’une ligne', () => {
  it('multiplie quantité et prix', () => {
    expect(calculerLigne(ligne({ quantite: 3000, prixUnitaireHt: 45_000 }))).toMatchObject({
      montantBrut: 135_000,
      montantRemise: 0,
      montantNet: 135_000,
    })
  })
  it('arrondit les quantités décimales au centime, demis loin de zéro', () => {
    expect(calculerLigne(ligne({ quantite: 1500, prixUnitaireHt: 8_333 })).montantNet).toBe(12_500)
    expect(calculerLigne(ligne({ quantite: -1500, prixUnitaireHt: 8_333 })).montantNet).toBe(-12_500)
    expect(calculerLigne(ligne({ quantite: 333, prixUnitaireHt: 100 })).montantNet).toBe(33)
  })
  it('applique une remise en pourcentage', () => {
    const l = calculerLigne(ligne({ quantite: 3000, prixUnitaireHt: 45_000, remise: { type: 'pourcentage', valeur: 1000 } }))
    expect(l).toMatchObject({ montantBrut: 135_000, montantRemise: 13_500, montantNet: 121_500 })
  })
  it('arrondit la remise en pourcentage', () => {
    // 12 345 × 12,5 % = 1 543,125 → 1 543
    const l = calculerLigne(ligne({ prixUnitaireHt: 12_345, remise: { type: 'pourcentage', valeur: 1250 } }))
    expect(l.montantRemise).toBe(1_543)
    expect(l.montantNet).toBe(10_802)
  })
  it('applique une remise en montant', () => {
    expect(calculerLigne(ligne({ prixUnitaireHt: 50_000, remise: { type: 'montant', valeur: 5_000 } })).montantNet).toBe(45_000)
  })
  it('accepte une remise de 100 % ou nulle', () => {
    expect(calculerLigne(ligne({ remise: { type: 'pourcentage', valeur: 10_000 } })).montantNet).toBe(0)
    expect(calculerLigne(ligne({ remise: { type: 'montant', valeur: 0 } })).montantNet).toBe(10_000)
  })
  it('refuse les remises incohérentes', () => {
    expect(() => calculerLigne(ligne({ remise: { type: 'montant', valeur: 20_000 } }))).toThrow(/dépasse/)
    expect(() => calculerLigne(ligne({ remise: { type: 'montant', valeur: -100 } }))).toThrow(/même signe/)
    expect(() => calculerLigne(ligne({ remise: { type: 'pourcentage', valeur: 10_001 } }))).toThrow(/entre 0 et 100/)
    expect(() => calculerLigne(ligne({ remise: { type: 'pourcentage', valeur: -1 } }))).toThrow(/entre 0 et 100/)
    expect(() => calculerLigne(ligne({ remise: { type: 'pourcentage', valeur: 1.5 } }))).toThrow(ErreurMontant)
  })
  it('refuse les données invalides', () => {
    expect(() => calculerLigne(ligne({ quantite: 1.5 }))).toThrow(ErreurMontant)
    expect(() => calculerLigne(ligne({ prixUnitaireHt: 10.5 }))).toThrow(ErreurMontant)
    expect(() => calculerLigne(ligne({ taux: 19.6 }))).toThrow(ErreurMontant)
    expect(() => calculerLigne(ligne({ taux: 10_001 }))).toThrow(/hors limites/)
    expect(() => calculerLigne(ligne({ taux: -1 }))).toThrow(/hors limites/)
    expect(() => calculerLigne(ligne({ taux: 0 }))).toThrow(/catégorie Z/)
    expect(() => calculerLigne(ligne({ nature: 'debours' }))).toThrow(/catégorie O/)
  })
})

describe('TVA multi-taux', () => {
  it('ventile 20 %, 10 % et 5,5 % et totalise', () => {
    const t = calculerDocument({
      lignes: [
        ligne({ quantite: 3000, prixUnitaireHt: 45_000 }),
        ligne({ quantite: 2000, prixUnitaireHt: 3_412, taux: 550, nature: 'bien' }),
        ligne({ prixUnitaireHt: 21_000, taux: 1000 }),
      ],
    })
    expect(t.ventilation.map((v) => [v.taux, v.baseHt, v.tva])).toEqual([
      [2000, 135_000, 27_000],
      [550, 6_824, 375],
      [1000, 21_000, 2_100],
    ])
    expect(t).toMatchObject({ totalLignesHt: 162_824, totalHt: 162_824, totalTva: 29_475, totalTtc: 192_299, netAPayer: 192_299 })
  })

  it('calcule la TVA une fois par taux, pas ligne par ligne', () => {
    // Par ligne : 3 × arrondi(66,6) = 201 ; par taux : arrondi(199,8) = 200.
    const t = calculerDocument({ lignes: [ligne({ prixUnitaireHt: 333 }), ligne({ prixUnitaireHt: 333 }), ligne({ prixUnitaireHt: 333 })] })
    expect(t.totalTva).toBe(200)
    expect(t.ventilation).toHaveLength(1)
  })

  it('applique le taux particulier de 2,1 %', () => {
    // 1 234,56 × 2,1 % = 25,92576 → 25,93
    const t = calculerDocument({ lignes: [ligne({ prixUnitaireHt: 123_456, taux: 210 })] })
    expect(t.totalTva).toBe(2_593)
  })

  it('applique le taux normal des DOM (8,5 %)', () => {
    const t = calculerDocument({ lignes: [ligne({ prixUnitaireHt: 100_000, taux: 850 })] })
    expect(t.totalTva).toBe(8_500)
    expect(t.totalTtc).toBe(108_500)
  })

  it('regroupe des lignes de même taux dans l’ordre d’apparition', () => {
    const t = calculerDocument({
      lignes: [ligne({ taux: 550 }), ligne({ taux: 2000 }), ligne({ taux: 550 })],
    })
    expect(t.ventilation.map((v) => [v.taux, v.baseLignes])).toEqual([
      [550, 20_000],
      [2000, 10_000],
    ])
  })

  it('renvoie des totaux nuls pour un document vide', () => {
    const t = calculerDocument({ lignes: [] })
    expect(t).toMatchObject({ totalHt: 0, totalTva: 0, totalTtc: 0, ventilation: [], categorieOperation: null })
  })
})

describe('remise globale', () => {
  it('se répartit au prorata des bases de TVA', () => {
    const t = calculerDocument({
      lignes: [ligne({ prixUnitaireHt: 100_000 }), ligne({ prixUnitaireHt: 50_000, taux: 550 })],
      remiseGlobale: { type: 'pourcentage', valeur: 1000 },
    })
    expect(t.remiseGlobale).toBe(15_000)
    expect(t.ventilation.map((v) => [v.remiseGlobale, v.baseHt, v.tva])).toEqual([
      [10_000, 90_000, 18_000],
      [5_000, 45_000, 2_475],
    ])
    expect(t.totalHt).toBe(135_000)
    expect(t.totalTtc).toBe(155_475)
  })

  it('ne perd aucun centime quand la répartition ne tombe pas juste', () => {
    const t = calculerDocument({
      lignes: [ligne({ prixUnitaireHt: 100 }), ligne({ prixUnitaireHt: 200, taux: 1000 })],
      remiseGlobale: { type: 'montant', valeur: 100 },
    })
    expect(t.ventilation.map((v) => v.remiseGlobale)).toEqual([33, 67])
    expect(t.totalHt).toBe(200)
  })

  it('ne s’applique pas aux débours', () => {
    const t = calculerDocument({
      lignes: [
        ligne({ prixUnitaireHt: 100_000 }),
        ligne({ prixUnitaireHt: 5_000, categorie: 'O', taux: 0, nature: 'debours', motifExoneration: 'Débours' }),
      ],
      remiseGlobale: { type: 'pourcentage', valeur: 1000 },
    })
    const [taxe, debours] = t.ventilation
    expect(taxe).toMatchObject({ remiseGlobale: 10_000, baseHt: 90_000, tva: 18_000 })
    expect(debours).toMatchObject({ categorie: 'O', remiseGlobale: 0, baseHt: 5_000, tva: 0, motifExoneration: 'Débours' })
    expect(t.totalTtc).toBe(113_000)
  })

  it('refuse une remise supérieure au total', () => {
    expect(() =>
      calculerDocument({ lignes: [ligne()], remiseGlobale: { type: 'montant', valeur: 10_001 } }),
    ).toThrow(/dépasse/)
  })
})

describe('cas fiscaux', () => {
  it('franchise en base : aucune TVA et la mention de l’article 293 B', () => {
    const t = calculerDocument({
      lignes: [ligne({ categorie: 'E', taux: 0, prixUnitaireHt: 80_000, motifExoneration: 'TVA non applicable, art. 293 B du CGI' })],
    })
    expect(t.totalTva).toBe(0)
    expect(t.totalTtc).toBe(80_000)
    expect(t.ventilation[0]).toMatchObject({ categorie: 'E', taux: 0, motifExoneration: 'TVA non applicable, art. 293 B du CGI' })
  })

  it('livraison intracommunautaire : taux forcé à 0 même si un taux est saisi', () => {
    const t = calculerDocument({
      lignes: [ligne({ categorie: 'K', taux: 2000, nature: 'bien', motifExoneration: 'Exonération de TVA, art. 262 ter I du CGI' })],
    })
    expect(t.ventilation[0]).toMatchObject({ categorie: 'K', taux: 0, tva: 0 })
  })

  it('prestation de services à un client UE : autoliquidation', () => {
    const t = calculerDocument({ lignes: [ligne({ categorie: 'AE', taux: 0, motifExoneration: 'Autoliquidation' })] })
    expect(t.totalTva).toBe(0)
    expect(t.ventilation[0]!.categorie).toBe('AE')
  })

  it('export hors UE : exonération', () => {
    const t = calculerDocument({
      lignes: [ligne({ categorie: 'G', taux: 0, nature: 'bien', motifExoneration: 'Exonération de TVA, art. 262 I du CGI' })],
    })
    expect(t.totalTva).toBe(0)
  })

  it('sous-traitance BTP : autoliquidation', () => {
    const t = calculerDocument({
      lignes: [ligne({ categorie: 'AE', taux: 0, prixUnitaireHt: 1_250_000, motifExoneration: 'Autoliquidation, art. 283-2 nonies du CGI' })],
    })
    expect(t).toMatchObject({ totalHt: 1_250_000, totalTva: 0, totalTtc: 1_250_000 })
  })

  it('taux zéro et exonérations ne fusionnent pas', () => {
    const t = calculerDocument({
      lignes: [ligne({ categorie: 'Z', taux: 0 }), ligne({ categorie: 'E', taux: 0, motifExoneration: 'Art. 261-4-4° du CGI' })],
    })
    expect(t.ventilation.map((v) => v.categorie)).toEqual(['Z', 'E'])
  })

  it('facture mixte avec taux normal et exonération', () => {
    const t = calculerDocument({
      lignes: [ligne({ prixUnitaireHt: 50_000 }), ligne({ categorie: 'E', taux: 0, prixUnitaireHt: 20_000, motifExoneration: 'Formation, art. 261-4-4° a du CGI' })],
    })
    expect(t).toMatchObject({ totalHt: 70_000, totalTva: 10_000, totalTtc: 80_000 })
  })

  it('garde le premier motif d’exonération d’un groupe', () => {
    const t = calculerDocument({
      lignes: [ligne({ categorie: 'E', taux: 0 }), ligne({ categorie: 'E', taux: 0, motifExoneration: 'Motif A' }), ligne({ categorie: 'E', taux: 0, motifExoneration: 'Motif B' })],
    })
    expect(t.ventilation[0]!.motifExoneration).toBe('Motif A')
  })
})

describe('acomptes déduits (facture de solde)', () => {
  const lignesDevis = () => [ligne({ prixUnitaireHt: 100_000 }), ligne({ prixUnitaireHt: 20_000, taux: 550, nature: 'bien' })]

  it('déduit la base de chaque taux', () => {
    const t = calculerDocument({
      lignes: lignesDevis(),
      acomptes: [
        {
          numero: 'F-2026-0040',
          ventilation: [
            { categorie: 'S', taux: 2000, baseHt: 30_000 },
            { categorie: 'S', taux: 550, baseHt: 6_000 },
          ],
        },
      ],
    })
    expect(t.acomptesHt).toBe(36_000)
    expect(t.ventilation.map((v) => [v.acomptes, v.baseHt, v.tva])).toEqual([
      [30_000, 70_000, 14_000],
      [6_000, 14_000, 770],
    ])
    expect(t.totalLignesHt).toBe(120_000)
    expect(t.totalHt).toBe(84_000)
    expect(t.totalTtc).toBe(98_770)
  })

  it('accepte plusieurs acomptes, y compris sur un taux absent des lignes', () => {
    const t = calculerDocument({
      lignes: lignesDevis(),
      acomptes: [
        { numero: 'A1', ventilation: [{ categorie: 'S', taux: 2000, baseHt: 10_000 }] },
        { numero: 'A2', ventilation: [{ categorie: 'S', taux: 1000, baseHt: 0 }] },
      ],
    })
    expect(t.ventilation).toHaveLength(3)
    expect(t.totalHt).toBe(110_000)
  })

  it('refuse une base d’acompte négative ou décimale', () => {
    expect(() =>
      calculerDocument({ lignes: lignesDevis(), acomptes: [{ numero: 'A', ventilation: [{ categorie: 'S', taux: 2000, baseHt: -1 }] }] }),
    ).toThrow(/positive/)
    expect(() =>
      calculerDocument({ lignes: lignesDevis(), acomptes: [{ numero: 'A', ventilation: [{ categorie: 'S', taux: 2000, baseHt: 0.5 }] }] }),
    ).toThrow(ErreurMontant)
  })
})

describe('critère d’acceptation : 3 taux, remise ligne, remise globale, acompte', () => {
  it('produit des totaux cohérents et stables', () => {
    const t = calculerDocument({
      lignes: [
        ligne({ quantite: 3000, prixUnitaireHt: 45_000, remise: { type: 'pourcentage', valeur: 500 } }),
        ligne({ quantite: 12_500, prixUnitaireHt: 899, taux: 550, nature: 'bien' }),
        ligne({ quantite: 2000, prixUnitaireHt: 15_000, taux: 1000 }),
        ligne({ prixUnitaireHt: 3_500, categorie: 'O', taux: 0, nature: 'debours', motifExoneration: 'Débours' }),
      ],
      remiseGlobale: { type: 'montant', valeur: 7_777 },
      acomptes: [{ numero: 'F-2026-0031', ventilation: [{ categorie: 'S', taux: 2000, baseHt: 40_000 }] }],
    })
    // Lignes : 128 250 + 11 238 (12,5 × 8,99 = 112,375 → 112,38) + 30 000 + 3 500
    expect(t.lignes.map((l) => l.montantNet)).toEqual([128_250, 11_238, 30_000, 3_500])
    expect(t.totalLignesHt).toBe(172_988)
    // Remise globale répartie sur 128 250 / 11 238 / 30 000 (hors débours)
    expect(t.ventilation.map((v) => v.remiseGlobale)).toEqual([5_885, 516, 1_376, 0])
    expect(t.ventilation.map((v) => v.baseHt)).toEqual([82_365, 10_722, 28_624, 3_500])
    expect(t.ventilation.map((v) => v.tva)).toEqual([16_473, 590, 2_862, 0])
    expect(t.totalHt).toBe(t.totalLignesHt - t.remiseGlobale - t.acomptesHt)
    expect(t.totalHt).toBe(125_211)
    expect(t.totalTva).toBe(19_925)
    expect(t.totalTtc).toBe(145_136)
    expect(t.categorieOperation).toBe('mixte')
  })
})

describe('catégorie de l’opération', () => {
  it('se déduit des lignes', () => {
    expect(categorieOperation([{ nature: 'bien' }])).toBe('biens')
    expect(categorieOperation([{ nature: 'service' }, { nature: 'debours' }])).toBe('services')
    expect(categorieOperation([{ nature: 'bien' }, { nature: 'service' }])).toBe('mixte')
    expect(categorieOperation([{ nature: 'debours' }])).toBeNull()
  })
})

describe('invariants sur 500 documents générés', () => {
  it('HT = Σ bases, TTC = HT + TVA, remise et acomptes cohérents', () => {
    let graine = 42
    const alea = (max: number) => {
      graine = (graine * 1_103_515_245 + 12_345) % 2_147_483_648
      return graine % max
    }
    const taux = [2000, 1000, 550, 210, 850]
    for (let i = 0; i < 500; i++) {
      const lignes = Array.from({ length: 1 + alea(8) }, () =>
        ligne({
          quantite: 1 + alea(50_000),
          prixUnitaireHt: alea(500_000),
          taux: taux[alea(taux.length)]!,
          remise: alea(3) === 0 ? { type: 'pourcentage', valeur: alea(5_000) } : undefined,
        }),
      )
      const t = calculerDocument({ lignes, remiseGlobale: { type: 'pourcentage', valeur: alea(2_000) } })
      expect(t.totalHt).toBe(t.ventilation.reduce((s, v) => s + v.baseHt, 0))
      expect(t.totalTtc).toBe(t.totalHt + t.totalTva)
      expect(t.totalHt).toBe(t.totalLignesHt - t.remiseGlobale)
      for (const v of t.ventilation) expect(v.tva).toBe(Math.round((v.baseHt * v.taux) / 10_000 + 1e-9))
    }
  })
})
