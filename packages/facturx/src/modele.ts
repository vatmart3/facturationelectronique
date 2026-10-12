/**
 * Modèle neutre d'une facture selon la norme EN 16931 (termes métier BT-xx / BG-xx).
 * Les montants sont en centimes (entiers), toujours positifs pour un avoir (type 381) :
 * c'est le code de type qui porte le sens, comme l'exige la norme.
 * La conversion depuis l'application se fait dans apps/web/src/lib/en16931.ts.
 */

export type CategorieTva = 'S' | 'Z' | 'E' | 'AE' | 'K' | 'G' | 'O'

/** UNTDID 1001 : 380 facture, 381 avoir, 386 facture d'acompte. */
export type CodeType = '380' | '381' | '386'

export interface Adresse {
  ligne1: string | null
  ligne2: string | null
  codePostal: string | null
  ville: string | null
  /** ISO 3166-1 alpha-2 */
  pays: string
}

export interface Partie {
  /** BT-27 / BT-44 */
  nom: string
  /** BT-30 / BT-47 : SIREN (schéma 0002) */
  siren: string | null
  /** BT-29 / BT-46 : SIRET (schéma 0009) */
  siret: string | null
  /** BT-31 / BT-48 */
  tva: string | null
  /** BT-33 : informations juridiques complémentaires (forme, capital, RCS) */
  mentionsJuridiques: string | null
  adresse: Adresse
  /** BT-34 / BT-49 : adresse électronique (schéma 0225 = annuaire français, SIREN) */
  adresseElectronique: { valeur: string; schema: string } | null
}

export interface Note {
  texte: string
  /** UNTDID 4451 : PMT indemnité, PMD pénalités, AAB escompte, REG réglementaire, SUR remarques */
  sujet?: 'PMT' | 'PMD' | 'AAB' | 'REG' | 'SUR' | 'ABL' | 'TXD'
}

export interface Remise {
  /** BT-92 / BT-136 */
  montant: number
  /** BT-97 / BT-139 */
  motif: string
  /** Remise au niveau du document : catégorie et taux concernés (BT-95 / BT-96) */
  categorie?: CategorieTva
  taux?: number
}

export interface Ligne {
  /** BT-126 */
  id: string
  /** BT-153 */
  designation: string
  /** BT-154 */
  description: string | null
  /** BT-129 en millièmes */
  quantite: number
  /** BT-130 : code UN/ECE recommandation 20 */
  unite: string
  /** BT-146 : prix unitaire net, en centimes */
  prixUnitaire: number
  /** BG-27 : remises de ligne */
  remise: Remise | null
  /** BT-131 */
  montantNet: number
  /** BT-151 / BT-152 (points de base) */
  categorie: CategorieTva
  taux: number
}

export interface GroupeTva {
  categorie: CategorieTva
  /** Points de base */
  taux: number
  /** BT-116 */
  base: number
  /** BT-117 */
  montant: number
  /** BT-120 */
  motif: string | null
  /** BT-121 : code VATEX */
  codeMotif: string | null
}

/**
 * BT-23 : cadre de facturation (réforme française). B biens, S services, M mixte ;
 * 1 dépôt d'une facture, 2 facture déjà payée, 4 facture définitive après acompte.
 */
export type Cadre = `${'B' | 'S' | 'M'}${1 | 2 | 4}`

export interface Facture {
  /** BT-1 */
  numero: string
  /** BT-23 */
  cadre: Cadre
  /** BT-3 */
  type: CodeType
  /** BT-2 (AAAA-MM-JJ) */
  dateEmission: string
  /** BT-9 */
  dateEcheance: string | null
  /** BT-5 */
  devise: string
  /** BT-10 : référence acheteur (code service Chorus Pro) */
  referenceAcheteur: string | null
  /** BT-13 */
  commande: string | null
  /** BT-22 */
  notes: Note[]
  /** BG-3 : facture précédente (avoir) */
  facturePrecedente: { numero: string; date: string } | null
  vendeur: Partie
  acheteur: Partie
  /** BT-72 */
  dateLivraison: string | null
  /** BG-14 */
  periode: { debut: string; fin: string } | null
  /** BT-80 : pays de livraison (livraisons intracommunautaires) */
  paysLivraison: string | null
  paiement: {
    /** UNTDID 4461 : 30 virement, 58 virement SEPA */
    moyen: '30' | '58'
    iban: string | null
    bic: string | null
    /** BT-83 */
    reference: string | null
    /** BT-20 */
    conditions: string | null
  }
  lignes: Ligne[]
  /** BG-20 : remises au niveau du document (remise globale, acomptes déduits), par catégorie */
  remises: Remise[]
  ventilation: GroupeTva[]
  totaux: {
    /** BT-106 */
    lignes: number
    /** BT-107 */
    remises: number
    /** BT-109 */
    ht: number
    /** BT-110 */
    tva: number
    /** BT-112 */
    ttc: number
    /** BT-113 */
    dejaPaye: number
    /** BT-115 */
    net: number
  }
}

/** Codes VATEX (BT-121) par catégorie. */
export const CODES_EXONERATION: Partial<Record<CategorieTva, string>> = {
  AE: 'VATEX-EU-AE',
  K: 'VATEX-EU-IC',
  G: 'VATEX-EU-G',
  O: 'VATEX-EU-O',
}

/** Unités françaises → codes UN/ECE recommandation 20. */
export const UNITES: Record<string, string> = {
  unité: 'C62',
  pièce: 'H87',
  heure: 'HUR',
  jour: 'DAY',
  'demi-journée': 'C62',
  forfait: 'LS',
  mois: 'MON',
  an: 'ANN',
  'm²': 'MTK',
  'm³': 'MTQ',
  ml: 'MTR',
  kg: 'KGM',
  litre: 'LTR',
  km: 'KMT',
  lot: 'LO',
}

export function codeUnite(unite: string): string {
  return UNITES[unite.trim().toLowerCase()] ?? 'C62'
}

/** 12345 → « 123.45 » ; -5 → « -0.05 ». */
export function montant(centimes: number): string {
  const signe = centimes < 0 ? '-' : ''
  const abs = Math.abs(centimes)
  return `${signe}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

/** Millièmes → décimal sans zéros inutiles : 1500 → « 1.5 ». */
export function quantite(milli: number): string {
  const signe = milli < 0 ? '-' : ''
  const abs = Math.abs(milli)
  const dec = String(abs % 1000).padStart(3, '0').replace(/0+$/, '')
  return `${signe}${Math.trunc(abs / 1000)}${dec ? `.${dec}` : ''}`
}

/** Points de base → pourcentage : 2000 → « 20 », 550 → « 5.5 ». */
export function pourcentage(points: number): string {
  const dec = String(points % 100).padStart(2, '0').replace(/0+$/, '')
  return `${Math.trunc(points / 100)}${dec ? `.${dec}` : ''}`
}

export function echapper(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // Caractères interdits en XML 1.0
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
}

export function dateCompacte(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, '')
}
