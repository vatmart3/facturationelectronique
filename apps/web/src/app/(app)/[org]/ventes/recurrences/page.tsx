import type { Metadata } from 'next'
import Link from 'next/link'
import { basculerRecurrence, genererMaintenant, supprimerRecurrence } from '@/app/actions/suivi'
import { BoutonAction } from '@/components/documents/Actions'
import { FormulaireSuivi } from '@/components/documents/Suivi'
import { EnTeteVue } from '@/components/ui/EnTeteVue'
import { EtatVide } from '@/components/ui/EtatVide'
import { Statut } from '@/components/ui/Statut'
import { Tableau, Td, Th } from '@/components/ui/Tableau'
import { calculer, type DocumentEdition } from '@/lib/document'
import { formatDate, formatMontant } from '@/lib/format'
import { peutFacturer } from '@/lib/roles'
import { chargerContexte } from '@/lib/session'
import { FREQUENCES } from '@/lib/suivi'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Récurrences' }

export default async function Recurrences({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params
  const { organisation, role } = await chargerContexte(org)
  const supabase = await creerClientServeur()
  const { data } = await supabase.from('recurring_invoices').select('*, clients(name)').eq('organization_id', organisation.id).order('next_date')
  const recurrences = data ?? []
  const editable = peutFacturer(role)

  return (
    <>
      <EnTeteVue
        titre="Récurrences"
        description="Abonnements, maintenance, loyers : la facture se prépare ou s’émet toute seule à chaque échéance."
        actions={editable && recurrences.length > 0 && <FormulaireSuivi action={genererMaintenant.bind(null, org)} bouton="Générer les échéances du jour" variante="secondaire" />}
      />
      {recurrences.length === 0 ? (
        <EtatVide titre="Aucune facture récurrente">
          <p>
            Ouvrez une facture émise et choisissez « Rendre récurrente ». Ses lignes servent de modèle ; écrivez {'{periode}'} dans une désignation
            pour y voir le mois ou le trimestre facturé.
          </p>
          <p className="mt-2">
            <Link href={`/${org}/ventes/factures`} className="text-accent hover:underline">
              Voir les factures
            </Link>
          </p>
        </EtatVide>
      ) : (
        <Tableau legende="Factures récurrentes">
          <thead>
            <tr>
              <Th>Récurrence</Th>
              <Th>Fréquence</Th>
              <Th>Prochaine</Th>
              <Th>À l’échéance</Th>
              <Th numerique>Montant TTC</Th>
              <Th>État</Th>
              {editable && <Th>Actions</Th>}
            </tr>
          </thead>
          <tbody>
            {recurrences.map((r) => {
              const modele = r.template as DocumentEdition
              const calcul = Array.isArray(modele?.lignes) ? calculer(modele) : null
              return (
                <tr key={r.id}>
                  <Td>
                    <span className="flex flex-col leading-tight">
                      <span className="font-semibold">{r.name}</span>
                      <span className="text-[12px] text-encre-3">{r.clients?.name}</span>
                    </span>
                  </Td>
                  <Td className="text-encre-2">{FREQUENCES.find((f) => f.valeur === r.frequency)?.libelle}</Td>
                  <Td className="num">
                    {formatDate(r.next_date)}
                    {r.end_date && <span className="block text-[11.5px] text-encre-3">jusqu’au {formatDate(r.end_date)}</span>}
                  </Td>
                  <Td className="text-encre-2">{r.mode === 'emission' ? 'Émise et envoyée' : 'Brouillon à valider'}</Td>
                  <Td numerique>{calcul?.ok ? formatMontant(calcul.totaux.netAPayer, modele.currency) : '—'}</Td>
                  <Td>
                    <Statut statut={r.active ? 'payee' : 'annulee'} libelle={r.active ? 'Active' : 'En pause'} />
                  </Td>
                  {editable && (
                    <Td>
                      <div className="flex gap-1">
                        <BoutonAction action={basculerRecurrence.bind(null, org, r.id, !r.active)} variante="fantome">
                          {r.active ? 'Suspendre' : 'Reprendre'}
                        </BoutonAction>
                        <BoutonAction action={supprimerRecurrence.bind(null, org, r.id)} variante="fantome" confirmation="Supprimer cette récurrence ? Les factures déjà créées sont conservées.">
                          Supprimer
                        </BoutonAction>
                      </div>
                    </Td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </Tableau>
      )}
    </>
  )
}
