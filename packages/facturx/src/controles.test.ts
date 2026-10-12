import { describe, expect, it } from 'vitest'
import { controler } from './controles'
import { ACHETEUR, avoir, factureAutoliquidation, factureMultiTaux, factureSolde } from './exemples'
import type { Facture } from './modele'

const regles = (f: Facture) => controler(f).map((a) => a.regle)

describe('contrôles EN 16931', () => {
  it('les exemples sont conformes', () => {
    for (const f of [factureMultiTaux(), factureAutoliquidation(), avoir(), factureSolde()]) expect(controler(f)).toEqual([])
  })

  it('champs obligatoires', () => {
    const f = factureMultiTaux()
    const vide: Facture = {
      ...f,
      numero: '',
      dateEmission: '12/10/2026',
      devise: 'euro',
      vendeur: { ...f.vendeur, nom: '', siren: null, adresse: { ...f.vendeur.adresse, pays: '' }, adresseElectronique: null },
      acheteur: { ...f.acheteur, nom: '', adresse: { ...f.acheteur.adresse, pays: '' }, adresseElectronique: null },
      lignes: [],
      remises: [],
      ventilation: [],
      totaux: { lignes: 0, remises: 0, ht: 0, tva: 0, ttc: 0, dejaPaye: 0, net: 0 },
    }
    expect(regles(vide)).toEqual(['BR-02', 'BR-03', 'BR-05', 'BR-06', 'BR-07', 'BR-09', 'BR-11', 'BR-16', 'BR-FR-13', 'BR-FR-12'])
    expect(regles({ ...avoir(), facturePrecedente: null })).toEqual(['BR-55'])
  })

  it('totaux incohérents', () => {
    const f = factureMultiTaux()
    expect(regles({ ...f, totaux: { lignes: 1, remises: 1, ht: 5, tva: 1, ttc: 1, dejaPaye: 0, net: 2 } })).toEqual([
      'BR-CO-10',
      'BR-CO-11',
      'BR-CO-13',
      'BR-CO-14',
      'BR-CO-15',
      'BR-CO-16',
    ])
    const g = f.ventilation[0]!
    expect(regles({ ...f, ventilation: [{ ...g, base: g.base + 1 }, f.ventilation[1]!] })).toEqual(['BR-S-08'])
  })

  it('catégories sans TVA', () => {
    const ae = factureAutoliquidation()
    const g = ae.ventilation[0]!
    expect(regles({ ...ae, ventilation: [{ ...g, montant: 1, motif: null, codeMotif: null }], totaux: { ...ae.totaux, tva: 1, ttc: 18001, net: 18001 } })).toEqual([
      'BR-AE-09',
      'BR-AE-10',
    ])
    expect(regles({ ...ae, vendeur: { ...ae.vendeur, tva: null } })).toEqual(['BR-AE-02'])

    const k: Facture = {
      ...ae,
      lignes: [{ ...ae.lignes[0]!, categorie: 'K' }],
      ventilation: [{ ...g, categorie: 'K', codeMotif: 'VATEX-EU-IC' }],
      acheteur: { ...ae.acheteur, tva: null },
      dateLivraison: null,
    }
    expect(regles(k)).toEqual(['BR-IC-02', 'BR-IC-11', 'BR-IC-12'])
    expect(regles({ ...k, acheteur: ae.acheteur, dateLivraison: '2026-10-01', paysLivraison: 'DE' })).toEqual([])

    const exp: Facture = { ...k, lignes: [{ ...k.lignes[0]!, categorie: 'G' }], ventilation: [{ ...g, categorie: 'G' }], vendeur: { ...ae.vendeur, tva: null } }
    expect(regles(exp)).toEqual(['BR-G-02'])
  })

  it('débours : jamais mêlés, sans numéro de TVA', () => {
    const f = factureSolde()
    const debours: Facture = {
      ...f,
      lignes: [...f.lignes, { ...f.lignes[0]!, id: '2', categorie: 'O', taux: 0, montantNet: 1000, prixUnitaire: 1000 }],
      ventilation: [...f.ventilation, { categorie: 'O', taux: 0, base: 1000, montant: 0, motif: 'Débours', codeMotif: 'VATEX-EU-O' }],
      totaux: { ...f.totaux, lignes: 101000, ht: 71000, ttc: 85000, net: 85000 },
    }
    expect(regles(debours)).toEqual(['BR-O-11', 'BR-O-02'])
  })

  it('réforme : SIREN de l’acheteur français', () => {
    expect(regles({ ...factureMultiTaux(), acheteur: { ...ACHETEUR, siren: null } })).toEqual(['BR-FR-11'])
  })
})
