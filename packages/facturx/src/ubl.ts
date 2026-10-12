/**
 * OASIS UBL 2.1 (Invoice ou CreditNote), règles EN 16931.
 * L'ordre des éléments suit le schéma XSD : il est significatif.
 */

import { montant, pourcentage, quantite, type CategorieTva, type Facture, type Partie } from './modele'
import { PROFIL_EN16931 } from './cii'
import { el, t } from './xml'

const CAC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2'
const CBC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2'

function categorie(nom: string, c: CategorieTva, taux: number, motif?: { code: string | null; texte: string | null }): string {
  return el(nom, [
    t('cbc:ID', c),
    c !== 'O' && t('cbc:Percent', pourcentage(taux)),
    motif && t('cbc:TaxExemptionReasonCode', motif.code),
    motif && t('cbc:TaxExemptionReason', motif.texte),
    el('cac:TaxScheme', [t('cbc:ID', 'VAT')]),
  ])
}

function partie(nom: string, p: Partie, vendeur: boolean): string {
  return el(nom, [
    el('cac:Party', [
      p.adresseElectronique && t('cbc:EndpointID', p.adresseElectronique.valeur, { schemeID: p.adresseElectronique.schema }),
      p.siret && el('cac:PartyIdentification', [t('cbc:ID', p.siret, { schemeID: '0009' })]),
      el('cac:PostalAddress', [
        t('cbc:StreetName', p.adresse.ligne1),
        t('cbc:AdditionalStreetName', p.adresse.ligne2),
        t('cbc:CityName', p.adresse.ville),
        t('cbc:PostalZone', p.adresse.codePostal),
        el('cac:Country', [t('cbc:IdentificationCode', p.adresse.pays)]),
      ]),
      p.tva && el('cac:PartyTaxScheme', [t('cbc:CompanyID', p.tva), el('cac:TaxScheme', [t('cbc:ID', 'VAT')])]),
      vendeur && !p.tva && p.siren && el('cac:PartyTaxScheme', [t('cbc:CompanyID', p.siren), el('cac:TaxScheme', [t('cbc:ID', 'FC')])]),
      el('cac:PartyLegalEntity', [
        t('cbc:RegistrationName', p.nom),
        t('cbc:CompanyID', p.siren, { schemeID: '0002' }),
        vendeur && t('cbc:CompanyLegalForm', p.mentionsJuridiques),
      ]),
    ]),
  ])
}

export function genererUbl(f: Facture): string {
  const avoir = f.type === '381'
  const racine = avoir ? 'CreditNote' : 'Invoice'
  const d = f.devise
  const m = (nom: string, c: number) => t(nom, montant(c), { currencyID: d })

  const lignes = f.lignes.map((l) =>
    el(avoir ? 'cac:CreditNoteLine' : 'cac:InvoiceLine', [
      t('cbc:ID', l.id),
      t(avoir ? 'cbc:CreditedQuantity' : 'cbc:InvoicedQuantity', quantite(l.quantite), { unitCode: l.unite }),
      m('cbc:LineExtensionAmount', l.montantNet),
      l.remise &&
        el('cac:AllowanceCharge', [t('cbc:ChargeIndicator', 'false'), t('cbc:AllowanceChargeReason', l.remise.motif), m('cbc:Amount', l.remise.montant)]),
      el('cac:Item', [t('cbc:Description', l.description), t('cbc:Name', l.designation), categorie('cac:ClassifiedTaxCategory', l.categorie, l.taux)]),
      el('cac:Price', [m('cbc:PriceAmount', l.prixUnitaire)]),
    ]),
  )

  const corps = el(racine, [
    t('cbc:CustomizationID', PROFIL_EN16931),
    t('cbc:ProfileID', f.cadre),
    t('cbc:ID', f.numero),
    t('cbc:IssueDate', f.dateEmission),
    !avoir && t('cbc:DueDate', f.dateEcheance),
    t(avoir ? 'cbc:CreditNoteTypeCode' : 'cbc:InvoiceTypeCode', f.type),
    // UBL n'a pas de code sujet : il est préfixé au texte (#PMT#…), convention EN 16931.
    ...f.notes.map((n) => t('cbc:Note', n.sujet ? `#${n.sujet}#${n.texte}` : n.texte)),
    t('cbc:DocumentCurrencyCode', d),
    t('cbc:BuyerReference', f.referenceAcheteur),
    f.periode && el('cac:InvoicePeriod', [t('cbc:StartDate', f.periode.debut), t('cbc:EndDate', f.periode.fin)]),
    f.commande && el('cac:OrderReference', [t('cbc:ID', f.commande)]),
    f.facturePrecedente &&
      el('cac:BillingReference', [el('cac:InvoiceDocumentReference', [t('cbc:ID', f.facturePrecedente.numero), t('cbc:IssueDate', f.facturePrecedente.date)])]),
    partie('cac:AccountingSupplierParty', f.vendeur, true),
    partie('cac:AccountingCustomerParty', f.acheteur, false),
    (f.dateLivraison || f.paysLivraison) &&
      el('cac:Delivery', [
        t('cbc:ActualDeliveryDate', f.dateLivraison),
        f.paysLivraison && el('cac:DeliveryLocation', [el('cac:Address', [el('cac:Country', [t('cbc:IdentificationCode', f.paysLivraison)])])]),
      ]),
    (f.paiement.iban || !avoir) &&
      el('cac:PaymentMeans', [
        t('cbc:PaymentMeansCode', f.paiement.moyen),
        avoir && t('cbc:PaymentDueDate', f.dateEcheance),
        t('cbc:PaymentID', f.paiement.reference),
        f.paiement.iban &&
          el('cac:PayeeFinancialAccount', [
            t('cbc:ID', f.paiement.iban),
            f.paiement.bic && el('cac:FinancialInstitutionBranch', [t('cbc:ID', f.paiement.bic)]),
          ]),
      ]),
    f.paiement.conditions && el('cac:PaymentTerms', [t('cbc:Note', f.paiement.conditions)]),
    ...f.remises.map((r) =>
      el('cac:AllowanceCharge', [
        t('cbc:ChargeIndicator', 'false'),
        t('cbc:AllowanceChargeReason', r.motif),
        m('cbc:Amount', r.montant),
        categorie('cac:TaxCategory', r.categorie ?? 'S', r.taux ?? 0),
      ]),
    ),
    el('cac:TaxTotal', [
      m('cbc:TaxAmount', f.totaux.tva),
      ...f.ventilation.map((g) =>
        el('cac:TaxSubtotal', [
          m('cbc:TaxableAmount', g.base),
          m('cbc:TaxAmount', g.montant),
          categorie('cac:TaxCategory', g.categorie, g.taux, g.motif || g.codeMotif ? { code: g.codeMotif, texte: g.motif } : undefined),
        ]),
      ),
    ]),
    el('cac:LegalMonetaryTotal', [
      m('cbc:LineExtensionAmount', f.totaux.lignes),
      m('cbc:TaxExclusiveAmount', f.totaux.ht),
      m('cbc:TaxInclusiveAmount', f.totaux.ttc),
      f.totaux.remises !== 0 && m('cbc:AllowanceTotalAmount', f.totaux.remises),
      f.totaux.dejaPaye !== 0 && m('cbc:PrepaidAmount', f.totaux.dejaPaye),
      m('cbc:PayableAmount', f.totaux.net),
    ]),
    ...lignes,
  ])

  const ns = `xmlns="urn:oasis:names:specification:ubl:schema:xsd:${racine}-2" xmlns:cac="${CAC}" xmlns:cbc="${CBC}"`
  return `<?xml version="1.0" encoding="UTF-8"?>\n${corps.replace(`<${racine}>`, `<${racine} ${ns}>`)}\n`
}
