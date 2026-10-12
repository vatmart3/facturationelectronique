import { randomUUID } from 'node:crypto'
import { suivantSimule } from './cycle'
import type { FluxRecu, Plateforme } from './types'

/**
 * Plateforme simulée : pour essayer la transmission, le cycle de vie et l'e-reporting
 * sans contrat avec une plateforme agréée. Rien ne quitte l'application.
 * Chaque consultation fait avancer le flux d'une étape, jusqu'à l'approbation.
 */
export function plateformeSimulee(fournisseur?: () => Promise<FluxRecu[]>): Plateforme {
  return {
    code: 'simulee',
    nom: 'Plateforme simulée',
    async transmettre(depot) {
      if (depot.fichier.length === 0) throw new Error('Fichier vide')
      return { fluxId: `SIM-${randomUUID()}`, statut: 200 }
    },
    async consulter(_fluxId, statutConnu) {
      return { statut: suivantSimule(statutConnu) ?? statutConnu }
    },
    async recevoir() {
      return fournisseur ? fournisseur() : []
    },
    async repondre() {},
    async deposerEreporting() {
      return { fluxId: `SIM-ER-${randomUUID()}` }
    },
    async annuaire(siren) {
      return /^\d{9}$/.test(siren) ? { adresse: siren, schema: '0225', plateforme: 'Plateforme simulée' } : null
    },
  }
}
