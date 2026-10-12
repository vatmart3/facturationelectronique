/**
 * UN/CEFACT Cross Industry Invoice D16B (syntaxe de Factur-X), profil EN16931.
 * L'ordre des éléments suit le schéma XSD : il est significatif.
 */

import { dateCompacte, montant, pourcentage, quantite, type Facture, type Partie, type Remise } from './modele'
import { el, t } from './xml'

const ESPACES =
  'xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" ' +
  'xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" ' +
  'xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" ' +
  'xmlns:xs="http://www.w3.org/2001/XMLSchema" ' +
  'xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"'

export const PROFIL_EN16931 = 'urn:cen.eu:en16931:2017'

const date = (nom: string, iso: string | null, espace = 'udt') =>
  iso ? el(nom, [t(`${espace}:DateTimeString`, dateCompacte(iso), { format: '102' })]) : ''

function partie(nom: string, p: Partie, vendeur: boolean): string {
  return el(nom, [
    t('ram:Name', p.nom),
    vendeur && t('ram:Description', p.mentionsJuridiques),
    el('ram:SpecifiedLegalOrganization', [t('ram:ID', p.siren, { schemeID: '0002' })]),
    el('ram:PostalTradeAddress', [
      t('ram:PostcodeCode', p.adresse.codePostal),
      t('ram:LineOne', p.adresse.ligne1),
      t('ram:LineTwo', p.adresse.ligne2),
      t('ram:CityName', p.adresse.ville),
      t('ram:CountryID', p.adresse.pays),
    ]),
    p.adresseElectronique && el('ram:URIUniversalCommunication', [t('ram:URIID', p.adresseElectronique.valeur, { schemeID: p.adresseElectronique.schema })]),
    p.tva && el('ram:SpecifiedTaxRegistration', [t('ram:ID', p.tva, { schemeID: 'VA' })]),
    // Vendeur sans n° de TVA (franchise) : identifiant fiscal local (BT-32).
    vendeur && !p.tva && p.siren && el('ram:SpecifiedTaxRegistration', [t('ram:ID', p.siren, { schemeID: 'FC' })]),
  ])
}

function remise(r: Remise, document: boolean): string {
  return el('ram:SpecifiedTradeAllowanceCharge', [
    el('ram:ChargeIndicator', [t('udt:Indicator', 'false')]),
    t('ram:ActualAmount', montant(r.montant)),
    t('ram:Reason', r.motif),
    document &&
      el('ram:CategoryTradeTax', [
        t('ram:TypeCode', 'VAT'),
        t('ram:CategoryCode', r.categorie),
        r.categorie !== 'O' && t('ram:RateApplicablePercent', pourcentage(r.taux ?? 0)),
      ]),
  ])
}

export function genererCii(f: Facture): string {
  const lignes = f.lignes.map((l) =>
    el('ram:IncludedSupplyChainTradeLineItem', [
      el('ram:AssociatedDocumentLineDocument', [t('ram:LineID', l.id)]),
      el('ram:SpecifiedTradeProduct', [t('ram:Name', l.designation), t('ram:Description', l.description)]),
      el('ram:SpecifiedLineTradeAgreement', [el('ram:NetPriceProductTradePrice', [t('ram:ChargeAmount', montant(l.prixUnitaire))])]),
      el('ram:SpecifiedLineTradeDelivery', [t('ram:BilledQuantity', quantite(l.quantite), { unitCode: l.unite })]),
      el('ram:SpecifiedLineTradeSettlement', [
        el('ram:ApplicableTradeTax', [
          t('ram:TypeCode', 'VAT'),
          t('ram:CategoryCode', l.categorie),
          l.categorie !== 'O' && t('ram:RateApplicablePercent', pourcentage(l.taux)),
        ]),
        l.remise && remise(l.remise, false),
        el('ram:SpecifiedTradeSettlementLineMonetarySummation', [t('ram:LineTotalAmount', montant(l.montantNet))]),
      ]),
    ]),
  )

  const notes = f.notes.map((n) => el('ram:IncludedNote', [t('ram:Content', n.texte), t('ram:SubjectCode', n.sujet)]))

  const tva = f.ventilation.map((g) =>
    el('ram:ApplicableTradeTax', [
      t('ram:CalculatedAmount', montant(g.montant)),
      t('ram:TypeCode', 'VAT'),
      t('ram:ExemptionReason', g.motif),
      t('ram:BasisAmount', montant(g.base)),
      t('ram:CategoryCode', g.categorie),
      t('ram:ExemptionReasonCode', g.codeMotif),
      g.categorie !== 'O' && t('ram:RateApplicablePercent', pourcentage(g.taux)),
    ]),
  )

  const corps = el('rsm:CrossIndustryInvoice', [
    el('rsm:ExchangedDocumentContext', [
      el('ram:BusinessProcessSpecifiedDocumentContextParameter', [t('ram:ID', f.cadre)]),
      el('ram:GuidelineSpecifiedDocumentContextParameter', [t('ram:ID', PROFIL_EN16931)]),
    ]),
    el('rsm:ExchangedDocument', [t('ram:ID', f.numero), t('ram:TypeCode', f.type), date('ram:IssueDateTime', f.dateEmission), ...notes]),
    el('rsm:SupplyChainTradeTransaction', [
      ...lignes,
      el('ram:ApplicableHeaderTradeAgreement', [
        t('ram:BuyerReference', f.referenceAcheteur),
        partie('ram:SellerTradeParty', f.vendeur, true),
        partie('ram:BuyerTradeParty', f.acheteur, false),
        f.commande && el('ram:BuyerOrderReferencedDocument', [t('ram:IssuerAssignedID', f.commande)]),
      ]),
      el('ram:ApplicableHeaderTradeDelivery', [
        f.paysLivraison && el('ram:ShipToTradeParty', [el('ram:PostalTradeAddress', [t('ram:CountryID', f.paysLivraison)])]),
        f.dateLivraison && el('ram:ActualDeliverySupplyChainEvent', [date('ram:OccurrenceDateTime', f.dateLivraison)]),
        // Toujours présent, même vide : élément obligatoire du schéma.
      ]) || '<ram:ApplicableHeaderTradeDelivery/>',
      el('ram:ApplicableHeaderTradeSettlement', [
        t('ram:PaymentReference', f.paiement.reference),
        t('ram:InvoiceCurrencyCode', f.devise),
        (f.paiement.iban || f.type !== '381') &&
          el('ram:SpecifiedTradeSettlementPaymentMeans', [
            t('ram:TypeCode', f.paiement.moyen),
            f.paiement.iban && el('ram:PayeePartyCreditorFinancialAccount', [t('ram:IBANID', f.paiement.iban)]),
            f.paiement.bic && el('ram:PayeeSpecifiedCreditorFinancialInstitution', [t('ram:BICID', f.paiement.bic)]),
          ]),
        ...tva,
        f.periode && el('ram:BillingSpecifiedPeriod', [date('ram:StartDateTime', f.periode.debut), date('ram:EndDateTime', f.periode.fin)]),
        ...f.remises.map((r) => remise(r, true)),
        (f.paiement.conditions || f.dateEcheance) &&
          el('ram:SpecifiedTradePaymentTerms', [t('ram:Description', f.paiement.conditions), date('ram:DueDateDateTime', f.dateEcheance)]),
        el('ram:SpecifiedTradeSettlementHeaderMonetarySummation', [
          t('ram:LineTotalAmount', montant(f.totaux.lignes)),
          f.totaux.remises !== 0 && t('ram:AllowanceTotalAmount', montant(f.totaux.remises)),
          t('ram:TaxBasisTotalAmount', montant(f.totaux.ht)),
          t('ram:TaxTotalAmount', montant(f.totaux.tva), { currencyID: f.devise }),
          t('ram:GrandTotalAmount', montant(f.totaux.ttc)),
          f.totaux.dejaPaye !== 0 && t('ram:TotalPrepaidAmount', montant(f.totaux.dejaPaye)),
          t('ram:DuePayableAmount', montant(f.totaux.net)),
        ]),
        f.facturePrecedente &&
          el('ram:InvoiceReferencedDocument', [
            t('ram:IssuerAssignedID', f.facturePrecedente.numero),
            date('ram:FormattedIssueDateTime', f.facturePrecedente.date, 'qdt'),
          ]),
      ]),
    ]),
  ])

  return `<?xml version="1.0" encoding="UTF-8"?>\n${corps.replace('<rsm:CrossIndustryInvoice>', `<rsm:CrossIndustryInvoice ${ESPACES}>`)}\n`
}
