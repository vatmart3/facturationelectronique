import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { FormulaireProduit } from '@/components/catalogue/FormulaireProduit'
import { EnTeteVue } from '@/components/ui/EnTeteVue'
import { chargerContexte } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Article' }

export default async function Article({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { org, id } = await params
  const { organisation } = await chargerContexte(org)
  const supabase = await creerClientServeur()
  const [{ data: produit }, { data: tous }] = await Promise.all([
    supabase.from('products').select('*').eq('id', id).eq('organization_id', organisation.id).maybeSingle(),
    supabase.from('products').select('category').eq('organization_id', organisation.id),
  ])
  if (!produit) notFound()
  const categories = [...new Set((tous ?? []).map((p) => p.category).filter((c): c is string => Boolean(c)))]
  return (
    <>
      <EnTeteVue titre={produit.name} description="Les factures déjà émises gardent le prix et la TVA du jour de leur émission." />
      <FormulaireProduit slug={org} produit={produit} categories={categories} />
    </>
  )
}
