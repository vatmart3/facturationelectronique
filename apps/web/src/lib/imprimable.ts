/**
 * Modèle d'un document prêt à imprimer : une seule source pour l'aperçu HTML,
 * le PDF et le XML (Factur-X, UBL, CII). Les montants restent en centimes.
 * Construit soit depuis les instantanés d'un document émis, soit depuis un brouillon.
 */

import type { CategorieTva, Totaux, Ventilation } from '@pastille/moteur'
import { libelleConditions, type ConditionsPaiement } from './clients'
import { verifierConformite, type Acheteur, type Textes, type Vendeur } from './conformite'
import { calculer, echeance, type DocumentEdition, type LigneEdition, type TypeDocument } from './document'
import type { TypeClient } from './fiscalite'

export type Modele = 'galet' | 'papeterie' | 'classique'

export interface VendeurImprime extends Vendeur {
  siret: string | null
  naf_code: string | null
  address_line2: string | null
  country_code: string
  iban: string | null
  bic: string | null
  accent_color: string
  invoice_template: Modele
  invoice_font: 'grotesque' | 'serif'
  logo_path: string | null
  footer_text: string | null
  terms_text: string | null
}

export interface ClientImprime extends Acheteur {
  legal_form: string | null
  siret: string | null
  einvoice_address: string | null
  billing_line2: string | null
  billing_country: string
  shipping_line1: string | null
  shipping_line2: string | null
  shipping_postal_code: string | null
  shipping_city: string | null
  shipping_country: string | null
}

export interface LigneImprimee {
  designation: string
  description: string
  quantite: number
  unite: string
  prixUnitaireHt: number
  remise: LigneEdition['remise']
  categorie: CategorieTva
  taux: number
  motif: string | null
  nature: LigneEdition['nature']
  montantBrut: number
  montantRemise: number
  montantNet: number
}

export interface DocumentImprimable {
  type: TypeDocument
  titre: string
  numero: string | null
  brouillon: boolean
  langue: 'fr' | 'en'
  devise: string
  dateEmission: string
  dateEcheance: string | null
  dateValidite: string | null
  datePrestation: string | null
  periode: { debut: string; fin: string } | null
  bonCommande: string | null
  objet: string | null
  notes: string | null
  conditions: string | null
  conditionsCode: ConditionsPaiement | null
  vendeur: VendeurImprime
  client: ClientImprime | null
  clientType: TypeClient | null
  lignes: LigneImprimee[]
  totaux: Totaux
  ventilation: Ventilation[]
  mentions: string[]
  origine: { numero: string; date: string } | null
  acomptes: Array<{ numero: string; montantHt: number }>
  modele: Modele
  couleur: string
  police: 'grotesque' | 'serif'
  empreinte: string | null
  paye: boolean
}

export const TITRES: Record<TypeDocument, { fr: string; en: string }> = {
  facture: { fr: 'Facture', en: 'Invoice' },
  acompte: { fr: 'Facture d’acompte', en: 'Deposit invoice' },
  avoir: { fr: 'Avoir', en: 'Credit note' },
  devis: { fr: 'Devis', en: 'Quote' },
}

interface Entree {
  edition: DocumentEdition
  numero: string | null
  brouillon: boolean
  dateEcheance: string | null
  vendeur: VendeurImprime
  client: ClientImprime | null
  textes: Textes
  origine?: { numero: string; date: string } | null
  empreinte?: string | null
  paye?: boolean
}

export function construireImprimable(e: Entree): DocumentImprimable | null {
  const calcul = calculer(e.edition)
  if (!calcul.ok) return null
  const d = e.edition
  const { totaux } = calcul
  const calculees = new Map(totaux.lignes.map((l) => [l.id, l]))
  const conformite = verifierConformite(d, e.vendeur, e.client, totaux, e.textes)
  const mentions = [...conformite.mentions]
  if (d.type === 'avoir' && e.origine) {
    mentions.unshift(`${e.textes.avoir ?? 'Avoir se rapportant à la facture'} n° ${e.origine.numero} du ${dateCourte(e.origine.date)}`)
  }
  const lignes = d.lignes
    .filter((l) => l.designation.trim() !== '' || l.prixUnitaireHt !== 0)
    .map((l) => ({
      designation: l.designation,
      description: l.description,
      quantite: l.quantite,
      unite: l.unite,
      prixUnitaireHt: l.prixUnitaireHt,
      remise: l.remise,
      categorie: l.categorie,
      taux: l.categorie === 'S' ? l.taux : 0,
      motif: l.motif,
      nature: l.nature,
      montantBrut: calculees.get(l.cle)?.montantBrut ?? 0,
      montantRemise: calculees.get(l.cle)?.montantRemise ?? 0,
      montantNet: calculees.get(l.cle)?.montantNet ?? 0,
    }))
  const dateEch = e.dateEcheance ?? echeance(d)
  return {
    type: d.type,
    titre: TITRES[d.type][d.language],
    numero: e.numero,
    brouillon: e.brouillon,
    langue: d.language,
    devise: d.currency,
    dateEmission: d.issueDate,
    dateEcheance: d.type === 'devis' ? null : dateEch,
    dateValidite: d.type === 'devis' ? d.validUntil : null,
    datePrestation: d.serviceDate,
    periode: d.servicePeriodStart && d.servicePeriodEnd ? { debut: d.servicePeriodStart, fin: d.servicePeriodEnd } : null,
    bonCommande: d.purchaseOrder.trim() || null,
    objet: d.subject.trim() || null,
    notes: d.publicNotes.trim() || null,
    conditions:
      d.type === 'devis' || d.type === 'avoir'
        ? null
        : `${libelleConditions(d.paymentTerms)}${dateEch ? `, au plus tard le ${dateCourte(dateEch)}` : ''}`,
    conditionsCode: d.type === 'devis' ? null : d.paymentTerms,
    vendeur: e.vendeur,
    client: e.client,
    clientType: e.client?.kind ?? null,
    lignes,
    totaux,
    ventilation: totaux.ventilation,
    mentions,
    origine: e.origine ?? null,
    acomptes: d.acomptes.map((a) => ({ numero: a.numero, montantHt: a.ventilation.reduce((s, v) => s + v.baseHt, 0) })),
    modele: e.vendeur.invoice_template,
    couleur: e.vendeur.accent_color,
    police: e.vendeur.invoice_font,
    empreinte: e.empreinte ?? null,
    paye: e.paye ?? false,
  }
}

export function dateCourte(iso: string): string {
  const [a, m, j] = iso.slice(0, 10).split('-')
  return `${j}/${m}/${a}`
}

/** Quantité en millièmes → « 2 », « 1,5 », « -3 ». */
export function quantiteTexte(milli: number): string {
  const signe = milli < 0 ? '-' : ''
  const abs = Math.abs(milli)
  const dec = String(abs % 1000).padStart(3, '0').replace(/0+$/, '')
  return `${signe}${Math.trunc(abs / 1000)}${dec ? `,${dec}` : ''}`
}

/** Adresse sur plusieurs lignes, pays affiché hors France. */
export function adresseVendeur(v: Pick<VendeurImprime, 'address_line1' | 'address_line2' | 'postal_code' | 'city' | 'country_code'>): string[] {
  return [v.address_line1, v.address_line2, [v.postal_code, v.city].filter(Boolean).join(' '), v.country_code !== 'FR' ? v.country_code : null].filter(
    (x): x is string => Boolean(x),
  )
}

export function adresseClient(c: Pick<ClientImprime, 'billing_line1' | 'billing_line2' | 'billing_postal_code' | 'billing_city' | 'billing_country'>): string[] {
  return [
    c.billing_line1,
    c.billing_line2,
    [c.billing_postal_code, c.billing_city].filter(Boolean).join(' '),
    c.billing_country !== 'FR' ? c.billing_country : null,
  ].filter((x): x is string => Boolean(x))
}

/** Lignes d'identification légale du vendeur pour le pied de page. */
export function identiteLegale(v: VendeurImprime): string[] {
  const capital = v.share_capital_cents != null ? `au capital de ${(v.share_capital_cents / 100).toLocaleString('fr-FR')} €` : null
  return [
    [v.name, v.legal_form, capital].filter(Boolean).join(' '),
    [v.siren ? `SIREN ${v.siren}` : null, v.siret ? `SIRET ${v.siret}` : null, v.registration, v.naf_code ? `NAF ${v.naf_code}` : null]
      .filter(Boolean)
      .join(' · '),
    v.vat_number ? `TVA intracommunautaire ${v.vat_number}` : null,
  ].filter((x): x is string => Boolean(x))
}
