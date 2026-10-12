/**
 * Règles de l'éditeur de documents : ce qui se passe quand on choisit un client,
 * un article du catalogue ou un taux de TVA. Pur et testé.
 */

import { analyserLigneRapide, type CategorieTva } from '@pastille/moteur'
import type { ConditionsPaiement } from './clients'
import type { DocumentEdition, LigneEdition } from './document'
import { ligneVide } from './document'
import type { OrganizationRow } from './supabase/types'
import { MENTIONS, resoudreTva, type NatureArticle, type RegimeEntreprise, type TypeClient } from './fiscalite'

export interface ClientEditeur {
  id: string
  kind: TypeClient
  name: string
  legal_form: string | null
  siren: string | null
  vat_number: string | null
  billing_line1: string | null
  billing_line2: string | null
  billing_postal_code: string | null
  billing_city: string | null
  billing_country: string
  shipping_different: boolean
  service_code: string | null
  default_vat_category: CategorieTva | null
  default_vat_rate: number | null
  exemption_reason: string | null
  default_discount_kind: 'pourcentage' | 'montant' | null
  default_discount_value: number | null
  payment_terms: ConditionsPaiement | null
  early_payment_discount: string | null
  currency: string
  language: 'fr' | 'en'
  purchase_order_required: boolean
  custom_mentions: string | null
}

export interface ProduitEditeur {
  id: string
  name: string
  description: string | null
  unit: string
  unit_price_cents: number
  vat_category: CategorieTva
  vat_rate: number
  nature: NatureArticle
  favorite: boolean
}

export interface ContexteEditeur {
  regime: RegimeEntreprise
  conditionsDefaut: ConditionsPaiement
  escompteDefaut: string
  produits: ReadonlyMap<string, ProduitEditeur>
  /** clé `${clientId}:${productId}` → prix HT spécifique en centimes */
  prixClients: ReadonlyMap<string, number>
}

/** Données sérialisables transmises par le serveur à l'éditeur. */
export interface DonneesEditeur {
  organisation: OrganizationRow
  clients: ClientEditeur[]
  produits: ProduitEditeur[]
  prixClients: Array<[string, number]>
  textes: Record<string, string>
}

export function contexteEditeur(d: DonneesEditeur): ContexteEditeur {
  return {
    regime: d.organisation.vat_regime,
    conditionsDefaut: d.organisation.default_payment_terms,
    escompteDefaut: d.organisation.early_payment_discount,
    produits: new Map(d.produits.map((p) => [p.id, p])),
    prixClients: new Map(d.prixClients),
  }
}

export const OPTIONS_TVA: Array<{ valeur: string; libelle: string }> = [
  { valeur: 'S:2000', libelle: '20 %' },
  { valeur: 'S:1000', libelle: '10 %' },
  { valeur: 'S:550', libelle: '5,5 %' },
  { valeur: 'S:210', libelle: '2,1 %' },
  { valeur: 'S:850', libelle: '8,5 %' },
  { valeur: 'Z:0', libelle: '0 %' },
  { valeur: 'E:0', libelle: 'Exonéré' },
  { valeur: 'AE:0', libelle: 'Autoliq.' },
  { valeur: 'K:0', libelle: 'Intracom.' },
  { valeur: 'G:0', libelle: 'Export' },
  { valeur: 'O:0', libelle: 'Hors champ' },
]

export function valeurTva(l: Pick<LigneEdition, 'categorie' | 'taux'>): string {
  return `${l.categorie}:${l.categorie === 'S' ? l.taux : 0}`
}

/** Options du sélecteur, complétées du taux courant s'il n'est pas dans la liste. */
export function optionsTva(l: Pick<LigneEdition, 'categorie' | 'taux'>): Array<{ valeur: string; libelle: string }> {
  const v = valeurTva(l)
  if (OPTIONS_TVA.some((o) => o.valeur === v)) return OPTIONS_TVA
  return [...OPTIONS_TVA, { valeur: v, libelle: `${(l.taux / 100).toString().replace('.', ',')} %` }]
}

/** Mention par défaut quand on choisit une catégorie sans TVA à la main. */
export function motifParDefaut(categorie: CategorieTva, nature: NatureArticle, regime: RegimeEntreprise): string | null {
  switch (categorie) {
    case 'S':
    case 'Z':
      return null
    case 'E':
      return regime === 'franchise' ? MENTIONS.franchise : ''
    case 'AE':
      return MENTIONS.autoliquidationUe
    case 'K':
      return MENTIONS.livraisonIntracom
    case 'G':
      return MENTIONS.export
    case 'O':
      if (nature === 'debours') return MENTIONS.debours
      return regime === 'non_assujetti' ? MENTIONS.nonAssujetti : MENTIONS.servicesHorsUe
  }
}

export function changerTva(l: LigneEdition, valeur: string, regime: RegimeEntreprise): LigneEdition {
  const [cat, taux] = valeur.split(':') as [CategorieTva, string]
  const motif = cat === l.categorie ? l.motif : motifParDefaut(cat, l.nature, regime)
  return { ...l, categorie: cat, taux: cat === 'S' ? Number(taux) : 0, motif }
}

function clientTva(client: ClientEditeur | null) {
  return client
    ? {
        kind: client.kind,
        defaultVatCategory: client.default_vat_category,
        defaultVatRate: client.default_vat_rate,
        exemptionReason: client.exemption_reason,
      }
    : null
}

/** Ligne issue d'un article du catalogue, au prix du client s'il en a un. */
export function ligneDepuisProduit(
  produit: ProduitEditeur,
  client: ClientEditeur | null,
  ctx: Pick<ContexteEditeur, 'regime' | 'prixClients'>,
  base: Partial<LigneEdition> = {},
): LigneEdition {
  const tva = resoudreTva({
    regimeEntreprise: ctx.regime,
    client: clientTva(client),
    article: { nature: produit.nature, categorie: produit.vat_category, taux: produit.vat_rate },
  })
  const prix = client ? ctx.prixClients.get(`${client.id}:${produit.id}`) : undefined
  return ligneVide({
    ...base,
    productId: produit.id,
    designation: produit.name,
    description: produit.description ?? '',
    unite: produit.unit,
    prixUnitaireHt: prix ?? produit.unit_price_cents,
    nature: produit.nature,
    categorie: tva.categorie,
    taux: tva.taux,
    motif: tva.motif ?? null,
  })
}

/** Ligne libre : TVA déduite de l'entreprise et du client. */
export function ligneLibre(client: ClientEditeur | null, regime: RegimeEntreprise, base: Partial<LigneEdition> = {}): LigneEdition {
  const l = ligneVide(base)
  const tva = resoudreTva({ regimeEntreprise: regime, client: clientTva(client), article: { nature: l.nature, categorie: 'S', taux: 2000 } })
  return { ...l, categorie: tva.categorie, taux: tva.taux, motif: tva.motif ?? null }
}

/** Réapplique prix et TVA d'une ligne après un changement de client. */
export function reappliquerLigne(l: LigneEdition, client: ClientEditeur | null, ctx: ContexteEditeur): LigneEdition {
  const produit = l.productId ? ctx.produits.get(l.productId) : undefined
  if (produit) {
    const r = ligneDepuisProduit(produit, client, ctx, { cle: l.cle, quantite: l.quantite, remise: l.remise })
    // La désignation et la description éventuellement retouchées sont conservées.
    return { ...r, designation: l.designation, description: l.description, unite: l.unite }
  }
  const tva = resoudreTva({
    regimeEntreprise: ctx.regime,
    client: clientTva(client),
    article: { nature: l.nature, categorie: l.categorie === 'S' || l.categorie === 'Z' ? l.categorie : 'S', taux: l.taux || 2000 },
  })
  return { ...l, categorie: tva.categorie, taux: tva.taux, motif: tva.motif ?? null }
}

/** Choix d'un client : conditions, remise, devise, langue, prix et TVA des lignes. */
export function appliquerClient(doc: DocumentEdition, client: ClientEditeur | null, ctx: ContexteEditeur): DocumentEdition {
  return {
    ...doc,
    clientId: client?.id ?? null,
    paymentTerms: client?.payment_terms ?? ctx.conditionsDefaut,
    earlyPaymentDiscount: client?.early_payment_discount ?? ctx.escompteDefaut,
    remise:
      client?.default_discount_kind && client.default_discount_value != null
        ? { type: client.default_discount_kind, valeur: client.default_discount_value }
        : null,
    currency: client?.currency ?? doc.currency,
    language: client?.language ?? doc.language,
    lignes: doc.lignes.map((l) => reappliquerLigne(l, client, ctx)),
  }
}

/**
 * Saisie rapide dans la désignation : « 3 x Création logo 450 ».
 * Ne s'applique qu'à une ligne libre dont le prix n'est pas encore saisi.
 */
export function appliquerSaisieRapide(l: LigneEdition): LigneEdition {
  if (l.productId || l.prixUnitaireHt !== 0) return l
  const r = analyserLigneRapide(l.designation)
  if (!r || (r.prixUnitaireHt === null && r.quantite === 1000)) return l
  return { ...l, designation: r.designation, quantite: r.quantite, prixUnitaireHt: r.prixUnitaireHt ?? l.prixUnitaireHt }
}

/** Articles proposés pour une saisie : favoris d'abord, correspondance sans accents. */
export function suggererProduits(produits: Iterable<ProduitEditeur>, saisie: string, max = 6): ProduitEditeur[] {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const q = norm(saisie.trim())
  if (!q) return []
  return [...produits]
    .filter((p) => norm(p.name).includes(q))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || Number(!norm(a.name).startsWith(q)) - Number(!norm(b.name).startsWith(q)) || a.name.localeCompare(b.name, 'fr'))
    .slice(0, max)
}
