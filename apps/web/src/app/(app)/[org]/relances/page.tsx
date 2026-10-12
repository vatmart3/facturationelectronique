import type { Metadata } from 'next'
import Link from 'next/link'
import { enregistrerReglagesRelances, lancerRelances } from '@/app/actions/suivi'
import { ChampSuivi, FormulaireSuivi } from '@/components/documents/Suivi'
import { EnTeteVue } from '@/components/ui/EnTeteVue'
import { EtatVide } from '@/components/ui/EtatVide'
import { Message } from '@/components/ui/Message'
import { Panneau, PanneauCorps, PanneauTete } from '@/components/ui/Panneau'
import { Tableau, Td, Th } from '@/components/ui/Tableau'
import { aujourdHui } from '@/lib/document'
import { emailConfigure } from '@/lib/email'
import { formatDate, formatMontant } from '@/lib/format'
import { peutFacturer, peutModifierOrganisation } from '@/lib/roles'
import { chargerContexte } from '@/lib/session'
import { libelleEtape, relancesDues } from '@/lib/suivi'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Relances' }

const CHAMP = 'h-[34px] w-full rounded-m border border-trait-fort bg-surface px-2.5 text-[13.5px] font-normal text-encre outline-none focus:border-accent'

export default async function Relances({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params
  const { organisation, role } = await chargerContexte(org)
  const supabase = await creerClientServeur()
  const jour = aujourdHui()
  const [{ data: factures }, { data: historique }] = await Promise.all([
    supabase
      .from('documents')
      .select('id, number, due_date, status, amount_due, amount_paid, currency, clients(name, reminders_enabled)')
      .eq('organization_id', organisation.id)
      .in('type', ['facture', 'acompte'])
      .in('status', ['emis', 'envoye', 'partiellement_paye']),
    supabase.from('reminders').select('*, documents(number)').eq('organization_id', organisation.id).order('sent_at', { ascending: false }).limit(50),
  ])
  const deja = new Map<string, Set<number>>()
  for (const r of historique ?? []) if (r.step !== null && r.status !== 'echec') (deja.get(r.document_id) ?? deja.set(r.document_id, new Set()).get(r.document_id)!).add(r.step)
  const dues = organisation.reminders_enabled
    ? relancesDues(
        (factures ?? []).map((f) => ({ id: f.id, due_date: f.due_date, status: f.status, relancesClient: f.clients?.reminders_enabled ?? true })),
        organisation.reminder_days,
        deja,
        jour,
      )
    : []
  const parId = new Map((factures ?? []).map((f) => [f.id, f]))

  return (
    <>
      <EnTeteVue
        titre="Relances"
        description="Un scénario de rappels envoyés automatiquement chaque matin, avec la facture en pièce jointe et un lien de paiement."
        actions={peutFacturer(role) && <FormulaireSuivi action={lancerRelances.bind(null, org)} bouton="Envoyer les relances du jour" variante="secondaire" />}
      />
      {!emailConfigure() && (
        <Message ton="info">
          La messagerie n’est pas encore configurée : les envois sont simulés et journalisés. Ajoutez RESEND_API_KEY et EMAIL_EXPEDITEUR dans les variables
          d’environnement pour envoyer réellement.
        </Message>
      )}
      <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panneau>
          <PanneauTete titre="À envoyer aujourd’hui" description={`${dues.length} relance${dues.length > 1 ? 's' : ''} prévue${dues.length > 1 ? 's' : ''}`} />
          {dues.length === 0 ? (
            <PanneauCorps>
              <p className="text-[13.5px] text-encre-3">Rien à relancer aujourd’hui.</p>
            </PanneauCorps>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {dues.map((d) => {
                const f = parId.get(d.id)!
                return (
                  <li key={d.id} className="border-b border-trait last:border-b-0">
                    <Link href={`/${org}/ventes/factures/${d.id}`} className="flex items-center justify-between gap-3 px-[18px] py-2.5 text-[13.5px] hover:bg-survol">
                      <span>
                        <span className="num font-semibold">{f.number}</span> · {f.clients?.name}
                        <span className="block text-[12px] text-encre-3">{libelleEtape(d.etape)}</span>
                      </span>
                      <span className="num font-semibold">{formatMontant(Number(f.amount_due) - Number(f.amount_paid), f.currency)}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Panneau>
        <Panneau>
          <PanneauTete titre="Scénario" />
          <PanneauCorps>
            {peutModifierOrganisation(role) ? (
              <FormulaireSuivi action={enregistrerReglagesRelances.bind(null, org)} bouton="Enregistrer" variante="secondaire">
                <label className="flex items-center gap-2 text-[13.5px] font-medium">
                  <input type="checkbox" name="actives" defaultChecked={organisation.reminders_enabled} className="size-4 accent-[var(--accent)]" />
                  Relances automatiques activées
                </label>
                <ChampSuivi libelle="Jours par rapport à l’échéance">
                  <input name="etapes" defaultValue={organisation.reminder_days.join(', ')} className={CHAMP} />
                </ChampSuivi>
                <p className="-mt-1 text-[12px] text-encre-3">{organisation.reminder_days.map(libelleEtape).join(' · ')}</p>
                <ChampSuivi libelle="Adresse de réponse">
                  <input name="reponse" type="email" defaultValue={organisation.reminder_email_from ?? ''} placeholder="compta@votre-entreprise.fr" className={CHAMP} />
                </ChampSuivi>
                <ChampSuivi libelle="Signature">
                  <textarea name="signature" rows={3} defaultValue={organisation.reminder_signature ?? ''} placeholder={organisation.name} className={`${CHAMP} h-auto py-2`} />
                </ChampSuivi>
              </FormulaireSuivi>
            ) : (
              <p className="text-[13.5px] text-encre-2">{organisation.reminder_days.map(libelleEtape).join(' · ')}</p>
            )}
            <p className="text-[12px] text-encre-3">Un client peut être exclu des relances depuis sa fiche.</p>
          </PanneauCorps>
        </Panneau>
      </div>
      <h2 className="text-[16px] font-semibold">Historique des envois</h2>
      {(historique ?? []).length === 0 ? (
        <EtatVide titre="Aucun envoi pour l’instant" />
      ) : (
        <Tableau legende="Historique des envois">
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Document</Th>
              <Th>Type</Th>
              <Th>Destinataire</Th>
              <Th>Résultat</Th>
            </tr>
          </thead>
          <tbody>
            {(historique ?? []).map((r) => (
              <tr key={r.id}>
                <Td className="num text-encre-3">{formatDate(r.sent_at)}</Td>
                <Td className="num">{r.documents?.number}</Td>
                <Td className="text-encre-2">{r.kind === 'relance' ? (r.step !== null ? `Relance · ${libelleEtape(r.step)}` : 'Relance manuelle') : 'Envoi'}</Td>
                <Td className="text-encre-2">{r.recipient}</Td>
                <Td className={r.status === 'echec' ? 'text-alerte' : r.status === 'simule' ? 'text-encre-3' : 'text-ok'}>
                  {r.status === 'envoye' ? 'Envoyé' : r.status === 'simule' ? 'Simulé' : `Échec${r.error ? ` : ${r.error}` : ''}`}
                </Td>
              </tr>
            ))}
          </tbody>
        </Tableau>
      )}
    </>
  )
}
