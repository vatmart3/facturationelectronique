import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { EnTeteVue } from '@/components/ui/EnTeteVue'
import { EtatVide } from '@/components/ui/EtatVide'
import { trouverEntree } from '@/lib/navigation'

type Params = Promise<{ org: string; section: string[] }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { section } = await params
  return { title: trouverEntree(section.join('/'))?.entree.libelle ?? 'Introuvable' }
}

/** Catégories pas encore construites : chaque vue réelle viendra la remplacer par une route dédiée. */
export default async function SectionAVenir({ params }: { params: Params }) {
  const { section } = await params
  const chemin = section.join('/')
  const trouvee = trouverEntree(chemin)
  if (!trouvee || trouvee.entree.chemin !== chemin) notFound()
  const { groupe, entree } = trouvee

  return (
    <>
      <EnTeteVue titre={entree.libelle} description={groupe} />
      <EtatVide titre={`Disponible en phase ${entree.phase}`}>
        <p>{entree.description}</p>
      </EtatVide>
    </>
  )
}
