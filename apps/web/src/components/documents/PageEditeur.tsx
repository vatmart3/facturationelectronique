import { notFound } from 'next/navigation'
import { ApercuLecture } from '@/components/documents/ApercuLecture'
import { Editeur } from '@/components/documents/Editeur'
import { LIBELLES_TYPE, type TypeDocument } from '@/lib/document'
import { chargerDocument, chargerImprimable, chargerReferentiels, nouveauDocument } from '@/lib/documents-serveur'
import { peutFacturer } from '@/lib/roles'
import { chargerContexte } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

const CHEMINS = { facture: 'factures', acompte: 'factures', devis: 'devis', avoir: 'avoirs' } as const

/** Éditeur d'un nouveau document, ou d'un brouillon existant ; consultation une fois émis. */
export async function PageEditeur({ org, type, id, clientId }: { org: string; type: TypeDocument; id?: string; clientId?: string }) {
  const { role } = await chargerContexte(org)
  const lecture = !peutFacturer(role)
  const donnees = await chargerReferentiels(org)
  if (!id) {
    return <Editeur slug={org} initial={nouveauDocument(type, donnees, clientId)} id={null} donnees={donnees} lecture={lecture} />
  }
  const types: TypeDocument[] = type === 'devis' ? ['devis'] : type === 'avoir' ? ['avoir'] : ['facture', 'acompte']
  const { ligne, edition } = await chargerDocument(org, id, types)
  if (ligne.status !== 'brouillon') {
    const r = await chargerImprimable(org, id)
    if (!r) notFound()
    return <ApercuLecture org={org} document={ligne} imprimable={r.imprimable} role={role} />
  }
  let origine = null
  if (ligne.origin_document_id) {
    const supabase = await creerClientServeur()
    const { data } = await supabase.from('documents').select('id, type, number').eq('id', ligne.origin_document_id).maybeSingle()
    if (data) origine = { libelle: `${LIBELLES_TYPE[data.type].singulier} ${data.number ?? ''}`.trim(), href: `/${org}/ventes/${CHEMINS[data.type]}/${data.id}` }
  }
  return <Editeur slug={org} initial={edition} id={id} donnees={donnees} lecture={lecture} origine={origine} />
}
