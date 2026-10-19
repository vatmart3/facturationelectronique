import type { Metadata } from 'next'
import Link from 'next/link'
import { Anneau } from '@/components/ui/Anneau'
import { EnTeteVue } from '@/components/ui/EnTeteVue'
import { Icone } from '@/components/ui/Icone'
import { Indicateurs } from '@/components/ui/Indicateurs'
import { ListeCles, Panneau, PanneauCorps, PanneauTete } from '@/components/ui/Panneau'
import { cn } from '@/lib/cn'
import { formatTaux } from '@pastille/moteur'
import { genererMaintenant } from '@/app/actions/suivi'
import { FormulaireSuivi } from '@/components/documents/Suivi'
import { ajouterJours, aujourdHui } from '@/lib/document'
import { formatDate, formatMontant } from '@/lib/format'
import { peutFacturer } from '@/lib/roles'
import { creerClientServeur } from '@/lib/supabase/serveur'
import { calculerTableau } from '@/lib/tableau'
import { EMISSION_PME_TPE, joursAvant } from '@/lib/reforme'
import { chargerContexte } from '@/lib/session'

export const metadata: Metadata = { title: 'Tableau de bord' }

const euroCourt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 })

export default async function TableauDeBord({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params
  const { organisation, utilisateur, role } = await chargerContexte(org)
  const jours = joursAvant(EMISSION_PME_TPE)
  const mois = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date())
  const jour = aujourdHui()
  const supabase = await creerClientServeur()
  const depuis = ajouterJours(jour, -400)
  const [{ data: docs }, { data: paiements }, { data: tva }, { count: nbClients }, { data: recurrences }] = await Promise.all([
    supabase
      .from('documents')
      .select('id, type, status, issue_date, due_date, valid_until, total_ht, total_ttc, amount_due, amount_paid, number, client_id, currency, clients(name)')
      .eq('organization_id', organisation.id)
      .or(`issue_date.gte.${depuis},status.in.(emis,envoye,partiellement_paye,brouillon)`),
    supabase.from('payments').select('document_id, paid_on, amount_cents').eq('organization_id', organisation.id).gte('paid_on', depuis),
    supabase.from('document_vat_summary').select('document_id, vat_category, vat_rate, base_cents, vat_cents').eq('organization_id', organisation.id),
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('organization_id', organisation.id),
    supabase.from('recurring_invoices').select('id').eq('organization_id', organisation.id).eq('active', true).lte('next_date', jour),
  ])
  const documents = (docs ?? []).map((d) => ({
    ...d,
    total_ht: Number(d.total_ht),
    total_ttc: Number(d.total_ttc),
    amount_due: Number(d.amount_due),
    amount_paid: Number(d.amount_paid),
    client: d.clients?.name ?? null,
  }))
  const t = calculerTableau(
    documents,
    (paiements ?? []).map((p) => ({ ...p, amount_cents: Number(p.amount_cents) })),
    (tva ?? []).map((x) => ({ ...x, base_cents: Number(x.base_cents), vat_cents: Number(x.vat_cents) })),
    jour,
  )
  const maxCa = Math.max(1, ...t.caMensuel.map((c) => Math.abs(c.ht)))
  const retards = documents
    .filter((d) => d.type !== 'devis' && d.type !== 'avoir' && ['emis', 'envoye', 'partiellement_paye'].includes(d.status) && d.due_date && d.due_date < jour)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
    .slice(0, 5)
  const annee = ajouterJours(jour, -365)
  const factures = documents.filter((d) => (d.type === 'facture' || d.type === 'acompte') && d.status !== 'annule' && (d.status === 'brouillon' || d.issue_date >= annee || ['emis', 'envoye', 'partiellement_paye'].includes(d.status)))
  const ouverte = (d: (typeof factures)[number]) => ['emis', 'envoye', 'partiellement_paye'].includes(d.status)
  const echue = (d: (typeof factures)[number]) => ouverte(d) && Boolean(d.due_date && d.due_date < jour)
  const part = (libelle: string, couleur: string, liste: typeof factures, montant: (d: (typeof factures)[number]) => number) => ({
    libelle,
    couleur,
    valeur: liste.length,
    montant: liste.reduce((s, d) => s + montant(d), 0),
  })
  const repartition = [
    part('Payées', 'var(--ok)', factures.filter((d) => d.status === 'paye'), (d) => d.total_ttc),
    part('À encaisser', 'var(--accent)', factures.filter((d) => ouverte(d) && !echue(d)), (d) => d.amount_due - d.amount_paid),
    part('En retard', 'var(--alerte)', factures.filter(echue), (d) => d.amount_due - d.amount_paid),
    part('Brouillons', 'var(--trait-fort)', factures.filter((d) => d.status === 'brouillon'), (d) => d.total_ttc),
  ]
  const emise = documents.some((d) => d.type !== 'devis' && d.status !== 'brouillon')

  const etapes = [
    {
      fait: Boolean(organisation.siren && organisation.address_line1 && organisation.city),
      titre: 'Compléter l’identité légale',
      detail: 'SIREN, adresse et forme juridique figurent sur chaque facture.',
      href: `/${org}/reglages`,
    },
    {
      fait: Boolean(organisation.vat_regime),
      titre: 'Choisir le régime de TVA',
      detail: 'Il détermine les taux et mentions appliqués par défaut.',
      href: `/${org}/demarrage?etape=tva`,
    },
    {
      fait: Boolean(organisation.iban),
      titre: 'Renseigner l’IBAN',
      detail: 'Imprimé sur la facture avec un QR code de virement.',
      href: `/${org}/demarrage?etape=banque`,
    },
    { fait: (nbClients ?? 0) > 0, titre: 'Ajouter un premier client', detail: 'Recherche par nom ou SIREN, ou import CSV.', href: `/${org}/clients/nouveau` },
    { fait: emise, titre: 'Émettre une première facture', detail: 'Le contrôle de conformité vous guide jusqu’à l’émission.', href: `/${org}/ventes/factures/nouvelle` },
  ]
  const faites = etapes.filter((e) => e.fait).length

  return (
    <>
      <EnTeteVue
        titre="Tableau de bord"
        description={<span className="first-letter:uppercase">{mois} · {organisation.name}</span>}
      />
      {(recurrences ?? []).length > 0 && peutFacturer(role) && (
        <Panneau>
          <PanneauCorps className="flex-row flex-wrap items-center justify-between">
            <p className="text-[13.5px]">
              <strong>{recurrences!.length}</strong> facture{recurrences!.length > 1 ? 's' : ''} récurrente{recurrences!.length > 1 ? 's' : ''} à générer aujourd’hui.
            </p>
            <FormulaireSuivi action={genererMaintenant.bind(null, org)} bouton="Générer maintenant" />
          </PanneauCorps>
        </Panneau>
      )}
      <Indicateurs
        indicateurs={[
          {
            libelle: 'Encaissé ce mois',
            valeur: formatMontant(t.encaisseMois),
            detail: t.nbPaiementsMois ? `${t.nbPaiementsMois} paiement${t.nbPaiementsMois > 1 ? 's' : ''}` : 'Aucun paiement',
            ton: 'ok',
          },
          {
            libelle: 'En attente',
            valeur: formatMontant(t.enAttente.montant),
            detail: t.enAttente.nombre ? `${t.enAttente.nombre} facture${t.enAttente.nombre > 1 ? 's' : ''} non échue${t.enAttente.nombre > 1 ? 's' : ''}` : 'Rien en attente',
            ton: 'info',
          },
          {
            libelle: 'En retard',
            valeur: formatMontant(t.enRetard.montant),
            detail: t.enRetard.nombre ? `${t.enRetard.nombre} facture${t.enRetard.nombre > 1 ? 's' : ''} échue${t.enRetard.nombre > 1 ? 's' : ''}` : 'Rien en retard',
            ton: 'alerte',
          },
          {
            libelle: 'Chiffre d’affaires HT',
            valeur: formatMontant(t.caExercice),
            detail: `Exercice ${jour.slice(0, 4)}${t.delaiMoyen !== null ? ` · payé en ${t.delaiMoyen} j en moyenne` : ''}`,
          },
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panneau>
          <PanneauTete titre="Chiffre d’affaires HT" description="12 derniers mois, avoirs déduits" />
          <PanneauCorps>
            <div className="relative pl-12">
              <div className="pointer-events-none absolute inset-x-0 top-0 bottom-5 flex flex-col justify-between" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className="relative border-t border-dashed border-trait">
                    <span className="absolute left-0 top-0 w-10 -translate-y-1/2 bg-surface text-right text-[10.5px] tabular-nums text-encre-3">
                      {euroCourt.format((maxCa * (3 - i)) / 300)}
                    </span>
                  </span>
                ))}
              </div>
              <ol className="relative m-0 flex h-48 list-none items-end gap-1.5 p-0" aria-label="Chiffre d’affaires mensuel">
                {t.caMensuel.map((c) => (
                  <li key={c.mois} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${c.libelle} : ${formatMontant(c.ht)}`}>
                    <span className="sr-only">
                      {c.libelle} : {formatMontant(c.ht)}
                    </span>
                    <span
                      className={cn('w-full max-w-9 rounded-t-[3px] transition-colors', c.mois === jour.slice(0, 7) ? 'bg-accent' : 'bg-accent/45 group-hover:bg-accent/70')}
                      style={{ height: `calc(${Math.max(1, (Math.max(0, c.ht) / maxCa) * 100)}% - 20px)` }}
                      aria-hidden="true"
                    />
                    <span className="h-4 text-[10.5px] leading-4 text-encre-3" aria-hidden="true">
                      {c.libelle}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </PanneauCorps>
        </Panneau>
        <Panneau>
          <PanneauTete titre="Répartition des factures" description="Factures et acomptes des 12 derniers mois" actions={<Link href={`/${org}/ventes/factures`} className="text-[13px] text-accent hover:underline">Factures</Link>} />
          <PanneauCorps>
            <Anneau
              total={repartition.reduce((s, p) => s + p.valeur, 0)}
              unite="factures"
              parts={repartition.map((p) => ({ ...p, detail: p.montant > 0 ? formatMontant(p.montant) : undefined }))}
            />
          </PanneauCorps>
        </Panneau>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panneau>
          <PanneauTete titre="Prévision d’encaissement" description="Reste dû des factures ouvertes" />
          <PanneauCorps>
            <ListeCles
              lignes={[
                ['Échu ou sous 30 jours', <span key="30" className="num">{formatMontant(t.prevision.j30)}</span>],
                ['De 31 à 60 jours', <span key="60" className="num">{formatMontant(t.prevision.j60)}</span>],
                ['De 61 à 90 jours', <span key="90" className="num">{formatMontant(t.prevision.j90)}</span>],
              ]}
            />
          </PanneauCorps>
        </Panneau>
        <Panneau>
          <PanneauTete titre="TVA collectée" description={mois.charAt(0).toUpperCase() + mois.slice(1)} />
          <PanneauCorps>
            {t.tvaMois.length === 0 ? (
              <p className="text-[13.5px] text-encre-3">Aucune facture émise ce mois-ci.</p>
            ) : (
              <ListeCles
                lignes={[
                  ...t.tvaMois.map((g): [string, React.ReactNode] => [
                    g.categorie === 'S' ? `${formatTaux(g.taux)} sur ${formatMontant(g.base)}` : `${g.categorie} sur ${formatMontant(g.base)}`,
                    <span key={`${g.categorie}${g.taux}`} className="num">
                      {formatMontant(g.tva)}
                    </span>,
                  ]),
                  ['Total', <span key="t" className="num font-semibold">{formatMontant(t.tvaMois.reduce((s, g) => s + g.tva, 0))}</span>],
                ]}
              />
            )}
            {t.devisEnAttente.nombre > 0 && (
              <Link href={`/${org}/ventes/devis?statut=envoyes`} className="text-[13px] text-accent hover:underline">
                {t.devisEnAttente.nombre} devis en attente de réponse · {formatMontant(t.devisEnAttente.montant)}
              </Link>
            )}
          </PanneauCorps>
        </Panneau>
        <Panneau>
          <PanneauTete titre="Meilleurs clients" description="Chiffre d’affaires HT sur 12 mois" />
          <PanneauCorps>
            {t.topClients.length === 0 ? (
              <p className="text-[13.5px] text-encre-3">Les clients apparaîtront ici dès les premières factures émises.</p>
            ) : (
              <ListeCles lignes={t.topClients.map((c): [string, React.ReactNode] => [c.client, <span key={c.client} className="num">{formatMontant(c.ht)}</span>])} />
            )}
          </PanneauCorps>
        </Panneau>
      </div>
      {retards.length > 0 && (
        <Panneau>
          <PanneauTete titre="À relancer" description="Factures échues, les plus anciennes d’abord" actions={<Link href={`/${org}/relances`} className="text-[13px] text-accent hover:underline">Relances</Link>} />
          <ul className="m-0 flex list-none flex-col p-0">
            {retards.map((d) => (
              <li key={d.id} className="border-b border-trait last:border-b-0">
                <Link href={`/${org}/ventes/factures/${d.id}`} className="flex items-center justify-between gap-3 px-[18px] py-2.5 text-[13.5px] hover:bg-survol">
                  <span className="min-w-0">
                    <span className="num font-semibold">{d.number}</span> <span className="text-encre-2">· {d.clients?.name}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-[12.5px] text-alerte">échue le {formatDate(d.due_date!)}</span>
                    <span className="num font-semibold">{formatMontant(d.amount_due - d.amount_paid, d.currency)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panneau>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panneau>
          <PanneauTete
            titre="Mise en route"
            description={`${faites} sur ${etapes.length} étapes · bonjour ${utilisateur.nom?.split(' ')[0] ?? ''}`.trim()}
          />
          <ol className="m-0 flex list-none flex-col p-0">
            {etapes.map((e) => (
              <li key={e.titre} className="border-b border-trait last:border-b-0">
                <Link href={e.href} className="flex items-start gap-3 px-[18px] py-3 hover:bg-survol">
                  <span
                    className={cn(
                      'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border',
                      e.fait ? 'border-ok bg-ok-doux text-ok' : 'border-trait-fort text-transparent',
                    )}
                  >
                    <Icone nom="coche" taille={12} />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className={cn('font-medium', e.fait && 'text-encre-3 line-through')}>{e.titre}</span>
                    <span className="text-[12.5px] text-encre-3">{e.fait ? 'Fait' : e.detail}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Panneau>
        <Panneau>
          <PanneauTete titre="Réforme de la facturation électronique" />
          <PanneauCorps>
            <div className="flex items-baseline gap-2">
              <span className="font-titre text-[34px] font-bold tabular-nums tracking-[-0.02em]">{jours}</span>
              <span className="text-encre-2">jours avant l’obligation d’émettre</span>
            </div>
            <p className="text-[13.5px] text-encre-2">
              Depuis le 1<sup>er</sup> septembre 2026, toute entreprise doit pouvoir recevoir des factures électroniques. Au
              1<sup>er</sup> septembre 2027, les PME, TPE et micro-entreprises devront aussi les émettre et transmettre leur
              e-reporting via une plateforme agréée.
            </p>
            <Link href={`/${org}/e-facturation/reforme`} className="text-[13.5px] font-medium text-accent underline-offset-2 hover:underline">
              Voir où en est l’entreprise
            </Link>
          </PanneauCorps>
        </Panneau>
      </div>
    </>
  )
}
