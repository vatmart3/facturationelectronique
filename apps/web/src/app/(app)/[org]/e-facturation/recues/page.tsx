import type { Metadata } from 'next'
import Link from 'next/link'
import { relever, simulerReception } from '@/app/actions/plateforme'
import { FormulaireSuivi } from '@/components/documents/Suivi'
import { StatutPa } from '@/components/plateforme/StatutPa'
import { EnTeteVue } from '@/components/ui/EnTeteVue'
import { EtatVide } from '@/components/ui/EtatVide'
import { Segments } from '@/components/ui/Segments'
import { Tableau, Td, Th } from '@/components/ui/Tableau'
import { formatDate, formatMontant } from '@/lib/format'
import { peutFacturer } from '@/lib/roles'
import { chargerContexte } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Factures reçues' }

const FILTRES = [
  { id: 'a_traiter', libelle: 'À traiter' },
  { id: 'approuvee', libelle: 'Approuvées' },
  { id: 'litige', libelle: 'En litige' },
  { id: 'refusee', libelle: 'Refusées' },
  { id: 'payee', libelle: 'Payées' },
] as const

export default async function FacturesRecues({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ statut?: string }> }) {
  const { org } = await params
  const { statut } = await searchParams
  const { organisation, role } = await chargerContexte(org)
  const supabase = await creerClientServeur()
  const { data } = await supabase
    .from('received_invoices')
    .select('id, number, issue_date, due_date, seller_name, seller_siren, total_ttc, currency, status, status_code, type_code')
    .eq('organization_id', organisation.id)
    .order('received_at', { ascending: false })
    .limit(500)
  const toutes = data ?? []
  const visibles = statut ? toutes.filter((f) => f.status === statut) : toutes
  const editable = peutFacturer(role)

  return (
    <>
      <EnTeteVue
        titre="Factures reçues"
        description={`Factures de vos fournisseurs, reçues via ${organisation.pa_provider === 'simulee' ? 'la plateforme simulée' : 'votre plateforme agréée'}.`}
        actions={
          editable && (
            <div className="flex flex-wrap gap-2">
              {organisation.pa_provider === 'simulee' && <FormulaireSuivi action={simulerReception.bind(null, org)} bouton="Simuler une réception" variante="secondaire" />}
              <FormulaireSuivi action={relever.bind(null, org)} bouton="Relever" />
            </div>
          )
        }
      />
      <Segments
        libelle="Filtrer les factures reçues"
        segments={[
          { href: `/${org}/e-facturation/recues`, libelle: 'Toutes', compte: toutes.length, actif: !statut },
          ...FILTRES.map((f) => ({ href: `/${org}/e-facturation/recues?statut=${f.id}`, libelle: f.libelle, compte: toutes.filter((x) => x.status === f.id).length, actif: statut === f.id })),
        ]}
      />
      {visibles.length === 0 ? (
        <EtatVide titre={toutes.length ? 'Aucune facture dans ce filtre' : 'Aucune facture reçue'}>
          <p>Depuis le 1er septembre 2026, vos fournisseurs vous adressent leurs factures électroniques via votre plateforme agréée. Elles arrivent ici.</p>
        </EtatVide>
      ) : (
        <Tableau legende="Factures reçues">
          <thead>
            <tr>
              <Th>Fournisseur</Th>
              <Th>Numéro</Th>
              <Th>Date</Th>
              <Th>Échéance</Th>
              <Th numerique>Montant TTC</Th>
              <Th>Statut</Th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((f) => (
              <tr key={f.id} className="hover:bg-survol">
                <Td>
                  <Link href={`/${org}/e-facturation/recues/${f.id}`} className="flex flex-col leading-tight">
                    <span className="font-semibold">{f.seller_name}</span>
                    {f.seller_siren && <span className="num text-[12px] text-encre-3">SIREN {f.seller_siren}</span>}
                  </Link>
                </Td>
                <Td className="num">
                  {f.number}
                  {f.type_code === '381' && <span className="ml-1 text-[12px] text-avoir">avoir</span>}
                </Td>
                <Td className="num text-encre-3">{formatDate(f.issue_date)}</Td>
                <Td className="num text-encre-3">{f.due_date ? formatDate(f.due_date) : '—'}</Td>
                <Td numerique className="font-semibold">
                  {formatMontant(Number(f.total_ttc), f.currency)}
                </Td>
                <Td>
                  <StatutPa code={f.status_code} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Tableau>
      )}
    </>
  )
}
