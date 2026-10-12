import type { Metadata } from 'next'
import { FormulaireProduit } from '@/components/catalogue/FormulaireProduit'
import { EnTeteVue } from '@/components/ui/EnTeteVue'
import { chargerContexte } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Nouvel article' }

export default async function NouvelArticle({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params
  const { organisation } = await chargerContexte(org)
  const supabase = await creerClientServeur()
  const { data } = await supabase.from('products').select('category').eq('organization_id', organisation.id)
  const categories = [...new Set((data ?? []).map((p) => p.category).filter((c): c is string => Boolean(c)))]
  return (
    <>
      <EnTeteVue titre="Nouvel article" />
      <FormulaireProduit slug={org} categories={categories} />
    </>
  )
}
