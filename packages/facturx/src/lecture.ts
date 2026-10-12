/**
 * Lecture d'une facture reçue (CII / Factur-X ou UBL 2.1) : les données utiles au traitement
 * d'une facture fournisseur. Les montants sont rendus en centimes, signés comme dans le XML.
 */

import { XMLParser } from 'fast-xml-parser'
import type { CategorieTva } from './modele'

export interface FactureLue {
  syntaxe: 'cii' | 'ubl'
  type: string
  numero: string
  dateEmission: string
  dateEcheance: string | null
  devise: string
  vendeur: { nom: string; siren: string | null; tva: string | null }
  acheteur: { nom: string; siren: string | null; tva: string | null }
  totaux: { ht: number; tva: number; ttc: number; net: number }
  ventilation: Array<{ categorie: CategorieTva; taux: number; base: number; montant: number }>
  lignes: Array<{ designation: string; quantite: number; montant: number }>
  facturePrecedente: string | null
}

export class ErreurLecture extends Error {}

const analyseur = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
  isArray: (nom) => ['IncludedSupplyChainTradeLineItem', 'ApplicableTradeTax', 'TaxSubtotal', 'InvoiceLine', 'CreditNoteLine', 'IncludedNote', 'Note'].includes(nom),
})

type Noeud = Record<string, unknown> | undefined

function noeud(n: unknown, ...chemin: string[]): Noeud {
  let courant: unknown = n
  for (const c of chemin) {
    if (courant == null || typeof courant !== 'object') return undefined
    courant = (courant as Record<string, unknown>)[c]
  }
  return courant as Noeud
}

function texte(n: unknown, ...chemin: string[]): string | null {
  const v = chemin.length ? noeud(n, ...chemin) : n
  if (v == null) return null
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (typeof v === 'object' && '#text' in v) return String((v as { '#text': unknown })['#text'])
  return null
}

/** « 123.45 » → 12345 (centimes) ; tolère « 123,45 ». */
export function centimes(valeur: string | null): number {
  if (!valeur) return 0
  const m = /^(-?)(\d+)(?:[.,](\d+))?$/.exec(valeur.trim())
  if (!m) throw new ErreurLecture(`Montant illisible : ${valeur}`)
  const dec = (m[3] ?? '').padEnd(2, '0')
  const arrondi = dec.length > 2 && Number(dec[2]) >= 5 ? 1 : 0
  const v = Number(m[2]) * 100 + Number(dec.slice(0, 2)) + arrondi
  return m[1] ? -v : v
}

function points(valeur: string | null): number {
  if (!valeur) return 0
  return Math.round(Number(valeur.replace(',', '.')) * 100)
}

function dateIso(v: string | null): string | null {
  if (!v) return null
  if (/^\d{8}$/.test(v)) return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10)
  return null
}

function lireCii(racine: Noeud): FactureLue {
  const doc = noeud(racine, 'ExchangedDocument')
  const tx = noeud(racine, 'SupplyChainTradeTransaction')
  const accord = noeud(tx, 'ApplicableHeaderTradeAgreement')
  const reglement = noeud(tx, 'ApplicableHeaderTradeSettlement')
  const somme = noeud(reglement, 'SpecifiedTradeSettlementHeaderMonetarySummation')
  const partie = (p: Noeud) => {
    const enregistrements = noeud(p, 'SpecifiedTaxRegistration')
    const liste = Array.isArray(enregistrements) ? enregistrements : enregistrements ? [enregistrements] : []
    const tva = liste.map((e) => noeud(e, 'ID')).find((id) => (id as Record<string, unknown> | undefined)?.['@schemeID'] === 'VA')
    return { nom: texte(p, 'Name') ?? '', siren: texte(p, 'SpecifiedLegalOrganization', 'ID'), tva: tva ? texte(tva) : null }
  }
  const taxes = (noeud(reglement, 'ApplicableTradeTax') as unknown as Noeud[] | undefined) ?? []
  const lignes = (noeud(tx, 'IncludedSupplyChainTradeLineItem') as unknown as Noeud[] | undefined) ?? []
  const numero = texte(doc, 'ID')
  const date = dateIso(texte(doc, 'IssueDateTime', 'DateTimeString'))
  if (!numero || !date) throw new ErreurLecture('Numéro ou date de facture absent.')
  return {
    syntaxe: 'cii',
    type: texte(doc, 'TypeCode') ?? '380',
    numero,
    dateEmission: date,
    dateEcheance: dateIso(texte(reglement, 'SpecifiedTradePaymentTerms', 'DueDateDateTime', 'DateTimeString')),
    devise: texte(reglement, 'InvoiceCurrencyCode') ?? 'EUR',
    vendeur: partie(noeud(accord, 'SellerTradeParty')),
    acheteur: partie(noeud(accord, 'BuyerTradeParty')),
    totaux: {
      ht: centimes(texte(somme, 'TaxBasisTotalAmount')),
      tva: centimes(texte(somme, 'TaxTotalAmount')),
      ttc: centimes(texte(somme, 'GrandTotalAmount')),
      net: centimes(texte(somme, 'DuePayableAmount')),
    },
    ventilation: taxes.map((g) => ({
      categorie: (texte(g, 'CategoryCode') ?? 'S') as CategorieTva,
      taux: points(texte(g, 'RateApplicablePercent')),
      base: centimes(texte(g, 'BasisAmount')),
      montant: centimes(texte(g, 'CalculatedAmount')),
    })),
    lignes: lignes.map((l) => ({
      designation: texte(l, 'SpecifiedTradeProduct', 'Name') ?? '',
      quantite: Math.round(Number(texte(l, 'SpecifiedLineTradeDelivery', 'BilledQuantity') ?? '0') * 1000),
      montant: centimes(texte(l, 'SpecifiedLineTradeSettlement', 'SpecifiedTradeSettlementLineMonetarySummation', 'LineTotalAmount')),
    })),
    facturePrecedente: texte(reglement, 'InvoiceReferencedDocument', 'IssuerAssignedID'),
  }
}

function lireUbl(racine: Noeud, avoir: boolean): FactureLue {
  const partie = (p: Noeud) => {
    const fiscal = noeud(p, 'Party', 'PartyTaxScheme')
    const schemas = Array.isArray(fiscal) ? fiscal : fiscal ? [fiscal] : []
    const tva = schemas.find((s) => texte(s, 'TaxScheme', 'ID') === 'VAT')
    return {
      nom: texte(p, 'Party', 'PartyLegalEntity', 'RegistrationName') ?? texte(p, 'Party', 'PartyName', 'Name') ?? '',
      siren: texte(p, 'Party', 'PartyLegalEntity', 'CompanyID'),
      tva: tva ? texte(tva, 'CompanyID') : null,
    }
  }
  const total = noeud(racine, 'LegalMonetaryTotal')
  const taxes = (noeud(racine, 'TaxTotal', 'TaxSubtotal') as unknown as Noeud[] | undefined) ?? []
  const lignes = (noeud(racine, avoir ? 'CreditNoteLine' : 'InvoiceLine') as unknown as Noeud[] | undefined) ?? []
  const numero = texte(racine, 'ID')
  const date = dateIso(texte(racine, 'IssueDate'))
  if (!numero || !date) throw new ErreurLecture('Numéro ou date de facture absent.')
  return {
    syntaxe: 'ubl',
    type: texte(racine, avoir ? 'CreditNoteTypeCode' : 'InvoiceTypeCode') ?? (avoir ? '381' : '380'),
    numero,
    dateEmission: date,
    dateEcheance: dateIso(texte(racine, 'DueDate') ?? texte(racine, 'PaymentMeans', 'PaymentDueDate')),
    devise: texte(racine, 'DocumentCurrencyCode') ?? 'EUR',
    vendeur: partie(noeud(racine, 'AccountingSupplierParty')),
    acheteur: partie(noeud(racine, 'AccountingCustomerParty')),
    totaux: {
      ht: centimes(texte(total, 'TaxExclusiveAmount')),
      tva: centimes(texte(racine, 'TaxTotal', 'TaxAmount')),
      ttc: centimes(texte(total, 'TaxInclusiveAmount')),
      net: centimes(texte(total, 'PayableAmount')),
    },
    ventilation: taxes.map((g) => ({
      categorie: (texte(g, 'TaxCategory', 'ID') ?? 'S') as CategorieTva,
      taux: points(texte(g, 'TaxCategory', 'Percent')),
      base: centimes(texte(g, 'TaxableAmount')),
      montant: centimes(texte(g, 'TaxAmount')),
    })),
    lignes: lignes.map((l) => ({
      designation: texte(l, 'Item', 'Name') ?? '',
      quantite: Math.round(Number(texte(l, avoir ? 'CreditedQuantity' : 'InvoicedQuantity') ?? '0') * 1000),
      montant: centimes(texte(l, 'LineExtensionAmount')),
    })),
    facturePrecedente: texte(racine, 'BillingReference', 'InvoiceDocumentReference', 'ID'),
  }
}

export function lireFacture(xml: string): FactureLue {
  let arbre: Record<string, unknown>
  try {
    arbre = analyseur.parse(xml) as Record<string, unknown>
  } catch {
    throw new ErreurLecture('XML illisible.')
  }
  if (arbre.CrossIndustryInvoice) return lireCii(arbre.CrossIndustryInvoice as Noeud)
  if (arbre.Invoice) return lireUbl(arbre.Invoice as Noeud, false)
  if (arbre.CreditNote) return lireUbl(arbre.CreditNote as Noeud, true)
  throw new ErreurLecture('Format non reconnu : CII (Factur-X) ou UBL attendu.')
}
