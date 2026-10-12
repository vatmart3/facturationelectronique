import { writeFileSync } from 'node:fs'
import { controler, genererCii, genererUbl } from '@pastille/facturx'
import { disponibles, validerSchematron, validerXsd } from '@pastille/facturx/validateurs'
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { ligneVide, type DocumentEdition } from './document'
import { avoirDepuis } from './derives'
import { adresseElectroniqueClient, versEn16931 } from './en16931'
import { construireImprimable, type ClientImprime, type VendeurImprime } from './imprimable'
import { charge, genererPdf } from './pdf'

const vendeur: VendeurImprime = {
  name: 'Atelier Lumen',
  legal_form: 'SAS',
  share_capital_cents: 1_000_000,
  siren: '732829320',
  siret: '73282932000074',
  vat_number: 'FR44732829320',
  registration: 'RCS Paris',
  naf_code: '7410Z',
  address_line1: '12 rue des Lilas',
  address_line2: null,
  postal_code: '75011',
  city: 'Paris',
  country_code: 'FR',
  vat_regime: 'reel_normal',
  vat_on_debits: false,
  iban: 'FR7630006000011234567890189',
  bic: 'AGRIFRPP',
  late_penalty_terms: 'Taux BCE majoré de 10 points',
  early_payment_discount: 'Pas d’escompte pour paiement anticipé',
  accent_color: '#1f3a6d',
  invoice_template: 'galet',
  invoice_font: 'grotesque',
  logo_path: null,
  footer_text: null,
  terms_text: null,
}

function client(p: Partial<ClientImprime> = {}): ClientImprime {
  return {
    kind: 'b2b',
    name: 'Atelier Dupont',
    legal_form: null,
    siren: '404833048',
    siret: null,
    vat_number: 'FR83404833048',
    einvoice_address: null,
    service_code: null,
    billing_line1: '3 place du Marché',
    billing_line2: null,
    billing_postal_code: '69002',
    billing_city: 'Lyon',
    billing_country: 'FR',
    shipping_different: false,
    shipping_line1: null,
    shipping_line2: null,
    shipping_postal_code: null,
    shipping_city: null,
    shipping_country: null,
    purchase_order_required: false,
    custom_mentions: null,
    ...p,
  }
}

function edition(p: Partial<DocumentEdition> = {}): DocumentEdition {
  return {
    id: 'd1',
    type: 'facture',
    clientId: 'c1',
    issueDate: '2026-10-12',
    serviceDate: '2026-10-10',
    servicePeriodStart: null,
    servicePeriodEnd: null,
    validUntil: null,
    purchaseOrder: 'BC-77',
    subject: 'Identité visuelle',
    publicNotes: 'Merci pour votre confiance.',
    internalNotes: 'jamais exporté',
    currency: 'EUR',
    language: 'fr',
    paymentTerms: '30j',
    earlyPaymentDiscount: '',
    remise: { type: 'montant', valeur: 5000 },
    lignes: [
      ligneVide({ designation: 'Création logo', description: 'Trois pistes', quantite: 2000, prixUnitaireHt: 42000, remise: { type: 'pourcentage', valeur: 1000 } }),
      ligneVide({ designation: 'Livre', prixUnitaireHt: 10000, taux: 550, nature: 'bien', unite: 'pièce' }),
    ],
    acomptes: [],
    originDocumentId: null,
    ...p,
  }
}

function imprimable(e: DocumentEdition, c = client(), numero = 'F-2026-0042', origine: { numero: string; date: string } | null = null) {
  const d = construireImprimable({ edition: e, numero, brouillon: false, dateEcheance: null, vendeur, client: c, textes: {}, origine, empreinte: 'ab'.repeat(32) })
  if (!d) throw new Error('calcul')
  return d
}

describe('correspondance EN 16931', () => {
  it('facture multi-taux avec remises : totaux et contrôles', () => {
    const f = versEn16931(imprimable(edition()))!
    expect(f).toMatchObject({ type: '380', cadre: 'M1', commande: 'BC-77', paiement: { moyen: '58', reference: 'F-2026-0042' } })
    expect(f.lignes[0]).toMatchObject({ quantite: 2000, prixUnitaire: 42000, remise: { montant: 8400 }, montantNet: 75600 })
    expect(f.remises.map((r) => r.montant).reduce((a, b) => a + b)).toBe(5000)
    expect(f.notes.map((n) => n.sujet).filter(Boolean)).toEqual(['AAB', 'PMD', 'PMT'])
    expect(JSON.stringify(f)).not.toContain('jamais exporté')
    expect(controler(f)).toEqual([])
  })

  it('avoir : type 381, montants positifs, facture d’origine', () => {
    const a = avoirDepuis(edition(), 'f1', '2026-10-13')
    const f = versEn16931(imprimable(a, client(), 'A-2026-0001', { numero: 'F-2026-0042', date: '2026-10-12' }))!
    expect(f.type).toBe('381')
    expect(f.totaux.ttc).toBeGreaterThan(0)
    expect(f.lignes.every((l) => l.quantite > 0 && l.montantNet > 0)).toBe(true)
    expect(f.facturePrecedente).toEqual({ numero: 'F-2026-0042', date: '2026-10-12' })
    expect(controler(f)).toEqual([])
  })

  it('client UE en autoliquidation ; devis et brouillons exclus', () => {
    const ue = client({ kind: 'ue', siren: null, vat_number: 'DE123456789', billing_country: 'DE', einvoice_address: 'rechnung@mueller.de' })
    const e = edition({ remise: null, lignes: [ligneVide({ designation: 'Conseil', prixUnitaireHt: 100000, categorie: 'AE', taux: 0, motif: 'Autoliquidation' })] })
    const f = versEn16931(imprimable(e, ue))!
    expect(f.ventilation[0]).toMatchObject({ categorie: 'AE', codeMotif: 'VATEX-EU-AE', motif: 'Autoliquidation' })
    expect(f.acheteur.adresseElectronique).toEqual({ valeur: 'rechnung@mueller.de', schema: 'EM' })
    expect(controler(f)).toEqual([])
    expect(versEn16931(imprimable(edition({ type: 'devis' })))).toBeNull()
    expect(versEn16931({ ...imprimable(edition()), numero: null })).toBeNull()
  })

  it('adresse électronique de l’acheteur', () => {
    expect(adresseElectroniqueClient({ einvoice_address: '0009:40483304800012', siren: null })).toEqual({ valeur: '40483304800012', schema: '0009' })
    expect(adresseElectroniqueClient({ einvoice_address: '404833048_FACT', siren: null })).toEqual({ valeur: '404833048_FACT', schema: '0225' })
    expect(adresseElectroniqueClient({ einvoice_address: null, siren: '404833048' })).toEqual({ valeur: '404833048', schema: '0225' })
    expect(adresseElectroniqueClient({ einvoice_address: null, siren: null })).toBeNull()
  })
})

describe.skipIf(!disponibles)('validation officielle des documents de l’application', () => {
  const cas = {
    facture: () => versEn16931(imprimable(edition()))!,
    avoir: () => versEn16931(imprimable(avoirDepuis(edition(), 'f1', '2026-10-13'), client(), 'A-2026-0001', { numero: 'F-2026-0042', date: '2026-10-12' }))!,
    solde: () =>
      versEn16931(imprimable(edition({ remise: null, acomptes: [{ numero: 'F-2026-0040', ventilation: [{ categorie: 'S', taux: 2000, baseHt: 20000 }] }] })))!,
  }
  for (const [nom, f] of Object.entries(cas)) {
    it(`${nom} : CII et UBL conformes (XSD, EN 16931, BR-FR)`, () => {
      const facture = f()
      const cii = genererCii(facture)
      const ubl = genererUbl(facture)
      expect(validerXsd(cii, 'cii')).toEqual([])
      expect(validerXsd(ubl, facture.type === '381' ? 'ubl-creditnote' : 'ubl-invoice')).toEqual([])
      for (const [xml, regles] of [
        [cii, 'cii-en16931'],
        [cii, 'cii-br-fr'],
        [ubl, 'ubl-en16931'],
        [ubl, 'ubl-br-fr'],
      ] as const) {
        expect(validerSchematron(xml, regles).filter((e) => e.gravite === 'fatal'), regles).toEqual([])
      }
    })
  }
})

describe('PDF', () => {
  it('facture émise : PDF/A-3 Factur-X avec XML joint', async () => {
    const r = await genererPdf(imprimable(edition()))
    expect(r.facturx).toBe(true)
    const texte = Buffer.from(r.octets).toString('latin1')
    expect(texte.startsWith('%PDF-')).toBe(true)
    expect(texte).toContain('/AFRelationship /Data')
    expect(texte).toContain('factur-x.xml')
    expect(texte).toContain('<pdfaid:part>3</pdfaid:part>')
    expect(texte).toContain('/GTS_PDFA1')
    const relu = await PDFDocument.load(r.octets)
    expect(relu.getPageCount()).toBe(1)
    expect(relu.getTitle()).toBe('Facture F-2026-0042')
    if (process.env.CAPTURES) writeFileSync(`${process.env.CAPTURES}/facture.pdf`, r.octets)
  })

  it('devis et modèles : PDF simple, pagination au-delà d’une page', async () => {
    const lignes = Array.from({ length: 40 }, (_, i) => ligneVide({ designation: `Prestation ${i + 1}`, description: 'Détail sur deux lignes\nseconde ligne', prixUnitaireHt: 1000 }))
    for (const modele of ['galet', 'papeterie', 'classique'] as const) {
      const d = { ...imprimable(edition({ type: 'devis', lignes })), modele, numero: 'D-2026-0001' }
      const r = await genererPdf(d)
      expect(r.facturx).toBe(false)
      expect((await PDFDocument.load(r.octets)).getPageCount()).toBeGreaterThan(1)
      if (process.env.CAPTURES) writeFileSync(`${process.env.CAPTURES}/devis-${modele}.pdf`, r.octets)
    }
  })

  it('débours mêlés : PDF sans Factur-X, anomalie signalée', async () => {
    const e = edition({ lignes: [...edition().lignes, ligneVide({ designation: 'Frais de greffe', prixUnitaireHt: 3000, categorie: 'O', taux: 0, nature: 'debours', motif: 'Débours' })] })
    const r = await genererPdf({ ...imprimable(e), police: 'serif' })
    expect(r.facturx).toBe(false)
    expect(r.anomalies.map((a) => a.regle)).toContain('BR-O-11')
  })

  it('QR code de virement SEPA', () => {
    expect(charge(imprimable(edition()))).toBe(
      ['BCD', '002', '1', 'SCT', 'AGRIFRPP', 'Atelier Lumen', 'FR7630006000011234567890189', 'EUR953.55', '', '', 'F-2026-0042'].join('\n'),
    )
    expect(charge({ ...imprimable(edition()), devise: 'USD' })).toBeNull()
    expect(charge({ ...imprimable(edition()), brouillon: true })).toBeNull()
  })
})
