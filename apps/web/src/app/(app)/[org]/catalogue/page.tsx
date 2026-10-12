import type { Metadata } from 'next'
import Link from 'next/link'
import { archiverProduit, basculerFavori } from '@/app/actions/produits'
import { Bouton, BoutonLien } from '@/components/ui/Bouton'
import { Etiquette } from '@/components/ui/Categorie'
import { EnTeteVue } from '@/components/ui/EnTeteVue'
import { EtatVide } from '@/components/ui/EtatVide'
import { Icone } from '@/components/ui/Icone'
import { Segments } from '@/components/ui/Segments'
import { Tableau, Td, Th } from '@/components/ui/Tableau'
import { cn } from '@/lib/cn'
import { formatMontant } from '@/lib/format'
import { NATURES } from '@/lib/produits'
import { peutFacturer } from '@/lib/roles'
import { chargerContexte } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import { formatTaux } from '@pastille/moteur'

export const metadata: Metadata = { title: 'Articles et prestations' }

type Recherche = { categorie?: string; q?: string; archives?: string }

export default async function Catalogue({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<Recherche> }) {
  const { org } = await params
  const { categorie, q, archives } = await searchParams
  const { organisation, role } = await chargerContexte(org)
  const supabase = await creerClientServeur()
  const { data } = await supabase.from('products').select('*').eq('organization_id', organisation.id).order('favorite', { ascending: false }).order('name')
  const produits = (data ?? []).filter((p) => (archives ? p.archived_at : !p.archived_at))
  const categories = [...new Set(produits.map((p) => p.category).filter((c): c is string => Boolean(c)))].sort((a, b) => a.localeCompare(b, 'fr'))
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const filtres = produits.filter(
    (p) => (!categorie || p.category === categorie) && (!q || norm(`${p.name} ${p.reference ?? ''} ${p.description ?? ''}`).includes(norm(q))),
  )
  const editable = peutFacturer(role)
  const lien = (p: Recherche) => {
    const s = new URLSearchParams(Object.entries(p).filter(([, v]) => v) as Array<[string, string]>)
    return `/${org}/catalogue${s.size ? `?${s}` : ''}`
  }

  return (
    <>
      <EnTeteVue
        titre="Articles et prestations"
        description={`${produits.length} article${produits.length > 1 ? 's' : ''}${archives ? ' archivés' : ''}`}
        actions={
          editable && (
            <BoutonLien href={`/${org}/catalogue/nouveau`} variante="primaire" icone="plus">
              Nouvel article
            </BoutonLien>
          )
        }
      />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Segments
          libelle="Catégories d’articles"
          segments={[
            { href: lien({ q, archives }), libelle: 'Tous', compte: produits.length, actif: !categorie },
            ...categories.map((c) => ({
              href: lien({ categorie: c, q, archives }),
              libelle: c,
              compte: produits.filter((p) => p.category === c).length,
              actif: categorie === c,
            })),
          ]}
        />
        <form className="flex items-center gap-2" role="search">
          {categorie && <input type="hidden" name="categorie" value={categorie} />}
          <label className="flex h-[34px] items-center gap-2 rounded-m border border-trait-fort bg-surface px-2.5 focus-within:border-accent">
            <Icone nom="recherche" taille={15} className="text-encre-3" />
            <span className="sr-only">Rechercher un article</span>
            <input name="q" defaultValue={q} placeholder="Désignation, référence" className="w-44 bg-transparent text-[13.5px] outline-none placeholder:text-encre-3" />
          </label>
        </form>
      </div>
      {produits.length === 0 ? (
        <EtatVide
          titre={archives ? 'Aucun article archivé' : 'Le catalogue est vide'}
          action={
            editable &&
            !archives && (
              <BoutonLien href={`/${org}/catalogue/nouveau`} variante="primaire" icone="plus">
                Ajouter un article
              </BoutonLien>
            )
          }
        >
          <p>Enregistrez vos prestations et produits : prix et TVA se remplissent seuls dans vos factures.</p>
        </EtatVide>
      ) : (
        <Tableau legende="Catalogue">
          <thead>
            <tr>
              <Th>
                <span className="sr-only">Favori</span>
              </Th>
              <Th>Désignation</Th>
              <Th>Nature</Th>
              <Th>Catégorie</Th>
              <Th numerique>Prix HT</Th>
              <Th numerique>TVA</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {filtres.map((p) => (
              <tr key={p.id} className="hover:bg-survol">
                <Td className="w-10">
                  {editable ? (
                    <form action={basculerFavori.bind(null, org, p.id, !p.favorite)}>
                      <button
                        type="submit"
                        aria-label={p.favorite ? `Retirer ${p.name} des favoris` : `Ajouter ${p.name} aux favoris`}
                        aria-pressed={p.favorite}
                        className={cn('grid size-7 place-items-center rounded-s text-[16px] hover:bg-survol', p.favorite ? 'text-attente' : 'text-trait-fort')}
                      >
                        ★
                      </button>
                    </form>
                  ) : (
                    p.favorite && <span aria-label="Favori" className="text-attente">★</span>
                  )}
                </Td>
                <Td>
                  <Link href={`/${org}/catalogue/${p.id}`} className="flex flex-col leading-tight">
                    <span className="font-semibold">{p.name}</span>
                    <span className="text-[12px] text-encre-3">{[p.reference, p.description].filter(Boolean).join(' · ').slice(0, 90) || `par ${p.unit}`}</span>
                  </Link>
                </Td>
                <Td className="text-encre-2">{NATURES.find((n) => n.valeur === p.nature)?.libelle}</Td>
                <Td>{p.category ? <Etiquette>{p.category}</Etiquette> : <span className="text-encre-3">—</span>}</Td>
                <Td numerique>
                  {formatMontant(p.unit_price_cents)}
                  <span className="font-texte text-[12px] text-encre-3"> / {p.unit}</span>
                </Td>
                <Td numerique>{p.vat_category === 'S' ? formatTaux(p.vat_rate) : p.vat_category === 'O' ? 'Hors champ' : 'Exonéré'}</Td>
                <Td className="text-right">
                  {editable && (
                    <form action={archiverProduit.bind(null, org, p.id, !p.archived_at)}>
                      <Bouton type="submit" variante="fantome" taille="s">
                        {p.archived_at ? 'Restaurer' : 'Archiver'}
                      </Bouton>
                    </form>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Tableau>
      )}
      <div className="flex justify-end text-[12.5px]">
        <Link href={lien({ archives: archives ? undefined : '1' })} className="text-accent underline-offset-2 hover:underline">
          {archives ? 'Voir les articles actifs' : 'Voir les articles archivés'}
        </Link>
      </div>
    </>
  )
}
