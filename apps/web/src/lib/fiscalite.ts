/**
 * Résolution du régime de TVA d'une ligne : qui l'emporte entre l'entreprise,
 * le client et l'article. Les mentions renvoyées sont les textes par défaut ;
 * la table legal_mentions (phase 4) permet de les ajuster sans redéployer.
 */

import type { CategorieTva } from '@pastille/moteur'

export type TypeClient = 'b2b' | 'b2c' | 'b2g' | 'ue' | 'hors_ue'
export type NatureArticle = 'bien' | 'service' | 'debours'
export type RegimeEntreprise = 'franchise' | 'reel_simplifie' | 'reel_normal' | 'non_assujetti' | null

export const MENTIONS = {
  franchise: 'TVA non applicable, art. 293 B du CGI',
  nonAssujetti: 'Opération non soumise à la TVA',
  livraisonIntracom: 'Exonération de TVA, art. 262 ter I du CGI',
  autoliquidationUe: 'Autoliquidation, art. 283-2 du CGI et art. 196 de la directive 2006/112/CE',
  export: 'Exonération de TVA, art. 262 I du CGI',
  servicesHorsUe: 'TVA non applicable, art. 259-1 du CGI',
  autoliquidationBtp: 'Autoliquidation, art. 283-2 nonies du CGI',
  debours: 'Débours, hors champ de la TVA',
} as const

export interface TvaResolue {
  categorie: CategorieTva
  taux: number
  motif?: string
}

export interface ContexteTva {
  regimeEntreprise: RegimeEntreprise
  client?: {
    kind: TypeClient
    defaultVatCategory?: CategorieTva | null
    defaultVatRate?: number | null
    exemptionReason?: string | null
  } | null
  article: {
    nature: NatureArticle
    categorie: CategorieTva
    taux: number
  }
}

export function resoudreTva({ regimeEntreprise, client, article }: ContexteTva): TvaResolue {
  if (article.nature === 'debours') return { categorie: 'O', taux: 0, motif: MENTIONS.debours }
  if (regimeEntreprise === 'franchise') return { categorie: 'E', taux: 0, motif: MENTIONS.franchise }
  if (regimeEntreprise === 'non_assujetti') return { categorie: 'O', taux: 0, motif: MENTIONS.nonAssujetti }

  if (client?.defaultVatCategory) {
    const categorie = client.defaultVatCategory
    if (categorie === 'S') return { categorie, taux: client.defaultVatRate || article.taux || 2000 }
    return { categorie, taux: 0, motif: client.exemptionReason ?? undefined }
  }

  if (client?.kind === 'ue') {
    return article.nature === 'bien'
      ? { categorie: 'K', taux: 0, motif: MENTIONS.livraisonIntracom }
      : { categorie: 'AE', taux: 0, motif: MENTIONS.autoliquidationUe }
  }
  if (client?.kind === 'hors_ue') {
    return article.nature === 'bien'
      ? { categorie: 'G', taux: 0, motif: MENTIONS.export }
      : { categorie: 'O', taux: 0, motif: MENTIONS.servicesHorsUe }
  }

  if (article.categorie !== 'S') return { categorie: article.categorie, taux: 0 }
  return { categorie: 'S', taux: client?.defaultVatRate || article.taux }
}

/** Canal de transmission selon le type de client (réforme 2026-2027). */
export function canalTransmission(kind: TypeClient): string {
  switch (kind) {
    case 'b2b':
      return 'Facture électronique via la plateforme agréée'
    case 'b2g':
      return 'Dépôt sur Chorus Pro'
    case 'b2c':
      return 'E-reporting des transactions'
    default:
      return 'E-reporting international'
  }
}
