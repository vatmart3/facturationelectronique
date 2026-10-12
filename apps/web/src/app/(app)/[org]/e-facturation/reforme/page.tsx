import type { Metadata } from 'next'
import Link from 'next/link'
import { enregistrerPlateforme } from '@/app/actions/plateforme'
import { ChampSuivi, FormulaireSuivi } from '@/components/documents/Suivi'
import { EnTeteVue } from '@/components/ui/EnTeteVue'
import { Icone } from '@/components/ui/Icone'
import { Panneau, PanneauCorps, PanneauTete } from '@/components/ui/Panneau'
import { cn } from '@/lib/cn'
import { afnorConfiguree } from '@/lib/pa'
import { EMISSION_PME_TPE, joursAvant, RECEPTION_OBLIGATOIRE } from '@/lib/reforme'
import { peutModifierOrganisation } from '@/lib/roles'
import { chargerContexte } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Réforme 2027' }

const CHAMP = 'h-[34px] w-full rounded-m border border-trait-fort bg-surface px-2.5 text-[13.5px] font-normal text-encre outline-none focus:border-accent'

export default async function Reforme({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params
  const { organisation, role } = await chargerContexte(org)
  const supabase = await creerClientServeur()
  const [{ data: clients }, { count: transmises }, { count: recues }, { count: declarations }] = await Promise.all([
    supabase.from('clients').select('kind, siren').eq('organization_id', organisation.id).is('archived_at', null),
    supabase.from('einvoice_transmissions').select('id', { count: 'exact', head: true }).eq('organization_id', organisation.id),
    supabase.from('received_invoices').select('id', { count: 'exact', head: true }).eq('organization_id', organisation.id),
    supabase.from('ereporting_reports').select('id', { count: 'exact', head: true }).eq('organization_id', organisation.id),
  ])
  const pros = (clients ?? []).filter((c) => c.kind === 'b2b')
  const avecSiren = pros.filter((c) => c.siren).length
  const simulee = organisation.pa_provider === 'simulee'

  const points = [
    {
      titre: 'Identité de l’entreprise',
      ok: Boolean(organisation.siren && organisation.address_line1 && organisation.city && organisation.vat_regime),
      detail: 'SIREN, adresse et régime de TVA : ils identifient l’entreprise dans l’annuaire et sur chaque facture.',
      lien: `/${org}/reglages`,
    },
    {
      titre: 'Plateforme agréée choisie',
      ok: !simulee && Boolean(organisation.pa_mandate_at),
      detail: simulee
        ? 'Vous utilisez la plateforme simulée : parfaite pour essayer, mais rien n’est réellement transmis.'
        : organisation.pa_mandate_at
          ? 'Mandat donné à la plateforme pour émettre et recevoir en votre nom.'
          : 'Confirmez le mandat donné à votre plateforme.',
    },
    {
      titre: 'Réception des factures fournisseurs',
      ok: !simulee || (recues ?? 0) > 0,
      detail: `Obligatoire depuis le 1er septembre 2026. ${recues ?? 0} facture(s) reçue(s) dans Pastille.`,
      lien: `/${org}/e-facturation/recues`,
    },
    {
      titre: 'Clients professionnels identifiés',
      ok: pros.length === 0 || avecSiren === pros.length,
      detail: `${avecSiren} sur ${pros.length} client(s) entreprise ont un SIREN : il est obligatoire sur leurs factures et sert d’adresse dans l’annuaire.`,
      lien: `/${org}/clients?categorie=b2b`,
    },
    {
      titre: 'Émission au format Factur-X',
      ok: true,
      detail: 'Chaque facture émise est un PDF/A-3 Factur-X profil EN 16931, contrôlé avant émission.',
    },
    {
      titre: 'Transmission via la plateforme',
      ok: (transmises ?? 0) > 0,
      detail: `${transmises ?? 0} facture(s) transmise(s).${organisation.pa_auto_transmit ? ' Transmission automatique activée.' : ''}`,
      lien: `/${org}/ventes/factures`,
    },
    {
      titre: 'E-reporting',
      ok: (declarations ?? 0) > 0,
      detail: `Ventes aux particuliers, international et encaissements de services. ${declarations ?? 0} dépôt(s).`,
      lien: `/${org}/e-facturation/e-reporting`,
    },
  ]
  const faits = points.filter((p) => p.ok).length

  return (
    <>
      <EnTeteVue titre="Réforme 2027" description="Où en est l’entreprise face à la facturation électronique obligatoire." />
      <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panneau>
          <PanneauTete titre="Préparation" description={`${faits} sur ${points.length} points prêts`} />
          <ol className="m-0 flex list-none flex-col p-0">
            {points.map((p) => {
              const contenu = (
                <>
                  <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border', p.ok ? 'border-ok bg-ok-doux text-ok' : 'border-attente bg-attente-doux text-attente')}>
                    <Icone nom={p.ok ? 'coche' : 'alerte'} taille={11} />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{p.titre}</span>
                    <span className="text-[12.5px] text-encre-3">{p.detail}</span>
                  </span>
                </>
              )
              return (
                <li key={p.titre} className="border-b border-trait last:border-b-0">
                  {p.lien ? (
                    <Link href={p.lien} className="flex items-start gap-3 px-[18px] py-3 hover:bg-survol">
                      {contenu}
                    </Link>
                  ) : (
                    <div className="flex items-start gap-3 px-[18px] py-3">{contenu}</div>
                  )}
                </li>
              )
            })}
          </ol>
        </Panneau>
        <div className="flex flex-col gap-[18px]">
          <Panneau>
            <PanneauTete titre="Calendrier" />
            <PanneauCorps>
              <p className="text-[13.5px]">
                <strong>1er septembre 2026</strong> · toutes les entreprises reçoivent des factures électroniques ; grandes entreprises et ETI les émettent.
                {joursAvant(RECEPTION_OBLIGATOIRE) === 0 && <span className="text-ok"> En vigueur.</span>}
              </p>
              <p className="text-[13.5px]">
                <strong>1er septembre 2027</strong> · PME, TPE et micro-entreprises émettent à leur tour et transmettent leur e-reporting.{' '}
                <span className="text-encre-3">J-{joursAvant(EMISSION_PME_TPE)}</span>
              </p>
            </PanneauCorps>
          </Panneau>
          <Panneau>
            <PanneauTete titre="Plateforme agréée" />
            <PanneauCorps>
              {peutModifierOrganisation(role) ? (
                <FormulaireSuivi action={enregistrerPlateforme.bind(null, org)} bouton="Enregistrer" variante="secondaire">
                  <ChampSuivi libelle="Connecteur">
                    <select name="fournisseur" defaultValue={organisation.pa_provider} className={CHAMP}>
                      <option value="simulee">Plateforme simulée (essai)</option>
                      <option value="afnor">Ma plateforme agréée (API AFNOR XP Z12-013)</option>
                    </select>
                  </ChampSuivi>
                  {!afnorConfiguree() && <p className="-mt-1 text-[12px] text-encre-3">Le connecteur réel s’active avec PA_API_URL et PA_API_TOKEN, fournis par votre plateforme.</p>}
                  <ChampSuivi libelle="Identifiant chez la plateforme">
                    <input name="compte" defaultValue={organisation.pa_account_id ?? ''} className={CHAMP} />
                  </ChampSuivi>
                  <ChampSuivi libelle="Fréquence d’e-reporting">
                    <select name="frequence" defaultValue={organisation.ereporting_frequency} className={CHAMP}>
                      <option value="decade">Par décade (réel normal)</option>
                      <option value="mois">Mensuelle (réel simplifié)</option>
                      <option value="bimestre">Bimestrielle (franchise)</option>
                    </select>
                  </ChampSuivi>
                  <label className="flex items-center gap-2 text-[13.5px]">
                    <input type="checkbox" name="auto" defaultChecked={organisation.pa_auto_transmit} className="size-4 accent-[var(--accent)]" />
                    Transmettre automatiquement les factures aux clients professionnels
                  </label>
                  <label className="flex items-center gap-2 text-[13.5px]">
                    <input type="checkbox" name="mandat" defaultChecked={Boolean(organisation.pa_mandate_at)} className="size-4 accent-[var(--accent)]" />
                    J’ai donné mandat à cette plateforme
                  </label>
                </FormulaireSuivi>
              ) : (
                <p className="text-[13.5px] text-encre-2">{simulee ? 'Plateforme simulée' : 'API AFNOR'}</p>
              )}
            </PanneauCorps>
          </Panneau>
        </div>
      </div>
    </>
  )
}
