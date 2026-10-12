import { Editeur } from '@/components/documents/Editeur'
import { ApercuLecture } from '@/components/documents/ApercuLecture'
import type { TypeDocument } from '@/lib/document'
import { chargerDocument, chargerReferentiels, nouveauDocument } from '@/lib/documents-serveur'
import { peutFacturer } from '@/lib/roles'
import { chargerContexte } from '@/lib/session'

/** Éditeur d'un nouveau document, ou d'un brouillon existant ; lecture seule une fois émis. */
export async function PageEditeur({ org, type, id, clientId }: { org: string; type: TypeDocument; id?: string; clientId?: string }) {
  const { role } = await chargerContexte(org)
  const donnees = await chargerReferentiels(org)
  if (!id) {
    return <Editeur slug={org} initial={nouveauDocument(type, donnees, clientId)} id={null} donnees={donnees} lecture={!peutFacturer(role)} />
  }
  const types: TypeDocument[] = type === 'devis' ? ['devis'] : type === 'avoir' ? ['avoir'] : ['facture', 'acompte']
  const { ligne, edition } = await chargerDocument(org, id, types)
  if (ligne.status !== 'brouillon') return <ApercuLecture org={org} document={ligne} edition={edition} donnees={donnees} role={role} />
  return <Editeur slug={org} initial={edition} id={id} donnees={donnees} lecture={!peutFacturer(role)} />
}
