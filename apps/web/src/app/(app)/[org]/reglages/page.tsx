import type { Metadata } from 'next'
import { FormulaireIdentite } from '@/components/organisation/FormulaireIdentite'
import { Message } from '@/components/ui/Message'
import { peutModifierOrganisation } from '@/lib/roles'
import { chargerContexte } from '@/lib/session'

export const metadata: Metadata = { title: 'Réglages' }

export default async function Reglages({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>
  searchParams: Promise<{ bienvenue?: string }>
}) {
  const { org } = await params
  const { bienvenue } = await searchParams
  const { organisation, role } = await chargerContexte(org)

  return (
    <>
      {bienvenue && (
        <Message ton="succes">
          {organisation.name} est créée. Complétez son identité : ces informations figureront sur chacune de vos factures.
        </Message>
      )}
      <FormulaireIdentite organisation={organisation} modifiable={peutModifierOrganisation(role)} />
    </>
  )
}
