import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatTaux } from '@pastille/moteur'
import { decider } from '@/app/actions/plateforme'
import { ChampSuivi, FormulaireSuivi } from '@/components/documents/Suivi'
import { StatutPa } from '@/components/plateforme/StatutPa'
import { Icone } from '@/components/ui/Icone'
import { ListeCles, Panneau, PanneauCorps, PanneauTete } from '@/components/ui/Panneau'
import { Tableau, Td, Th } from '@/components/ui/Tableau'
import { formatDate, formatMontant } from '@/lib/format'
import type { Evenement } from '@/lib/pa/cycle'
import { quantiteTexte } from '@/lib/imprimable'
import { peutFacturer } from '@/lib/roles'
import { chargerContexte } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Facture reçue' }

const CHAMP = 'w-full rounded-m border border-trait-fort bg-surface px-2.5 py-2 text-[13.5px] font-normal text-encre outline-none focus:border-accent'

export default async function FactureRecue({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { org, id } = await params
  const { organisation, role } = await chargerContexte(org)
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const supabase = await creerClientServeur()
  const { data: f } = await supabase.from('received_invoices').select('*').eq('id', id).eq('organization_id', organisation.id).maybeSingle()
  if (!f) notFound()
  const m = (c: number) => formatMontant(c, f.currency)
  const lignes = (f.lines ?? []) as Array<{ designation: string; quantite: number; montant: number }>
  const ventilation = (f.vat_breakdown ?? []) as Array<{ categorie: string; taux: number; base: number; montant: number }>

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href={`/${org}/e-facturation/recues`} className="inline-flex items-center gap-1 text-[12.5px] text-encre-3 hover:text-encre">
          <Icone nom="chevron-gauche" taille={13} />
          Factures reçues
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-[24px] font-bold leading-tight">
            {f.type_code === '381' ? 'Avoir' : 'Facture'} <span className="num text-[21px]">{f.number}</span>
          </h1>
          <StatutPa code={f.status_code} />
        </div>
        <p className="mt-1 text-[13.5px] text-encre-2">
          {f.seller_name} · {formatDate(f.issue_date)} · {m(Number(f.total_ttc))} TTC
        </p>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Tableau legende="Lignes de la facture" largeurMin={520}>
            <thead>
              <tr>
                <Th>Désignation</Th>
                <Th numerique>Quantité</Th>
                <Th numerique>Montant HT</Th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l, i) => (
                <tr key={i}>
                  <Td>{l.designation}</Td>
                  <Td numerique>{quantiteTexte(l.quantite)}</Td>
                  <Td numerique>{m(l.montant)}</Td>
                </tr>
              ))}
            </tbody>
          </Tableau>
          <Panneau>
            <PanneauTete titre="Montants" />
            <PanneauCorps>
              <ListeCles
                lignes={[
                  ['Total HT', <span key="ht" className="num">{m(Number(f.total_ht))}</span>],
                  ...ventilation.map((v): [string, React.ReactNode] => [
                    v.categorie === 'S' ? `TVA ${formatTaux(v.taux)} sur ${m(v.base)}` : `${v.categorie} sur ${m(v.base)}`,
                    <span key={`${v.categorie}${v.taux}`} className="num">{m(v.montant)}</span>,
                  ]),
                  ['Total TTC', <span key="ttc" className="num font-semibold">{m(Number(f.total_ttc))}</span>],
                  ['Net à payer', <span key="net" className="num font-semibold">{m(Number(f.amount_due))}</span>],
                ]}
              />
            </PanneauCorps>
          </Panneau>
        </div>
        <aside className="flex flex-col gap-4 self-start">
          <Panneau>
            <PanneauTete titre="Fournisseur" />
            <PanneauCorps>
              <ListeCles
                lignes={[
                  ['Nom', f.seller_name],
                  ['SIREN', <span key="s" className="num">{f.seller_siren ?? '—'}</span>],
                  ['TVA', <span key="t" className="num">{f.seller_vat ?? '—'}</span>],
                  ['Échéance', f.due_date ? formatDate(f.due_date) : '—'],
                  ['Format', f.format === 'factur-x' ? 'Factur-X' : f.format.toUpperCase()],
                ]}
              />
            </PanneauCorps>
          </Panneau>
          {peutFacturer(role) && f.status !== 'payee' && f.status !== 'refusee' && (
            <Panneau>
              <PanneauTete titre="Décision" description="Transmise au fournisseur via la plateforme." />
              <PanneauCorps>
                <FormulaireSuivi action={decider.bind(null, org, f.id)} bouton="Transmettre la décision">
                  <ChampSuivi libelle="Décision">
                    <select name="decision" defaultValue={f.status === 'approuvee' ? 'payee' : 'approuvee'} className={CHAMP}>
                      <option value="approuvee">Approuver</option>
                      <option value="payee">Paiement transmis</option>
                      <option value="litige">Mettre en litige</option>
                      <option value="refusee">Refuser</option>
                    </select>
                  </ChampSuivi>
                  <ChampSuivi libelle="Motif (obligatoire pour un refus ou un litige)">
                    <textarea name="motif" rows={3} maxLength={500} className={CHAMP} />
                  </ChampSuivi>
                </FormulaireSuivi>
              </PanneauCorps>
            </Panneau>
          )}
          <Panneau>
            <PanneauTete titre="Cycle de vie" />
            <PanneauCorps>
              <ol className="m-0 flex list-none flex-col gap-1.5 border-l border-trait p-0 pl-3">
                {((f.history ?? []) as Evenement[]).map((e, i) => (
                  <li key={i} className="text-[12.5px]">
                    <span className="font-medium">{e.libelle}</span>{' '}
                    <span className="num text-encre-3">{new Date(e.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                    {e.motif && <span className="block text-encre-2">« {e.motif} »</span>}
                  </li>
                ))}
              </ol>
            </PanneauCorps>
          </Panneau>
        </aside>
      </div>
    </div>
  )
}
