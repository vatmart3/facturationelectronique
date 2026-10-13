'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { seDeconnecter } from '@/app/(auth)/actions'
import { Logo } from '@/components/marque/Logo'
import { Avatar } from '@/components/ui/Avatar'
import { Icone } from '@/components/ui/Icone'
import { IconeObjet } from '@/components/ui/IconeObjet'
import { classesBouton } from '@/components/ui/Bouton'
import { Kbd } from '@/components/ui/Message'
import { initiales } from '@/lib/avatar'
import { cn } from '@/lib/cn'
import { cheminDansOrganisation, NAVIGATION, NAVIGATION_COMPTE, trouverEntree, type EntreeNav } from '@/lib/navigation'
import { Annonces, BulleAide } from './Aide'
import { Palette } from './Palette'
import { ChoixTheme } from './Theme'

export interface CoqueProps {
  organisation: { slug: string; nom: string; detail: string }
  organisations: Array<{ slug: string; nom: string; role: string }>
  utilisateur: { email: string; nom: string | null }
  /** Essai, paywall doux : bandeau en haut de chaque page. */
  bandeau?: { texte: string; lien: string; libelleLien: string; ton: 'info' | 'alerte' } | null
  annonces?: Array<{ id: string; title: string; body: string; level: 'info' | 'important' }>
  /** Le rôle peut créer des factures : bouton « Nouvelle facture » et raccourci N. */
  facturation?: boolean
  children: ReactNode
}

export function CoqueApp({ organisation, organisations, utilisateur, bandeau, annonces = [], facturation = true, children }: CoqueProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [paletteOuverte, setPaletteOuverte] = useState(false)
  const [menuOuvert, setMenuOuvert] = useState(false)
  const chemin = cheminDansOrganisation(pathname, organisation.slug)
  const courante = trouverEntree(chemin)

  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOuverte((o) => !o)
        return
      }
      // « N » : nouvelle facture, hors champ de saisie.
      const cible = e.target as HTMLElement | null
      const saisie = cible?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')
      if (facturation && e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey && !saisie) {
        e.preventDefault()
        router.push(`/${organisation.slug}/ventes/factures/nouvelle`)
      }
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [router, organisation.slug, facturation])

  // Le menu mobile se referme à chaque changement de page.
  const [cheminPrecedent, setCheminPrecedent] = useState(pathname)
  if (cheminPrecedent !== pathname) {
    setCheminPrecedent(pathname)
    setMenuOuvert(false)
  }

  return (
    <div className="flex min-h-dvh">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-m focus:bg-encre focus:px-3 focus:py-2 focus:text-surface"
      >
        Aller au contenu
      </a>

      {menuOuvert && (
        <div className="fixed inset-0 z-30 bg-voile lg:hidden" onClick={() => setMenuOuvert(false)} aria-hidden="true" />
      )}

      <aside
        id="barre-laterale"
        className={cn(
          'zone-nuit fond-nuit fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col gap-3.5 overflow-y-auto px-2.5 py-3.5',
          'transition-transform duration-200 lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0',
          menuOuvert ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <SelecteurOrganisation organisation={organisation} organisations={organisations} />

        <button
          type="button"
          onClick={() => setPaletteOuverte(true)}
          className="flex h-[34px] w-full items-center gap-2 rounded-m border border-trait bg-surface px-2.5 text-[13px] text-encre-3 hover:border-trait-fort"
        >
          <Icone nom="recherche" taille={15} />
          Rechercher
          <span className="ml-auto">
            <Kbd>Ctrl K</Kbd>
          </span>
        </button>

        <nav aria-label="Navigation principale" className="flex flex-col gap-3">
          {NAVIGATION.map((groupe) => (
            <div key={groupe.titre} className="flex flex-col gap-px">
              <p className="surtitre px-2.5 pb-1.5 pt-1.5 text-encre-3">{groupe.titre}</p>
              {groupe.entrees.map((e) => (
                <LienNav key={e.chemin} entree={e} slug={organisation.slug} actif={courante?.entree.chemin === e.chemin} />
              ))}
            </div>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-px border-t border-trait pt-2.5">
          {NAVIGATION_COMPTE.map((e) => (
            <LienNav key={e.chemin} entree={e} slug={organisation.slug} actif={courante?.entree.chemin === e.chemin} />
          ))}
          <ChoixTheme className="mx-2.5 mt-2" />
          <div className="mt-1 flex items-center gap-2.5 rounded-m px-2.5 py-2">
            <Avatar nom={utilisateur.nom ?? utilisateur.email} taille="s" />
            <Link href="/compte" className="flex min-w-0 flex-1 flex-col leading-tight hover:underline" title="Mon compte, mes données">
              <span className="truncate text-[13px] font-medium">{utilisateur.nom ?? 'Mon compte'}</span>
              <span className="truncate text-[11.5px] text-encre-3">{utilisateur.email}</span>
            </Link>
            <form action={seDeconnecter}>
              <button
                type="submit"
                title="Se déconnecter"
                aria-label="Se déconnecter"
                className="grid size-7 place-items-center rounded-s text-encre-3 hover:bg-survol hover:text-encre"
              >
                <Icone nom="deconnexion" taille={15} />
              </button>
            </form>
          </div>
          <Logo className="px-2.5 pt-1 text-[14px] text-encre" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-trait bg-surface px-4 shadow-douce sm:px-6">
          <span className="lisere-marque absolute inset-x-0 top-0 h-[3px]" aria-hidden="true" />
          <button
            type="button"
            className="grid size-8 place-items-center rounded-m text-encre-2 hover:bg-survol lg:hidden"
            onClick={() => setMenuOuvert(true)}
            aria-label="Ouvrir le menu"
            aria-controls="barre-laterale"
            aria-expanded={menuOuvert}
          >
            <Icone nom="menu" />
          </button>
          <nav aria-label="Fil d’Ariane" className="min-w-0 flex-1">
            <ol className="flex items-center gap-2 overflow-hidden whitespace-nowrap text-[13.5px] text-encre-3">
              {courante ? (
                <>
                  <li className="hidden items-center gap-2 sm:flex">
                    <IconeObjet icone={courante.entree.icone} taille="xs" />
                    {courante.groupe}
                  </li>
                  <li className="hidden text-trait-fort sm:block" aria-hidden="true">
                    /
                  </li>
                  <li className="truncate font-semibold text-encre" aria-current="page">
                    {courante.entree.libelle}
                  </li>
                </>
              ) : (
                <li className="truncate font-semibold text-encre">{organisation.nom}</li>
              )}
            </ol>
          </nav>
          <button
            type="button"
            onClick={() => setPaletteOuverte(true)}
            className="grid size-8 place-items-center rounded-m text-encre-2 hover:bg-survol lg:hidden"
            aria-label="Rechercher"
          >
            <Icone nom="recherche" />
          </button>
          {facturation && (
            <Link
              href={`/${organisation.slug}/ventes/factures/nouvelle`}
              className={cn(classesBouton('primaire'), 'gap-2')}
            >
              <Icone nom="plus" taille={15} />
              <span className="hidden sm:inline">Nouvelle facture</span>
              <span className="sm:hidden">Facture</span>
            </Link>
          )}
        </header>
        {bandeau && (
          <div className={cn('flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-[13px] sm:px-7 print:hidden', bandeau.ton === 'alerte' ? 'border-alerte/30 bg-alerte-doux' : 'border-info/30 bg-info-doux')}>
            <span>{bandeau.texte}</span>
            <Link href={bandeau.lien} className="font-semibold text-accent hover:underline">
              {bandeau.libelleLien}
            </Link>
          </div>
        )}
        <main id="contenu" className="flex min-w-0 flex-1 flex-col gap-[22px] px-4 pb-20 pt-6 sm:px-7">
          <Annonces annonces={annonces} />
          {children}
        </main>
      </div>

      <BulleAide slug={organisation.slug} />
      {paletteOuverte && (
        <Palette fermer={() => setPaletteOuverte(false)} slug={organisation.slug} organisations={organisations} />
      )}
    </div>
  )
}

function LienNav({ entree, slug, actif }: { entree: EntreeNav; slug: string; actif: boolean }) {
  return (
    <Link
      href={`/${slug}/${entree.chemin}`}
      aria-current={actif ? 'page' : undefined}
      className={cn(
        'relative flex h-9 items-center gap-2.5 whitespace-nowrap rounded-m px-2 text-[13.5px] transition-colors',
        actif
          ? 'bg-[rgb(255_255_255/0.16)] font-semibold text-encre before:absolute before:inset-y-1.5 before:-left-2.5 before:w-[3px] before:rounded-r-full before:bg-ciel'
          : 'font-medium text-encre-2 hover:bg-survol hover:text-encre',
      )}
    >
      <IconeObjet icone={entree.icone} taille="xs" className={actif ? '' : 'opacity-90'} />
      <span className="truncate">{entree.libelle}</span>
    </Link>
  )
}

function SelecteurOrganisation({
  organisation,
  organisations,
}: {
  organisation: CoqueProps['organisation']
  organisations: CoqueProps['organisations']
}) {
  const [ouvert, setOuvert] = useState(false)
  const conteneur = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ouvert) return
    function surClic(e: MouseEvent) {
      if (!conteneur.current?.contains(e.target as Node)) setOuvert(false)
    }
    function surTouche(e: KeyboardEvent) {
      if (e.key === 'Escape') setOuvert(false)
    }
    document.addEventListener('mousedown', surClic)
    document.addEventListener('keydown', surTouche)
    return () => {
      document.removeEventListener('mousedown', surClic)
      document.removeEventListener('keydown', surTouche)
    }
  }, [ouvert])

  return (
    <div ref={conteneur} className="relative">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        className="flex w-full items-center gap-2.5 rounded-m border border-trait bg-surface p-2 text-left hover:border-trait-fort"
      >
        <span className="grid size-[32px] shrink-0 place-items-center rounded-[8px] bg-linear-to-br from-ciel to-accent font-titre text-[12px] font-bold text-[#fff] shadow-douce">
          {initiales(organisation.nom)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-[13.5px] font-semibold">{organisation.nom}</span>
          <span className="truncate text-[12px] text-encre-3">{organisation.detail}</span>
        </span>
        <Icone nom="chevrons" taille={14} className="text-encre-3" />
      </button>
      {ouvert && (
        <div role="menu" className="zone-normale absolute inset-x-0 top-[calc(100%+6px)] z-50 flex flex-col gap-px rounded-l border border-trait bg-surface p-1.5 shadow-haute">
          <p className="surtitre px-2 pb-1 pt-1">Entreprises</p>
          {organisations.map((o) => (
            <Link
              key={o.slug}
              role="menuitem"
              href={`/${o.slug}/tableau-de-bord`}
              onClick={() => setOuvert(false)}
              className="flex items-center gap-2.5 rounded-m px-2 py-1.5 text-[13.5px] hover:bg-survol"
            >
              <Avatar nom={o.nom} taille="s" />
              <span className="min-w-0 flex-1 truncate">{o.nom}</span>
              {o.slug === organisation.slug && <Icone nom="coche" taille={14} className="text-accent" />}
            </Link>
          ))}
          <div className="my-1 h-px bg-trait" />
          <Link
            role="menuitem"
            href="/bienvenue?nouvelle=1"
            onClick={() => setOuvert(false)}
            className="flex items-center gap-2.5 rounded-m px-2 py-1.5 text-[13.5px] text-encre-2 hover:bg-survol hover:text-encre"
          >
            <Icone nom="plus" taille={15} />
            Créer une entreprise
          </Link>
        </div>
      )}
    </div>
  )
}
