import { calculerDocument } from '@pastille/moteur'
import { describe, expect, it } from 'vitest'
import { verifierConformite, type Acheteur, type Vendeur } from './conformite'
import { ligneVide, versLignesMoteur, type LigneEdition } from './document'

const vendeur: Vendeur = {
  name: 'Atelier Lumen',
  legal_form: 'SAS',
  share_capital_cents: 1_000_000,
  siren: '404833048',
  vat_number: 'FR83404833048',
  registration: 'RCS Nantes',
  address_line1: '1 rue Crébillon',
  postal_code: '44000',
  city: 'Nantes',
  vat_regime: 'reel_normal',
  vat_on_debits: false,
  late_penalty_terms: 'Taux BCE + 10 points',
  early_payment_discount: 'Pas d’escompte',
}

const client: Acheteur = {
  kind: 'b2b',
  name: 'Atelier Dupont',
  siren: '732829320',
  vat_number: 'FR44732829320',
  billing_line1: '14 rue de la Fosse',
  billing_postal_code: '44000',
  billing_city: 'Nantes',
  shipping_different: false,
  purchase_order_required: false,
  service_code: null,
  custom_mentions: null,
}

function verifier(lignes: LigneEdition[], v: Partial<Vendeur> = {}, a: Partial<Acheteur> | null = {}, extra: Record<string, unknown> = {}) {
  const totaux = calculerDocument({ lignes: versLignesMoteur(lignes) })
  return verifierConformite(
    { type: 'facture', lignes, purchaseOrder: '', issueDate: '2026-10-12', serviceDate: null, servicePeriodStart: null, originDocumentId: null, ...extra },
    { ...vendeur, ...v },
    a === null ? null : { ...client, ...a },
    totaux,
  )
}

const ok = [ligneVide({ designation: 'Création logo', prixUnitaireHt: 45_000 })]
const bloquants = (r: ReturnType<typeof verifier>) => r.controles.filter((x) => !x.ok && x.bloquant).map((x) => x.cle)

describe('contrôle de conformité', () => {
  it('accepte une facture B2B complète', () => {
    const r = verifier(ok)
    expect(bloquants(r)).toEqual([])
    expect(r.peutEmettre).toBe(true)
  })

  it('bloque une facture B2B France sans SIREN client', () => {
    const r = verifier(ok, {}, { siren: null })
    expect(bloquants(r)).toEqual(['client_siren'])
    expect(r.peutEmettre).toBe(false)
  })

  it('bloque sans client, sans ligne ou avec une désignation vide', () => {
    expect(bloquants(verifier(ok, {}, null))).toContain('client')
    expect(bloquants(verifier([]))).toEqual(['lignes'])
    expect(bloquants(verifier([ligneVide({ prixUnitaireHt: 100 })]))).toEqual(['designations'])
    expect(bloquants(verifier([ligneVide({ designation: 'X', prixUnitaireHt: 100, quantite: 0 })]))).toEqual(['quantites'])
  })

  it('exige les mentions du vendeur et le capital des sociétés', () => {
    const r = verifier(ok, { siren: null, address_line1: null, vat_number: null, share_capital_cents: null, registration: null, vat_regime: null })
    expect(bloquants(r).sort()).toEqual(['vendeur_adresse', 'vendeur_capital', 'vendeur_rcs', 'vendeur_regime', 'vendeur_siren', 'vendeur_tva'])
    expect(bloquants(verifier(ok, { legal_form: 'EI', share_capital_cents: null, registration: null }))).toEqual([])
  })

  it('franchise : interdit la TVA et ajoute la mention 293 B', () => {
    const r = verifier(ok, { vat_regime: 'franchise', vat_number: null })
    expect(bloquants(r)).toEqual(['franchise'])
    const exo = verifier([ligneVide({ designation: 'Cours', prixUnitaireHt: 3_000, categorie: 'E', taux: 0, motif: 'TVA non applicable, art. 293 B du CGI' })], { vat_regime: 'franchise', vat_number: null })
    expect(exo.peutEmettre).toBe(true)
    expect(exo.mentions.filter((m) => m.includes('293 B'))).toHaveLength(1)
  })

  it('client UE : numéro de TVA et motif obligatoires', () => {
    const sansMotif = [ligneVide({ designation: 'Conseil', prixUnitaireHt: 10_000, categorie: 'AE', taux: 0 })]
    expect(bloquants(verifier(sansMotif, {}, { kind: 'ue', siren: null, vat_number: null })).sort()).toEqual(['client_tva', 'motifs'])
  })

  it('bon de commande exigé par le client', () => {
    expect(bloquants(verifier(ok, {}, { purchase_order_required: true }))).toEqual(['bon_commande'])
    expect(bloquants(verifier(ok, {}, { purchase_order_required: true }, { purchaseOrder: 'BC-118' }))).toEqual([])
  })

  it('administration : avertissement Chorus Pro non bloquant', () => {
    const r = verifier(ok, {}, { kind: 'b2g', siren: null })
    expect(r.peutEmettre).toBe(true)
    expect(r.controles.find((x) => x.cle === 'chorus')).toMatchObject({ ok: false, bloquant: false })
  })

  it('avoir sans facture d’origine bloqué', () => {
    expect(bloquants(verifier(ok, {}, {}, { type: 'avoir' }))).toEqual(['origine'])
  })

  it('un devis n’exige pas les mentions de facture', () => {
    const r = verifier(ok, { siren: null }, { billing_line1: null }, { type: 'devis' })
    expect(r.peutEmettre).toBe(true)
    expect(r.mentions.some((m) => m.includes('Pénalités'))).toBe(false)
  })

  it('compose les mentions imprimées', () => {
    const r = verifier(
      [ligneVide({ designation: 'Logo', prixUnitaireHt: 100 }), ligneVide({ designation: 'Livres', prixUnitaireHt: 100, nature: 'bien' })],
      { vat_on_debits: true },
      { custom_mentions: 'Marché n° 2026-14' },
    )
    expect(r.mentions).toEqual([
      'Catégorie de l’opération : livraison de biens et prestation de services',
      'Option pour le paiement de la TVA d’après les débits',
      'Escompte : Pas d’escompte',
      'Pénalités de retard : Taux BCE + 10 points',
      expect.stringContaining('40 €'),
      'Marché n° 2026-14',
    ])
    const particulier = verifier(ok, {}, { kind: 'b2c', siren: null })
    expect(particulier.mentions.some((m) => m.includes('40 €'))).toBe(false)
    const acompte = verifier(ok, {}, {}, { type: 'acompte' })
    expect(acompte.mentions[0]).toBe('Facture d’acompte')
  })

  it('signale un calcul impossible', () => {
    const r = verifierConformite(
      { type: 'facture', lignes: ok, purchaseOrder: '', issueDate: '2026-10-12', serviceDate: null, servicePeriodStart: null, originDocumentId: null },
      vendeur,
      client,
      null,
    )
    expect(bloquants(r)).toEqual(['calcul'])
  })
})
