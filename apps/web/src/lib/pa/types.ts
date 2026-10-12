/** Contrat d'une plateforme agréée (PA) : chaque connecteur l'implémente. */

export type FormatFlux = 'factur-x' | 'cii' | 'ubl'

export interface Depot {
  numero: string
  format: FormatFlux
  /** Fichier transmis : PDF Factur-X, ou XML. */
  fichier: Uint8Array
  nomFichier: string
  sirenVendeur: string
  /** Adresse électronique du destinataire (BT-49). */
  destinataire: { valeur: string; schema: string } | null
}

export interface FluxRecu {
  fluxId: string
  format: FormatFlux
  fichier: Uint8Array
}

export interface Plateforme {
  readonly code: 'simulee' | 'afnor'
  readonly nom: string
  /** Dépose une facture émise ; renvoie l'identifiant du flux et son premier statut. */
  transmettre(depot: Depot): Promise<{ fluxId: string; statut: number }>
  /** Statut courant d'un flux émis. */
  consulter(fluxId: string, statutConnu: number): Promise<{ statut: number; motif?: string | null }>
  /** Factures reçues depuis une date. */
  recevoir(depuis: string | null): Promise<FluxRecu[]>
  /** Renvoie à l'émetteur le statut d'une facture reçue (approuvée, refusée…). */
  repondre(fluxId: string, statut: number, motif: string | null): Promise<void>
  /** Dépose un lot d'e-reporting. */
  deposerEreporting(lot: { type: 'transactions' | 'paiements'; debut: string; fin: string; contenu: unknown }): Promise<{ fluxId: string }>
  /** Recherche dans l'annuaire des destinataires. */
  annuaire(siren: string): Promise<{ adresse: string; schema: string; plateforme: string } | null>
}

export class ErreurPlateforme extends Error {}
