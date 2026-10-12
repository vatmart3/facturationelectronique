import { describe, expect, it } from 'vitest'
import type { DocumentEdition } from './document'
import { ligneVide } from './document'
import {
  appliquerClient,
  appliquerSaisieRapide,
  changerTva,
  ligneDepuisProduit,
  ligneLibre,
  motifParDefaut,
  optionsTva,
  reappliquerLigne,
  suggererProduits,
  valeurTva,
  type ClientEditeur,
  type ContexteEditeur,
  type ProduitEditeur,
} from './editeur'
import { MENTIONS } from './fiscalite'

const logo: ProduitEditeur = {
  id: 'p1',
  name: 'Création de logo',
  description: 'Trois pistes',
  unit: 'forfait',
  unit_price_cents: 45000,
  vat_category: 'S',
  vat_rate: 2000,
  nature: 'service',
  favorite: false,
}
const papier: ProduitEditeur = { ...logo, id: 'p2', name: 'Papier', nature: 'bien', unit_price_cents: 1000, favorite: true, description: null }

function client(p: Partial<ClientEditeur> = {}): ClientEditeur {
  return {
    id: 'c1',
    kind: 'b2b',
    name: 'Atelier',
    legal_form: null,
    siren: '732829320',
    vat_number: null,
    billing_line1: '1 rue',
    billing_line2: null,
    billing_postal_code: '75001',
    billing_city: 'Paris',
    billing_country: 'FR',
    shipping_different: false,
    service_code: null,
    default_vat_category: null,
    default_vat_rate: null,
    exemption_reason: null,
    default_discount_kind: null,
    default_discount_value: null,
    payment_terms: null,
    early_payment_discount: null,
    currency: 'EUR',
    language: 'fr',
    purchase_order_required: false,
    custom_mentions: null,
    ...p,
  }
}

const ctx: ContexteEditeur = {
  regime: 'reel_normal',
  conditionsDefaut: '30j',
  escompteDefaut: 'Aucun',
  produits: new Map([
    [logo.id, logo],
    [papier.id, papier],
  ]),
  prixClients: new Map([['c1:p1', 40000]]),
}

function doc(p: Partial<DocumentEdition> = {}): DocumentEdition {
  return {
    id: '',
    type: 'facture',
    clientId: null,
    issueDate: '2026-10-12',
    serviceDate: null,
    servicePeriodStart: null,
    servicePeriodEnd: null,
    validUntil: null,
    purchaseOrder: '',
    subject: '',
    publicNotes: '',
    internalNotes: '',
    currency: 'EUR',
    language: 'fr',
    paymentTerms: '30j',
    earlyPaymentDiscount: 'Aucun',
    remise: null,
    lignes: [],
    acomptes: [],
    originDocumentId: null,
    ...p,
  }
}

describe('TVA d’une ligne', () => {
  it('valeur et options du sélecteur', () => {
    expect(valeurTva({ categorie: 'S', taux: 550 })).toBe('S:550')
    expect(valeurTva({ categorie: 'AE', taux: 2000 })).toBe('AE:0')
    expect(optionsTva({ categorie: 'S', taux: 2000 }).length).toBe(11)
    expect(optionsTva({ categorie: 'S', taux: 1300 }).at(-1)).toEqual({ valeur: 'S:1300', libelle: '13 %' })
  })

  it('motifs par défaut', () => {
    expect(motifParDefaut('S', 'service', 'reel_normal')).toBeNull()
    expect(motifParDefaut('Z', 'service', 'reel_normal')).toBeNull()
    expect(motifParDefaut('E', 'service', 'franchise')).toBe(MENTIONS.franchise)
    expect(motifParDefaut('E', 'service', 'reel_normal')).toBe('')
    expect(motifParDefaut('AE', 'service', null)).toBe(MENTIONS.autoliquidationUe)
    expect(motifParDefaut('K', 'bien', null)).toBe(MENTIONS.livraisonIntracom)
    expect(motifParDefaut('G', 'bien', null)).toBe(MENTIONS.export)
    expect(motifParDefaut('O', 'debours', null)).toBe(MENTIONS.debours)
    expect(motifParDefaut('O', 'service', 'non_assujetti')).toBe(MENTIONS.nonAssujetti)
    expect(motifParDefaut('O', 'service', 'reel_normal')).toBe(MENTIONS.servicesHorsUe)
  })

  it('changer de taux garde le motif saisi si la catégorie ne change pas', () => {
    const l = { ...ligneVide(), categorie: 'AE' as const, taux: 0, motif: 'Mon motif' }
    expect(changerTva(l, 'AE:0', 'reel_normal').motif).toBe('Mon motif')
    expect(changerTva(l, 'S:1000', 'reel_normal')).toMatchObject({ categorie: 'S', taux: 1000, motif: null })
    expect(changerTva(ligneVide(), 'K:0', 'reel_normal')).toMatchObject({ categorie: 'K', taux: 0, motif: MENTIONS.livraisonIntracom })
  })
})

describe('lignes', () => {
  it('article du catalogue au prix du client', () => {
    const l = ligneDepuisProduit(logo, client(), ctx)
    expect(l).toMatchObject({ productId: 'p1', designation: 'Création de logo', prixUnitaireHt: 40000, unite: 'forfait', categorie: 'S', taux: 2000 })
    expect(ligneDepuisProduit(logo, null, ctx).prixUnitaireHt).toBe(45000)
    expect(ligneDepuisProduit(papier, null, ctx).description).toBe('')
  })

  it('client UE : autoliquidation pour un service, livraison intracom pour un bien', () => {
    const ue = client({ kind: 'ue', id: 'c2' })
    expect(ligneDepuisProduit(logo, ue, ctx)).toMatchObject({ categorie: 'AE', motif: MENTIONS.autoliquidationUe })
    expect(ligneDepuisProduit(papier, ue, ctx)).toMatchObject({ categorie: 'K', motif: MENTIONS.livraisonIntracom })
  })

  it('ligne libre en franchise', () => {
    expect(ligneLibre(null, 'franchise')).toMatchObject({ categorie: 'E', taux: 0, motif: MENTIONS.franchise })
    expect(ligneLibre(client(), 'reel_normal', { designation: 'x' })).toMatchObject({ categorie: 'S', taux: 2000, motif: null, designation: 'x' })
  })

  it('réapplication après changement de client', () => {
    const avant = { ...ligneDepuisProduit(logo, null, ctx), designation: 'Logo retouché', quantite: 2000 }
    const apres = reappliquerLigne(avant, client(), ctx)
    expect(apres).toMatchObject({ designation: 'Logo retouché', quantite: 2000, prixUnitaireHt: 40000, cle: avant.cle })
    const libre = { ...ligneVide({ designation: 'Conseil', prixUnitaireHt: 100 }), taux: 1000 }
    expect(reappliquerLigne(libre, client({ kind: 'hors_ue' }), ctx)).toMatchObject({ categorie: 'O', motif: MENTIONS.servicesHorsUe })
    const ae = reappliquerLigne(libre, client({ kind: 'ue' }), ctx)
    expect(reappliquerLigne(ae, client(), ctx)).toMatchObject({ categorie: 'S', taux: 2000 })
    expect(reappliquerLigne({ ...libre, productId: 'supprime' }, null, ctx)).toMatchObject({ categorie: 'S', taux: 1000 })
  })
})

describe('choix du client', () => {
  it('applique conditions, remise, devise et langue', () => {
    const c = client({
      payment_terms: '45jfm',
      early_payment_discount: '2 % à 10 jours',
      default_discount_kind: 'pourcentage',
      default_discount_value: 500,
      currency: 'USD',
      language: 'en',
    })
    const d = appliquerClient(doc({ lignes: [ligneDepuisProduit(logo, null, ctx)] }), c, ctx)
    expect(d).toMatchObject({
      clientId: 'c1',
      paymentTerms: '45jfm',
      earlyPaymentDiscount: '2 % à 10 jours',
      remise: { type: 'pourcentage', valeur: 500 },
      currency: 'USD',
      language: 'en',
    })
    expect(d.lignes[0]!.prixUnitaireHt).toBe(40000)
  })

  it('sans client : valeurs de l’entreprise', () => {
    const d = appliquerClient(doc({ paymentTerms: '60j', remise: { type: 'montant', valeur: 100 } }), null, ctx)
    expect(d).toMatchObject({ clientId: null, paymentTerms: '30j', earlyPaymentDiscount: 'Aucun', remise: null, currency: 'EUR' })
  })
})

describe('saisie rapide', () => {
  it('décompose quantité, désignation et prix', () => {
    const l = appliquerSaisieRapide(ligneVide({ designation: '3 x Création logo 450' }))
    expect(l).toMatchObject({ quantite: 3000, designation: 'Création logo', prixUnitaireHt: 45000 })
    expect(appliquerSaisieRapide(ligneVide({ designation: '2,5 x Conseil' }))).toMatchObject({ quantite: 2500, prixUnitaireHt: 0 })
  })

  it('ne touche ni aux articles, ni aux lignes déjà chiffrées, ni au texte simple', () => {
    const simple = ligneVide({ designation: 'Développement' })
    expect(appliquerSaisieRapide(simple)).toBe(simple)
    const chiffree = ligneVide({ designation: '3 x Logo 450', prixUnitaireHt: 100 })
    expect(appliquerSaisieRapide(chiffree)).toBe(chiffree)
    const article = ligneVide({ designation: '3 x Logo 450', productId: 'p1' })
    expect(appliquerSaisieRapide(article)).toBe(article)
    const vide = ligneVide({ designation: '  ' })
    expect(appliquerSaisieRapide(vide)).toBe(vide)
  })
})

describe('suggestions', () => {
  it('favoris d’abord, puis début de mot, sans accents', () => {
    const produits = [logo, papier, { ...logo, id: 'p3', name: 'Logo animé' }]
    expect(suggererProduits(produits, '')).toEqual([])
    expect(suggererProduits(produits, 'LOGO').map((p) => p.id)).toEqual(['p3', 'p1'])
    expect(suggererProduits(produits, 'creation').map((p) => p.id)).toEqual(['p1'])
    expect(suggererProduits(produits, 'a').map((p) => p.id)).toEqual(['p2', 'p1', 'p3'])
    expect(suggererProduits(produits, 'a', 1)).toHaveLength(1)
  })
})
