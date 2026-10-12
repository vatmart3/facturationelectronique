import type { Metadata } from 'next'
import { formatTaux } from '@pastille/moteur'
import { declarer } from '@/app/actions/plateforme'
import { FormulaireSuivi } from '@/components/documents/Suivi'
import { EnTeteVue } from '@/components/ui/EnTeteVue'
import { EtatVide } from '@/components/ui/EtatVide'
import { Panneau, PanneauCorps, PanneauTete } from '@/components/ui/Panneau'
import { Segments } from '@/components/ui/Segments'
import { Tableau, Td, Th } from '@/components/ui/Tableau'
import { aujourdHui } from '@/lib/document'
import { periodeDe, periodePrecedente } from '@/lib/ereporting'
import { formatDate, formatMontant } from '@/lib/format'
import { donneesEreporting } from '@/lib/plateforme-serveur'
import { peutFacturer } from '@/lib/roles'
import { chargerContexte } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'E-reporting' }

const FREQUENCES = { decade: 'par décade', mois: 'mensuel', bimestre: 'bimestriel' }

export default async function Ereporting({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ jour?: string }> }) {
  const { org } = await params
  const { jour: demande } = await searchParams
  const { organisation, role } = await chargerContexte(org)
  const supabase = await creerClientServeur()
  const aujourdhui = aujourdHui()
  const frequence = organisation.ereporting_frequency
  const periodes = [periodeDe(frequence, aujourdhui)]
  for (let i = 0; i < 5; i++) periodes.push(periodePrecedente(frequence, periodes.at(-1)!.debut))
  const periode = periodes.find((p) => p.debut === demande) ?? periodes[1]!
  const [{ transactions, encaissements }, { data: deposes }] = await Promise.all([
    donneesEreporting(supabase, organisation, periode),
    supabase.from('ereporting_reports').select('*').eq('organization_id', organisation.id).order('sent_at', { ascending: false }).limit(30),
  ])
  const terminee = periode.fin < aujourdhui
  const depose = (type: string) => (deposes ?? []).find((d) => d.kind === type && d.period_start === periode.debut)
  const editable = peutFacturer(role)

  return (
    <>
      <EnTeteVue
        titre="E-reporting"
        description={`Ventes aux particuliers, opérations internationales et encaissements de services, déclarés via la plateforme (${FREQUENCES[frequence]}).`}
      />
      <Segments libelle="Période" segments={periodes.map((p) => ({ href: `/${org}/e-facturation/e-reporting?jour=${p.debut}`, libelle: p.libelle, actif: p.debut === periode.debut }))} />
      <div className="grid gap-[18px] lg:grid-cols-2">
        <Panneau>
          <PanneauTete
            titre="Transactions"
            description={`${transactions.totaux.documents} document(s) · ${formatMontant(transactions.totaux.base)} HT · ${formatMontant(transactions.totaux.tva)} de TVA`}
          />
          <PanneauCorps>
            {depose('transactions') ? (
              <p className="text-[13px] text-ok">Déposé le {formatDate(depose('transactions')!.sent_at)}.</p>
            ) : editable && terminee ? (
              <FormulaireSuivi action={declarer.bind(null, org, 'transactions', periode.debut)} bouton="Déposer les transactions" variante="secondaire" />
            ) : (
              <p className="text-[13px] text-encre-3">{terminee ? 'À déposer.' : 'Période en cours : le dépôt se fera à sa clôture.'}</p>
            )}
          </PanneauCorps>
        </Panneau>
        <Panneau>
          <PanneauTete
            titre="Paiements"
            description={organisation.vat_on_debits ? 'TVA sur les débits : aucun encaissement à déclarer.' : `${formatMontant(encaissements.reduce((s, p) => s + p.montant, 0))} encaissés sur des prestations de services`}
          />
          <PanneauCorps>
            {depose('paiements') ? (
              <p className="text-[13px] text-ok">Déposé le {formatDate(depose('paiements')!.sent_at)}.</p>
            ) : editable && terminee && !organisation.vat_on_debits ? (
              <FormulaireSuivi action={declarer.bind(null, org, 'paiements', periode.debut)} bouton="Déposer les paiements" variante="secondaire" />
            ) : (
              <p className="text-[13px] text-encre-3">{terminee ? 'Rien à déposer.' : 'Période en cours.'}</p>
            )}
          </PanneauCorps>
        </Panneau>
      </div>

      <h2 className="text-[16px] font-semibold">Ventes aux particuliers</h2>
      {transactions.particuliers.length === 0 ? (
        <EtatVide titre="Aucune vente aux particuliers sur la période" />
      ) : (
        <Tableau legende="Ventes aux particuliers, agrégées par jour">
          <thead>
            <tr>
              <Th>Jour</Th>
              <Th>Opération</Th>
              <Th>Taux</Th>
              <Th numerique>Documents</Th>
              <Th numerique>Base HT</Th>
              <Th numerique>TVA</Th>
            </tr>
          </thead>
          <tbody>
            {transactions.particuliers.map((g, i) => (
              <tr key={i}>
                <Td className="num">{formatDate(g.date)}</Td>
                <Td className="text-encre-2">{g.operation === 'biens' ? 'Livraison de biens' : g.operation === 'mixte' ? 'Mixte' : 'Prestation de services'}</Td>
                <Td>{g.categorie === 'S' ? formatTaux(g.taux) : g.categorie}</Td>
                <Td numerique>{g.nombre || ''}</Td>
                <Td numerique>{formatMontant(g.base)}</Td>
                <Td numerique>{formatMontant(g.tva)}</Td>
              </tr>
            ))}
          </tbody>
        </Tableau>
      )}
      {transactions.international.length > 0 && (
        <>
          <h2 className="text-[16px] font-semibold">Opérations internationales</h2>
          <Tableau legende="Opérations internationales">
            <thead>
              <tr>
                <Th>Facture</Th>
                <Th>Date</Th>
                <Th>Client</Th>
                <Th>Pays</Th>
                <Th numerique>Base HT</Th>
              </tr>
            </thead>
            <tbody>
              {transactions.international.map((x) => (
                <tr key={x.numero}>
                  <Td className="num">{x.numero}</Td>
                  <Td className="num">{formatDate(x.date)}</Td>
                  <Td>{x.client}</Td>
                  <Td>{x.pays}</Td>
                  <Td numerique>{formatMontant(x.base)}</Td>
                </tr>
              ))}
            </tbody>
          </Tableau>
        </>
      )}
    </>
  )
}
