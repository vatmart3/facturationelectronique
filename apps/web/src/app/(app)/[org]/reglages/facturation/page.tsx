import type { Metadata } from 'next'
import { FormulaireFacturation } from '@/components/organisation/FormulaireFacturation'
import { peutModifierOrganisation } from '@/lib/roles'
import { chargerContexte } from '@/lib/session'

export const metadata: Metadata = { title: 'Facturation' }

export default async function ReglagesFacturation({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params
  const { organisation, role } = await chargerContexte(org)
  return <FormulaireFacturation organisation={organisation} modifiable={peutModifierOrganisation(role)} />
}
