/**
 * Document imprimable → modèle EN 16931 (@pastille/facturx).
 * Un avoir (type 381) porte des montants positifs : les signes de l'application sont inversés.
 * Correspondance détaillée : docs/mapping-en16931.md.
 */

import { CODES_EXONERATION, codeUnite, type Cadre, type CodeType, type Facture, type Note, type Partie, type Remise } from '@pastille/facturx'
import type { ClientImprime, DocumentImprimable, VendeurImprime } from './imprimable'

const PAYS_SEPA = new Set('AT BE BG CH CY CZ DE DK EE ES FI FR GB GR HR HU IE IS IT LI LT LU LV MC MT NL NO PL PT RO SE SI SK SM VA AD'.split(' '))

function mentionsJuridiques(v: VendeurImprime): string | null {
  const capital = v.share_capital_cents != null ? `au capital de ${(v.share_capital_cents / 100).toLocaleString('fr-FR')} €` : null
  const texte = [v.legal_form, capital, v.registration].filter(Boolean).join(' · ')
  return texte || null
}

function vendeur(v: VendeurImprime): Partie {
  return {
    nom: v.name,
    siren: v.siren,
    siret: v.siret,
    tva: v.vat_number,
    mentionsJuridiques: mentionsJuridiques(v),
    adresse: { ligne1: v.address_line1, ligne2: v.address_line2, codePostal: v.postal_code, ville: v.city, pays: v.country_code || 'FR' },
    adresseElectronique: v.siren ? { valeur: v.siren, schema: '0225' } : null,
  }
}

/** Adresse électronique de réception (BT-49) : celle de la fiche, sinon le SIREN dans l'annuaire. */
export function adresseElectroniqueClient(c: Pick<ClientImprime, 'einvoice_address' | 'siren'>): Partie['adresseElectronique'] {
  const saisie = c.einvoice_address?.trim()
  if (saisie) {
    if (saisie.includes('@')) return { valeur: saisie, schema: 'EM' }
    const m = /^(\d{4}):(.+)$/.exec(saisie)
    if (m) return { valeur: m[2]!, schema: m[1]! }
    return { valeur: saisie, schema: '0225' }
  }
  return c.siren ? { valeur: c.siren, schema: '0225' } : null
}

function acheteur(c: ClientImprime): Partie {
  return {
    nom: c.name,
    siren: c.siren,
    siret: c.siret,
    tva: c.vat_number,
    mentionsJuridiques: null,
    adresse: { ligne1: c.billing_line1, ligne2: c.billing_line2, codePostal: c.billing_postal_code, ville: c.billing_city, pays: c.billing_country || 'FR' },
    adresseElectronique: adresseElectroniqueClient(c),
  }
}

function sujet(texte: string): Note['sujet'] {
  if (/^Pénalités/i.test(texte)) return 'PMD'
  if (/Indemnité forfaitaire/i.test(texte)) return 'PMT'
  if (/^Escompte/i.test(texte)) return 'AAB'
  return undefined
}

export function codeType(d: Pick<DocumentImprimable, 'type'>): CodeType {
  return d.type === 'avoir' ? '381' : d.type === 'acompte' ? '386' : '380'
}

/** Null pour un devis ou un brouillon : seuls les documents émis ont un équivalent EN 16931. */
export function versEn16931(d: DocumentImprimable): Facture | null {
  if (d.type === 'devis' || !d.numero || !d.client) return null
  const signe = d.type === 'avoir' ? -1 : 1
  const s = (x: number) => (x === 0 ? 0 : x * signe)

  const remises: Remise[] = d.ventilation.flatMap((g) => [
    ...(g.remiseGlobale !== 0 ? [{ montant: s(g.remiseGlobale), motif: 'Remise globale', categorie: g.categorie, taux: g.taux }] : []),
    ...(g.acomptes !== 0
      ? [{ montant: s(g.acomptes), motif: `Acomptes déduits (${d.acomptes.map((a) => a.numero).join(', ')})`, categorie: g.categorie, taux: g.taux }]
      : []),
  ])

  const nature = d.totaux.categorieOperation === 'biens' ? 'B' : d.totaux.categorieOperation === 'mixte' ? 'M' : 'S'
  const cadre = `${nature}${d.acomptes.length > 0 ? 4 : 1}` as Cadre
  const iban = d.vendeur.iban?.replace(/\s/g, '') || null

  return {
    numero: d.numero,
    cadre,
    type: codeType(d),
    dateEmission: d.dateEmission,
    dateEcheance: d.dateEcheance,
    devise: d.devise,
    referenceAcheteur: d.client.service_code,
    commande: d.bonCommande,
    notes: [
      ...(d.objet ? [{ texte: d.objet }] : []),
      ...d.mentions.map((m) => ({ texte: m, sujet: sujet(m) })),
      ...(d.notes ? [{ texte: d.notes }] : []),
    ],
    facturePrecedente: d.origine,
    vendeur: vendeur(d.vendeur),
    acheteur: acheteur(d.client),
    dateLivraison: d.datePrestation,
    periode: d.periode,
    paysLivraison: d.lignes.some((l) => l.categorie === 'K') ? (d.client.shipping_different && d.client.shipping_country ? d.client.shipping_country : d.client.billing_country) : null,
    paiement: {
      moyen: iban && PAYS_SEPA.has(iban.slice(0, 2)) ? '58' : '30',
      iban,
      bic: d.vendeur.bic,
      reference: d.numero,
      conditions: d.conditions,
    },
    lignes: d.lignes.map((l, i) => ({
      id: String(i + 1),
      designation: l.designation || '—',
      description: l.description.trim() || null,
      quantite: s(l.quantite),
      unite: codeUnite(l.unite),
      prixUnitaire: l.prixUnitaireHt,
      remise: l.montantRemise !== 0 ? { montant: s(l.montantRemise), motif: 'Remise' } : null,
      montantNet: s(l.montantNet),
      categorie: l.categorie,
      taux: l.taux,
    })),
    remises,
    ventilation: d.ventilation.map((g) => ({
      categorie: g.categorie,
      taux: g.taux,
      base: s(g.baseHt),
      montant: s(g.tva),
      motif: g.categorie === 'S' || g.categorie === 'Z' ? null : (g.motifExoneration ?? null),
      codeMotif: CODES_EXONERATION[g.categorie] ?? null,
    })),
    totaux: {
      lignes: s(d.totaux.totalLignesHt),
      remises: s(d.totaux.remiseGlobale + d.totaux.acomptesHt),
      ht: s(d.totaux.totalHt),
      tva: s(d.totaux.totalTva),
      ttc: s(d.totaux.totalTtc),
      dejaPaye: 0,
      net: s(d.totaux.netAPayer),
    },
  }
}
