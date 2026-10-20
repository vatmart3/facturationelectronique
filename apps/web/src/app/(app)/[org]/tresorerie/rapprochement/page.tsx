import type { Metadata } from 'next'
import { Rapprochement } from '@/components/tresorerie/Rapprochement'
import { EnTeteVue } from '@/components/ui/EnTeteVue'
import { Message } from '@/components/ui/Message'
import { ajouterJours, aujourdHui } from '@/lib/document'
import { cleDoublon } from '@/lib/rapprochement'
import { peutFacturer } from '@/lib/roles'
import { chargerContexte } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Rapprochement bancaire' }

export default async function PageRapprochement({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params
  const { organisation, role } = await chargerContexte(org)
  const supabase = await creerClientServeur()
  const [{ data: ouvertes }, { data: importes }] = await Promise.all([
    supabase
      .from('documents')
      .select('id, number, amount_due, amount_paid, due_date, clients(name)')
      .eq('organization_id', organisation.id)
      .in('type', ['facture', 'acompte'])
      .in('status', ['emis', 'envoye', 'partiellement_paye'])
      .order('due_date'),
    supabase
      .from('payments')
      .select('paid_on, amount_cents, reference')
      .eq('organization_id', organisation.id)
      .like('reference', 'Relevé : %')
      .gte('paid_on', ajouterJours(aujourdHui(), -400)),
  ])
  const factures = (ouvertes ?? [])
    .map((d) => ({ id: d.id, numero: d.number ?? '', client: d.clients?.name ?? null, reste: Number(d.amount_due) - Number(d.amount_paid), echeance: d.due_date }))
    .filter((f) => f.reste > 0)

  return (
    <>
      <EnTeteVue
        titre="Rapprochement bancaire"
        description="Importez le relevé CSV de votre banque : chaque virement reçu est associé à la facture qu’il règle."
        icone="banque"
      />
      {peutFacturer(role) ? (
        <Rapprochement slug={org} factures={factures} dejaImportes={(importes ?? []).map((p) => cleDoublon(p.paid_on, Number(p.amount_cents), p.reference ?? ''))} />
      ) : (
        <Message ton="info">Le rapprochement est réservé aux membres qui peuvent enregistrer des paiements.</Message>
      )}
    </>
  )
}
