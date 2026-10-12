/**
 * Contrôle de conformité d'une facture française (art. 242 nonies A de l'annexe II du CGI,
 * L441-9 et L441-10 du Code de commerce, réforme 2026-2027) et mentions à imprimer.
 * Un contrôle « bloquant » empêche l'émission.
 */

import type { Totaux } from '@pastille/moteur'
import type { TypeClient } from './fiscalite'
import { MENTIONS } from './fiscalite'
import type { DocumentEdition } from './document'
import { ligneSignificative } from './document'

export interface Vendeur {
  name: string
  legal_form: string | null
  share_capital_cents: number | null
  siren: string | null
  vat_number: string | null
  registration: string | null
  address_line1: string | null
  postal_code: string | null
  city: string | null
  vat_regime: 'franchise' | 'reel_simplifie' | 'reel_normal' | 'non_assujetti' | null
  vat_on_debits: boolean
  late_penalty_terms: string
  early_payment_discount: string
}

export interface Acheteur {
  kind: TypeClient
  name: string
  siren: string | null
  vat_number: string | null
  billing_line1: string | null
  billing_postal_code: string | null
  billing_city: string | null
  shipping_different: boolean
  purchase_order_required: boolean
  service_code: string | null
  custom_mentions: string | null
}

export interface Controle {
  cle: string
  libelle: string
  ok: boolean
  bloquant: boolean
  aide?: string
  /** Où corriger : « document », « client », « entreprise ». */
  ou: 'document' | 'client' | 'entreprise'
}

export interface ResultatConformite {
  controles: Controle[]
  mentions: string[]
  peutEmettre: boolean
}

/** Formes juridiques de sociétés : capital social et immatriculation obligatoires. */
const SOCIETES = ['SARL', 'EURL', 'SAS', 'SASU', 'SA', 'SNC', 'SCI', 'SELARL', 'SELAS', 'SEL', 'SCS', 'Société civile']

export type Textes = Partial<Record<string, string>>

function texte(cle: string, textes: Textes, defaut: string): string {
  return textes[cle] ?? defaut
}

export function verifierConformite(
  doc: Pick<DocumentEdition, 'type' | 'lignes' | 'purchaseOrder' | 'issueDate' | 'serviceDate' | 'servicePeriodStart' | 'originDocumentId'>,
  vendeur: Vendeur,
  acheteur: Acheteur | null,
  totaux: Totaux | null,
  textes: Textes = {},
): ResultatConformite {
  const c: Controle[] = []
  const ajouter = (x: Controle) => c.push(x)
  const lignes = doc.lignes.filter(ligneSignificative)
  const facture = doc.type !== 'devis'
  const pro = acheteur ? acheteur.kind !== 'b2c' : false
  const franchise = vendeur.vat_regime === 'franchise'
  const societe = vendeur.legal_form ? SOCIETES.includes(vendeur.legal_form) : false

  // Vendeur
  ajouter({ cle: 'vendeur_siren', libelle: 'SIREN de votre entreprise', ok: Boolean(vendeur.siren), bloquant: facture, ou: 'entreprise' })
  ajouter({
    cle: 'vendeur_adresse',
    libelle: 'Adresse de votre entreprise',
    ok: Boolean(vendeur.address_line1 && vendeur.postal_code && vendeur.city),
    bloquant: facture,
    ou: 'entreprise',
  })
  ajouter({ cle: 'vendeur_regime', libelle: 'Régime de TVA choisi', ok: Boolean(vendeur.vat_regime), bloquant: facture, ou: 'entreprise' })
  if (!franchise && vendeur.vat_regime !== 'non_assujetti') {
    ajouter({ cle: 'vendeur_tva', libelle: 'Votre numéro de TVA intracommunautaire', ok: Boolean(vendeur.vat_number), bloquant: facture, ou: 'entreprise' })
  }
  if (societe) {
    ajouter({ cle: 'vendeur_capital', libelle: 'Capital social', ok: vendeur.share_capital_cents != null, bloquant: facture, ou: 'entreprise' })
    ajouter({ cle: 'vendeur_rcs', libelle: 'Immatriculation (RCS ou RM)', ok: Boolean(vendeur.registration), bloquant: facture, ou: 'entreprise' })
  }

  // Client
  ajouter({ cle: 'client', libelle: 'Client sélectionné', ok: Boolean(acheteur), bloquant: true, ou: 'document' })
  if (acheteur) {
    ajouter({
      cle: 'client_adresse',
      libelle: 'Adresse de facturation du client',
      ok: Boolean(acheteur.billing_line1 && acheteur.billing_city),
      bloquant: facture,
      ou: 'client',
    })
    if (acheteur.kind === 'b2b') {
      ajouter({
        cle: 'client_siren',
        libelle: 'SIREN du client',
        ok: Boolean(acheteur.siren),
        bloquant: true,
        aide: 'Obligatoire sur les factures entre entreprises françaises depuis la réforme.',
        ou: 'client',
      })
    }
    if (acheteur.kind === 'ue') {
      ajouter({ cle: 'client_tva', libelle: 'N° de TVA intracommunautaire du client', ok: Boolean(acheteur.vat_number), bloquant: true, ou: 'client' })
    }
    if (acheteur.purchase_order_required) {
      ajouter({ cle: 'bon_commande', libelle: 'Numéro de bon de commande', ok: Boolean(doc.purchaseOrder.trim()), bloquant: facture, ou: 'document' })
    }
    if (acheteur.kind === 'b2g') {
      ajouter({
        cle: 'chorus',
        libelle: 'Code service ou numéro d’engagement (Chorus Pro)',
        ok: Boolean(acheteur.service_code || doc.purchaseOrder.trim()),
        bloquant: false,
        aide: 'Souvent exigé par l’administration pour traiter la facture.',
        ou: 'client',
      })
    }
  }

  // Document
  ajouter({ cle: 'lignes', libelle: 'Au moins une ligne', ok: lignes.length > 0, bloquant: true, ou: 'document' })
  ajouter({
    cle: 'designations',
    libelle: 'Désignation de chaque ligne',
    ok: lignes.every((l) => l.designation.trim() !== ''),
    bloquant: true,
    ou: 'document',
  })
  ajouter({ cle: 'quantites', libelle: 'Quantités non nulles', ok: lignes.every((l) => l.quantite !== 0), bloquant: true, ou: 'document' })
  ajouter({ cle: 'calcul', libelle: 'Montants cohérents', ok: totaux !== null, bloquant: true, ou: 'document' })
  ajouter({
    cle: 'date_prestation',
    libelle: 'Date de la vente ou de la prestation',
    ok: Boolean(doc.serviceDate || doc.servicePeriodStart || doc.issueDate),
    bloquant: false,
    aide: 'À défaut, la date d’émission est utilisée.',
    ou: 'document',
  })
  if (franchise) {
    ajouter({
      cle: 'franchise',
      libelle: 'Aucune TVA facturée en franchise en base',
      ok: lignes.every((l) => l.categorie !== 'S'),
      bloquant: true,
      ou: 'document',
    })
  }
  ajouter({
    cle: 'motifs',
    libelle: 'Motif d’exonération ou d’autoliquidation',
    ok: lignes.every((l) => l.categorie === 'S' || l.categorie === 'Z' || Boolean(l.motif?.trim())),
    bloquant: facture,
    ou: 'document',
  })
  if (doc.type === 'avoir') {
    ajouter({ cle: 'origine', libelle: 'Facture d’origine de l’avoir', ok: Boolean(doc.originDocumentId), bloquant: true, ou: 'document' })
  }

  // Mentions imprimées
  const mentions: string[] = []
  if (doc.type === 'acompte') mentions.push(texte('acompte', textes, 'Facture d’acompte'))
  if (totaux?.categorieOperation) {
    mentions.push(
      `Catégorie de l’opération : ${{ biens: 'livraison de biens', services: 'prestation de services', mixte: 'livraison de biens et prestation de services' }[totaux.categorieOperation]}`,
    )
  }
  const motifs = new Set(lignes.filter((l) => l.categorie !== 'S' && l.motif?.trim()).map((l) => l.motif!.trim()))
  if (franchise) motifs.add(texte('franchise', textes, MENTIONS.franchise))
  mentions.push(...motifs)
  if (vendeur.vat_on_debits && !franchise) mentions.push(texte('tva_debits', textes, 'Option pour le paiement de la TVA d’après les débits'))
  if (facture) {
    mentions.push(`Escompte : ${vendeur.early_payment_discount}`)
    mentions.push(`Pénalités de retard : ${vendeur.late_penalty_terms}`)
    if (pro) {
      mentions.push(
        texte(
          'indemnite_recouvrement',
          textes,
          'Indemnité forfaitaire pour frais de recouvrement en cas de retard de paiement : 40 € (art. L441-10 et D441-5 du Code de commerce)',
        ),
      )
    }
  }
  if (acheteur?.custom_mentions) mentions.push(acheteur.custom_mentions)

  return { controles: c, mentions, peutEmettre: c.every((x) => x.ok || !x.bloquant) }
}
