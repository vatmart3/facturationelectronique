import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { FormulaireClient } from '@/components/clients/FormulaireClient'
import { EnTeteVue } from '@/components/ui/EnTeteVue'
import { chargerContexte } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Modifier le client' }

export default async function ModifierClient({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { org, id } = await params
  const { organisation } = await chargerContexte(org)
  const supabase = await creerClientServeur()
  const { data: client } = await supabase.from('clients').select('*').eq('id', id).eq('organization_id', organisation.id).maybeSingle()
  if (!client) notFound()
  return (
    <>
      <EnTeteVue titre={`Modifier ${client.name}`} description="Les factures déjà émises ne sont pas modifiées : elles gardent les informations du jour de leur émission." />
      <FormulaireClient slug={org} client={client} />
    </>
  )
}
