import { describe, expect, it } from 'vitest'
import {
  ajouterJours,
  aujourdHui,
  calculer,
  copierLignes,
  depuisLigneDb,
  echeance,
  ligneSignificative,
  ligneVide,
  validerEdition,
  versLignesDb,
  statutAffiche,
  versLignesMoteur,
  type DocumentEdition,
  type TypeDocument,
} from './document'

function doc(p: Partial<DocumentEdition> = {}): DocumentEdition {
  return {
    id: 'd1',
    type: 'facture',
    clientId: 'c1',
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
    earlyPaymentDiscount: '',
    remise: null,
    lignes: [],
    acomptes: [],
    originDocumentId: null,
    ...p,
  }
}

describe('document en édition', () => {
  it('ignore les lignes vides et calcule les totaux', () => {
    const d = doc({
      lignes: [
        ligneVide({ designation: 'Création logo', quantite: 3000, prixUnitaireHt: 45_000 }),
        ligneVide(),
        ligneVide({ designation: 'Livres', prixUnitaireHt: 2_000, taux: 550, nature: 'bien' }),
      ],
      remise: { type: 'pourcentage', valeur: 1000 },
    })
    expect(versLignesMoteur(d.lignes)).toHaveLength(2)
    const r = calculer(d)
    expect(r.ok && r.totaux.totalHt).toBe(123_300)
    expect(r.ok && r.totaux.categorieOperation).toBe('mixte')
  })

  it('force le taux à 0 hors catégorie S', () => {
    const [l] = versLignesMoteur([ligneVide({ designation: 'X', categorie: 'AE', taux: 2000, motif: 'Autoliquidation' })])
    expect(l).toMatchObject({ taux: 0, motifExoneration: 'Autoliquidation' })
  })

  it('rend une erreur lisible plutôt que de planter', () => {
    const r = calculer(doc({ lignes: [ligneVide({ designation: 'X', prixUnitaireHt: 100, remise: { type: 'montant', valeur: 500 } })] }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erreur).toMatch(/dépasse/)
  })

  it('propage les erreurs inattendues', () => {
    expect(() => calculer({ lignes: null as never, remise: null, acomptes: [] })).toThrow(TypeError)
  })

  it('calcule l’échéance sauf pour un devis', () => {
    expect(echeance(doc())).toBe('2026-11-11')
    expect(echeance(doc({ type: 'devis' }))).toBeNull()
  })

  it('aller-retour avec la base', () => {
    const lignes = [ligneVide({ designation: ' Conseil ', quantite: 1500, prixUnitaireHt: 8_000, remise: { type: 'montant', valeur: 1_000 } }), ligneVide({ designation: 'Formation', categorie: 'E', taux: 2000, motif: 'Art. 261-4-4°' })]
    const r = calculer({ lignes, remise: null, acomptes: [] })
    const db = versLignesDb(lignes, r.ok ? r.totaux : null)
    expect(db[0]).toMatchObject({ position: 1, designation: 'Conseil', line_net_cents: 11_000, discount_kind: 'montant', exemption_reason: null })
    expect(db[1]).toMatchObject({ vat_rate: 0, exemption_reason: 'Art. 261-4-4°', line_net_cents: 0 })
    const retour = depuisLigneDb({ ...db[0]!, id: 'x' })
    expect(retour).toMatchObject({ cle: 'x', quantite: 1500, remise: { type: 'montant', valeur: 1_000 } })
    expect(depuisLigneDb({ ...db[1]! }).remise).toBeNull()
    expect(versLignesDb(lignes, null)[0]!.line_net_cents).toBe(0)
  })

  it('copie des lignes avec de nouvelles clés', () => {
    const l = ligneVide({ designation: 'A' })
    const [copie] = copierLignes([l, ligneVide()])
    expect(copie!.designation).toBe('A')
    expect(copie!.cle).not.toBe(l.cle)
    expect(ligneSignificative(ligneVide({ prixUnitaireHt: 1 }))).toBe(true)
  })

  it('valide l’état reçu', () => {
    expect(validerEdition(doc())).toBeNull()
    expect(validerEdition(doc({ issueDate: '12/10/2026' }))).toMatch(/émission/)
    expect(validerEdition(doc({ serviceDate: 'hier' }))).toMatch(/date/)
    expect(validerEdition(doc({ servicePeriodStart: '2026-10-10', servicePeriodEnd: '2026-10-01' }))).toMatch(/période/)
    expect(validerEdition(doc({ lignes: [ligneVide({ quantite: 1.5 })] }))).toMatch(/invalide/)
    expect(validerEdition(doc({ lignes: [ligneVide({ designation: 'x'.repeat(301) })] }))).toMatch(/300/)
    expect(validerEdition(doc({ lignes: Array.from({ length: 501 }, () => ligneVide()) }))).toMatch(/500/)
    expect(validerEdition(doc({ currency: 'euro' }))).toMatch(/Devise/)
  })

  it('manipule les dates', () => {
    expect(ajouterJours('2026-12-25', 10)).toBe('2027-01-04')
    expect(aujourdHui(new Date('2026-10-12T23:30:00Z'))).toBe('2026-10-13')
  })
})

describe('statut affiché', () => {
  const jour = '2026-10-12'
  const f = (status: Parameters<typeof statutAffiche>[0]['status'], due_date: string | null = null, type: TypeDocument = 'facture') =>
    statutAffiche({ type, status, due_date, valid_until: due_date }, jour)

  it('factures', () => {
    expect(f('brouillon').libelle).toBe('Brouillon')
    expect(f('emis', '2026-10-30').libelle).toBe('Émise')
    expect(f('envoye', '2026-10-30').libelle).toBe('Envoyée')
    expect(f('envoye', '2026-10-01')).toEqual({ cle: 'retard', libelle: 'En retard' })
    expect(f('partiellement_paye', '2026-10-30').libelle).toBe('Paiement partiel')
    expect(f('partiellement_paye', '2026-10-01').libelle).toBe('En retard')
    expect(f('paye', '2026-10-01').cle).toBe('payee')
    expect(f('annule').libelle).toBe('Annulée')
  })

  it('avoirs et devis', () => {
    expect(f('emis', null, 'avoir').libelle).toBe('Avoir')
    expect(f('paye', null, 'avoir').libelle).toBe('Remboursé')
    expect(f('brouillon', null, 'avoir').libelle).toBe('Brouillon')
    expect(f('brouillon', null, 'devis').libelle).toBe('Brouillon')
    expect(f('envoye', '2026-10-30', 'devis').libelle).toBe('Envoyé')
    expect(f('envoye', '2026-10-01', 'devis').libelle).toBe('Expiré')
    expect(f('accepte', null, 'devis').cle).toBe('acceptee')
    expect(f('refuse', null, 'devis').libelle).toBe('Refusé')
    expect(f('expire', null, 'devis').libelle).toBe('Expiré')
    expect(f('transforme', null, 'devis').libelle).toBe('Facturé')
    expect(f('emis', null, 'devis').libelle).toBe('emis')
  })
})
