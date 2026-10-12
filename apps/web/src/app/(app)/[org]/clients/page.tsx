import type { Metadata } from 'next'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { BoutonLien } from '@/components/ui/Bouton'
import { Categorie } from '@/components/ui/Categorie'
import { EnTeteVue } from '@/components/ui/EnTeteVue'
import { EtatVide } from '@/components/ui/EtatVide'
import { Icone } from '@/components/ui/Icone'
import { Segments } from '@/components/ui/Segments'
import { Tableau, Td, Th } from '@/components/ui/Tableau'
import { libelleConditions, TYPES_CLIENT } from '@/lib/clients'
import { formatDate, grouperChiffres } from '@/lib/format'
import { peutFacturer } from '@/lib/roles'
import { chargerContexte } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import type { ClientKind } from '@/lib/supabase/types'

export const metadata: Metadata = { title: 'Clients' }

type Recherche = { categorie?: string; q?: string; archives?: string }

export default async function Clients({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<Recherche> }) {
  const { org } = await params
  const { categorie, q, archives } = await searchParams
  const { organisation, role } = await chargerContexte(org)
  const supabase = await creerClientServeur()

  const { data: tous } = await supabase
    .from('clients')
    .select('id, kind, name, legal_form, siren, vat_number, billing_city, payment_terms, archived_at, created_at')
    .eq('organization_id', organisation.id)
    .order('name')
  const clients = tous ?? []
  const actifs = clients.filter((c) => (archives ? c.archived_at : !c.archived_at))

  const { data: contacts } = await supabase
    .from('client_contacts')
    .select('client_id, name, email, receives_invoices')
    .eq('organization_id', organisation.id)
    .order('receives_invoices', { ascending: false })
  const contactPrincipal = new Map<string, { name: string; email: string | null }>()
  for (const c of contacts ?? []) if (!contactPrincipal.has(c.client_id)) contactPrincipal.set(c.client_id, c)

  const recherche = (q ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const filtres = actifs.filter((c) => {
    if (categorie && c.kind !== categorie) return false
    if (!recherche) return true
    const texte = `${c.name} ${c.billing_city ?? ''} ${c.siren ?? ''} ${c.vat_number ?? ''}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    return texte.includes(recherche) || texte.replace(/\s/g, '').includes(recherche.replace(/\s/g, ''))
  })

  const lien = (p: Recherche) => {
    const s = new URLSearchParams()
    if (p.categorie) s.set('categorie', p.categorie)
    if (p.q) s.set('q', p.q)
    if (p.archives) s.set('archives', '1')
    const chaine = s.toString()
    return `/${org}/clients${chaine ? `?${chaine}` : ''}`
  }
  const editable = peutFacturer(role)

  return (
    <>
      <EnTeteVue
        titre="Clients"
        description={`${actifs.length} client${actifs.length > 1 ? 's' : ''}${archives ? ' archivés' : ''}`}
        actions={
          editable && (
            <>
              <BoutonLien href={`/${org}/clients/import`}>Importer CSV</BoutonLien>
              <BoutonLien href={`/${org}/clients/nouveau`} variante="primaire" icone="plus">
                Nouveau client
              </BoutonLien>
            </>
          )
        }
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <Segments
          libelle="Catégories de clients"
          segments={[
            { href: lien({ q, archives }), libelle: 'Tous', compte: actifs.length, actif: !categorie },
            ...TYPES_CLIENT.map((t) => ({
              href: lien({ categorie: t.valeur, q, archives }),
              libelle: t.libelle,
              compte: actifs.filter((c) => c.kind === t.valeur).length,
              actif: categorie === t.valeur,
            })),
          ]}
        />
        <form className="flex items-center gap-2" role="search">
          {categorie && <input type="hidden" name="categorie" value={categorie} />}
          {archives && <input type="hidden" name="archives" value="1" />}
          <label className="flex h-[34px] items-center gap-2 rounded-m border border-trait-fort bg-surface px-2.5 focus-within:border-accent">
            <Icone nom="recherche" taille={15} className="text-encre-3" />
            <span className="sr-only">Rechercher un client</span>
            <input name="q" defaultValue={q} placeholder="Nom, ville, SIREN" className="w-44 bg-transparent text-[13.5px] outline-none placeholder:text-encre-3" />
          </label>
        </form>
      </div>

      {clients.length === 0 ? (
        <EtatVide
          titre="Aucun client pour l’instant"
          action={
            editable && (
              <div className="flex flex-wrap justify-center gap-2">
                <BoutonLien href={`/${org}/clients/nouveau`} variante="primaire" icone="plus">
                  Ajouter un client
                </BoutonLien>
                <BoutonLien href={`/${org}/clients/import`}>Importer un fichier CSV</BoutonLien>
              </div>
            )
          }
        >
          <p>Recherchez une entreprise par son nom ou son SIREN : la fiche se remplit toute seule.</p>
        </EtatVide>
      ) : filtres.length === 0 ? (
        <EtatVide titre="Aucun client ne correspond">
          <p>Modifiez la recherche ou choisissez une autre catégorie.</p>
        </EtatVide>
      ) : (
        <Tableau legende="Liste des clients">
          <thead>
            <tr>
              <Th>Client</Th>
              <Th>Catégorie</Th>
              <Th>Identifiant</Th>
              <Th>Contact</Th>
              <Th>Paiement</Th>
              <Th>Ajouté le</Th>
            </tr>
          </thead>
          <tbody>
            {filtres.map((c) => {
              const contact = contactPrincipal.get(c.id)
              return (
                <tr key={c.id} className="hover:bg-survol">
                  <Td>
                    <Link href={`/${org}/clients/${c.id}`} className="flex min-w-0 items-center gap-2.5">
                      <Avatar nom={c.name} />
                      <span className="flex min-w-0 flex-col leading-tight">
                        <span className="truncate font-semibold">{c.name}</span>
                        <span className="truncate text-[12px] text-encre-3">{[c.legal_form, c.billing_city].filter(Boolean).join(' · ') || '—'}</span>
                      </span>
                    </Link>
                  </Td>
                  <Td>
                    <Categorie categorie={c.kind as ClientKind} />
                  </Td>
                  <Td className="num text-encre-3">{c.siren ? grouperChiffres(c.siren) : (c.vat_number ?? '—')}</Td>
                  <Td className="text-encre-2">
                    {contact ? (
                      <span className="flex flex-col leading-tight">
                        <span>{contact.name}</span>
                        {contact.email && <span className="text-[12px] text-encre-3">{contact.email}</span>}
                      </span>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td className="text-encre-2">{c.payment_terms ? libelleConditions(c.payment_terms) : libelleConditions(organisation.default_payment_terms)}</Td>
                  <Td className="text-encre-3">{formatDate(c.created_at)}</Td>
                </tr>
              )
            })}
          </tbody>
        </Tableau>
      )}
      <div className="flex justify-between text-[12.5px] text-encre-3">
        <span>
          {filtres.length} affiché{filtres.length > 1 ? 's' : ''}
        </span>
        <Link href={lien({ categorie, q, archives: archives ? undefined : '1' })} className="text-accent underline-offset-2 hover:underline">
          {archives ? 'Voir les clients actifs' : 'Voir les clients archivés'}
        </Link>
      </div>
    </>
  )
}
