import type { Metadata } from 'next'
import Link from 'next/link'
import { formatTaux } from '@pastille/moteur'
import { ajouterTaux, modifierMention, publierAnnonce, terminerAnnonce } from '@/app/actions/admin'
import { exigerAdmin } from '@/lib/admin'
import { BoutonAction } from '@/components/documents/Actions'
import { ChampSuivi, FormulaireSuivi } from '@/components/documents/Suivi'
import { Logo } from '@/components/marque/Logo'
import { EnTeteVue } from '@/components/ui/EnTeteVue'
import { Indicateurs } from '@/components/ui/Indicateurs'
import { Message } from '@/components/ui/Message'
import { Panneau, PanneauCorps, PanneauTete } from '@/components/ui/Panneau'
import { Segments } from '@/components/ui/Segments'
import { Tableau, Td, Th } from '@/components/ui/Tableau'
import { formatDate, formatMontant } from '@/lib/format'
import { etatAbonnement, offre, type Abonnement } from '@/lib/offres'

export const metadata: Metadata = { title: 'Administration', robots: { index: false } }

const CHAMP = 'w-full rounded-m border border-trait-fort bg-surface px-2.5 py-1.5 text-[13.5px] font-normal text-encre outline-none focus:border-accent'
const ONGLETS = [
  ['organisations', 'Organisations'],
  ['erreurs', 'Erreurs'],
  ['referentiels', 'TVA et mentions'],
  ['annonces', 'Annonces'],
] as const

export default async function Admin({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  const { onglet = 'organisations' } = await searchParams
  let service
  try {
    service = await exigerAdmin()
  } catch (e) {
    return (
      <main className="mx-auto max-w-[640px] px-4 py-16">
        <Message ton="erreur">{e instanceof Error ? e.message : 'Accès refusé.'}</Message>
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-fond">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 py-6">
        <div className="flex items-center justify-between">
          <Logo />
          <Link href="/" className="text-[13px] text-encre-2 hover:underline">
            Retour à l’application
          </Link>
        </div>
        <EnTeteVue titre="Administration" description="Organisations, abonnements, usage, erreurs, référentiels et annonces." />
        <Segments libelle="Sections" segments={ONGLETS.map(([id, l]) => ({ href: `/admin?onglet=${id}`, libelle: l, actif: onglet === id }))} />
        {onglet === 'organisations' && <Organisations service={service} />}
        {onglet === 'erreurs' && <Erreurs service={service} />}
        {onglet === 'referentiels' && <Referentiels service={service} />}
        {onglet === 'annonces' && <AnnoncesAdmin service={service} />}
      </div>
    </main>
  )
}

type Service = Awaited<ReturnType<typeof exigerAdmin>>

async function Organisations({ service }: { service: Service }) {
  const [{ data: orgs }, { data: subs }, { data: membres }, { data: docs }] = await Promise.all([
    service.from('organizations').select('id, name, slug, created_at, closed_at, siren').order('created_at', { ascending: false }).limit(500),
    service.from('subscriptions').select('*'),
    service.from('memberships').select('organization_id'),
    service.from('documents').select('organization_id, status, total_ht').neq('status', 'brouillon').limit(100_000),
  ])
  const parOrg = <T extends { organization_id: string }>(rows: T[] | null) => {
    const m = new Map<string, T[]>()
    for (const r of rows ?? []) m.set(r.organization_id, [...(m.get(r.organization_id) ?? []), r])
    return m
  }
  const abonnements = new Map((subs ?? []).map((s) => [s.organization_id, s]))
  const nbMembres = parOrg(membres)
  const documents = parOrg(docs)
  const etats = (orgs ?? []).map((o) => etatAbonnement((abonnements.get(o.id) as Abonnement | undefined) ?? null))
  const payants = (subs ?? []).filter((s) => s.status === 'active')
  const mrr = payants.reduce((s, x) => s + offre(x.plan).prix, 0)
  return (
    <>
      <Indicateurs
        indicateurs={[
          { libelle: 'Organisations', valeur: String(orgs?.length ?? 0) },
          { libelle: 'En essai', valeur: String(etats.filter((e) => e.essai && e.actif).length), ton: 'info' },
          { libelle: 'Abonnements payants', valeur: String(payants.length), ton: 'ok' },
          { libelle: 'Revenu mensuel HT', valeur: formatMontant(mrr) },
        ]}
      />
      <Tableau legende="Organisations">
        <thead>
          <tr>
            <Th>Organisation</Th>
            <Th>Créée</Th>
            <Th>Offre</Th>
            <Th>État</Th>
            <Th numerique>Membres</Th>
            <Th numerique>Documents émis</Th>
            <Th numerique>CA HT cumulé</Th>
          </tr>
        </thead>
        <tbody>
          {(orgs ?? []).map((o, i) => (
            <tr key={o.id}>
              <Td>
                <span className="flex flex-col leading-tight">
                  <span className="font-semibold">{o.name}</span>
                  <span className="num text-[12px] text-encre-3">
                    {o.slug}
                    {o.closed_at && ' · close'}
                  </span>
                </span>
              </Td>
              <Td className="num text-encre-3">{formatDate(o.created_at)}</Td>
              <Td>{offre(etats[i]!.plan).nom.replace('Pastille ', '')}</Td>
              <Td className={etats[i]!.actif ? 'text-ok' : 'text-alerte'}>{etats[i]!.libelle}</Td>
              <Td numerique>{nbMembres.get(o.id)?.length ?? 0}</Td>
              <Td numerique>{documents.get(o.id)?.length ?? 0}</Td>
              <Td numerique>{formatMontant((documents.get(o.id) ?? []).reduce((s, d) => s + Number(d.total_ht), 0))}</Td>
            </tr>
          ))}
        </tbody>
      </Tableau>
    </>
  )
}

async function Erreurs({ service }: { service: Service }) {
  const { data } = await service.from('error_logs').select('*, organizations(name)').order('created_at', { ascending: false }).limit(200)
  return (data ?? []).length === 0 ? (
    <Message ton="succes">Aucune erreur enregistrée.</Message>
  ) : (
    <Tableau legende="Journal des erreurs">
      <thead>
        <tr>
          <Th>Date</Th>
          <Th>Type</Th>
          <Th>Organisation</Th>
          <Th>Message</Th>
        </tr>
      </thead>
      <tbody>
        {(data ?? []).map((e) => (
          <tr key={e.id}>
            <Td className="num text-encre-3">{new Date(e.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</Td>
            <Td>{e.kind}</Td>
            <Td className="text-encre-2">{(e as { organizations?: { name: string } | null }).organizations?.name ?? '—'}</Td>
            <Td className="max-w-[520px] whitespace-normal text-[13px]">{e.message}</Td>
          </tr>
        ))}
      </tbody>
    </Tableau>
  )
}

async function Referentiels({ service }: { service: Service }) {
  const [{ data: taux }, { data: mentions }] = await Promise.all([
    service.from('vat_rates').select('*').order('territory').order('rate', { ascending: false }),
    service.from('legal_mentions').select('*').order('key'),
  ])
  return (
    <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <Panneau>
        <PanneauTete titre="Taux de TVA" />
        <PanneauCorps>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13.5px]">
            {(taux ?? []).map((t) => (
              <li key={t.id} className="flex justify-between border-b border-trait py-1.5 last:border-b-0">
                <span>
                  {t.label} <span className="text-encre-3">· {t.territory}</span>
                </span>
                <span className="num">
                  {formatTaux(t.rate)} depuis le {formatDate(t.valid_from)}
                  {t.valid_to ? ` jusqu’au ${formatDate(t.valid_to)}` : ''}
                </span>
              </li>
            ))}
          </ul>
          <FormulaireSuivi action={ajouterTaux} bouton="Ajouter un taux" variante="secondaire">
            <div className="grid grid-cols-2 gap-2">
              <ChampSuivi libelle="Libellé">
                <input name="libelle" className={CHAMP} />
              </ChampSuivi>
              <ChampSuivi libelle="Taux (%)">
                <input name="taux" inputMode="decimal" className={CHAMP} />
              </ChampSuivi>
              <ChampSuivi libelle="Territoire">
                <select name="territoire" className={CHAMP}>
                  <option value="metropole">Métropole</option>
                  <option value="corse">Corse</option>
                  <option value="dom">DOM</option>
                </select>
              </ChampSuivi>
              <ChampSuivi libelle="En vigueur le">
                <input name="debut" type="date" className={CHAMP} />
              </ChampSuivi>
            </div>
          </FormulaireSuivi>
        </PanneauCorps>
      </Panneau>
      <Panneau>
        <PanneauTete titre="Mentions légales imprimées" description="Modifiées ici, elles s’appliquent aux prochains documents sans redéploiement." />
        <PanneauCorps>
          {(mentions ?? []).map((m) => (
            <FormulaireSuivi key={m.key} action={modifierMention.bind(null, m.key)} bouton="Enregistrer" variante="secondaire" className="border-b border-trait pb-3 last:border-b-0">
              <ChampSuivi libelle={`${m.key} · ${m.applies_when}`}>
                <textarea name="texte" rows={2} defaultValue={m.text} maxLength={600} className={CHAMP} />
              </ChampSuivi>
            </FormulaireSuivi>
          ))}
        </PanneauCorps>
      </Panneau>
    </div>
  )
}

async function AnnoncesAdmin({ service }: { service: Service }) {
  const { data } = await service.from('announcements').select('*').order('created_at', { ascending: false }).limit(50)
  const maintenant = new Date().toISOString()
  return (
    <div className="grid gap-[18px] lg:grid-cols-2">
      <Panneau>
        <PanneauTete titre="Nouvelle annonce" description="Affichée en haut de l’application pour tous les utilisateurs." />
        <PanneauCorps>
          <FormulaireSuivi action={publierAnnonce} bouton="Publier">
            <ChampSuivi libelle="Titre">
              <input name="titre" maxLength={120} className={CHAMP} />
            </ChampSuivi>
            <ChampSuivi libelle="Texte">
              <textarea name="corps" rows={3} maxLength={600} className={CHAMP} />
            </ChampSuivi>
            <ChampSuivi libelle="Fin de diffusion (facultatif)">
              <input name="fin" type="date" className={CHAMP} />
            </ChampSuivi>
            <label className="flex items-center gap-2 text-[13.5px]">
              <input type="checkbox" name="important" className="size-4 accent-[var(--accent)]" />
              Importante
            </label>
          </FormulaireSuivi>
        </PanneauCorps>
      </Panneau>
      <Panneau>
        <PanneauTete titre="Annonces" />
        <ul className="m-0 flex list-none flex-col p-0">
          {(data ?? []).map((a) => {
            const active = a.starts_at <= maintenant && (!a.ends_at || a.ends_at > maintenant)
            return (
              <li key={a.id} className="flex items-start justify-between gap-3 border-b border-trait px-[18px] py-3 text-[13.5px] last:border-b-0">
                <span>
                  <strong>{a.title}</strong> · {a.body}
                  <span className="block text-[12px] text-encre-3">{active ? 'En ligne' : 'Terminée'}</span>
                </span>
                {active && (
                  <BoutonAction action={terminerAnnonce.bind(null, a.id)} variante="fantome">
                    Terminer
                  </BoutonAction>
                )}
              </li>
            )
          })}
        </ul>
      </Panneau>
    </div>
  )
}
