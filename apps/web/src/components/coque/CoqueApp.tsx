'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { seDeconnecter } from '@/app/(auth)/actions'
import { Logo } from '@/components/marque/Logo'
import { Avatar } from '@/components/ui/Avatar'
import { classesBouton } from '@/components/ui/Bouton'
import { Icone } from '@/components/ui/Icone'
import { IconeObjet } from '@/components/ui/IconeObjet'
import { Kbd } from '@/components/ui/Message'
import { initiales } from '@/lib/avatar'
import { cn } from '@/lib/cn'
import { cheminDansOrganisation, NAVIGATION, NAVIGATION_COMPTE, toutesLesEntrees, trouverEntree, type EntreeNav } from '@/lib/navigation'
import { CREATIONS } from '@/lib/palette'
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

/** Onglets de la barre de navigation (façon Lightning) : objets principaux, puis menus. */
type Onglet = { type: 'lien'; chemin: string; libelle?: string } | { type: 'menu'; libelle: string; chemins: string[] }

const ONGLETS: Onglet[] = [
  { type: 'lien', chemin: 'tableau-de-bord', libelle: 'Accueil' },
  { type: 'lien', chemin: 'ventes/factures' },
  { type: 'lien', chemin: 'ventes/devis' },
  { type: 'lien', chemin: 'clients' },
  { type: 'lien', chemin: 'catalogue', libelle: 'Articles' },
  { type: 'lien', chemin: 'tresorerie/paiements' },
  { type: 'lien', chemin: 'relances' },
  { type: 'menu', libelle: 'E-facturation', chemins: ['e-facturation/recues', 'e-facturation/e-reporting', 'e-facturation/reforme'] },
  { type: 'menu', libelle: 'Plus', chemins: ['ventes/avoirs', 'ventes/recurrences', 'comptabilite/exports', 'reglages', 'aide'] },
]

const ENTREES = new Map(toutesLesEntrees().map(({ entree }) => [entree.chemin, entree]))
const entree = (chemin: string): EntreeNav => ENTREES.get(chemin)!

/** Ferme un menu au clic extérieur ou à la touche Échap. */
function useFermeture(ouvert: boolean, fermer: () => void, zone: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!ouvert) return
    const clic = (e: MouseEvent) => {
      if (!zone.current?.contains(e.target as Node)) fermer()
    }
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fermer()
    }
    document.addEventListener('mousedown', clic)
    document.addEventListener('keydown', touche)
    return () => {
      document.removeEventListener('mousedown', clic)
      document.removeEventListener('keydown', touche)
    }
  }, [ouvert, fermer, zone])
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
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-m focus:bg-encre focus:px-3 focus:py-2 focus:text-surface"
      >
        Aller au contenu
      </a>

      {/* Tiroir de navigation (mobile et tablette). */}
      {menuOuvert && <div className="fixed inset-0 z-40 bg-voile lg:hidden" onClick={() => setMenuOuvert(false)} aria-hidden="true" />}
      <aside
        id="barre-laterale"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col gap-3.5 overflow-y-auto border-r border-trait bg-surface px-2.5 py-3.5 transition-transform duration-200 lg:hidden',
          menuOuvert ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <SelecteurOrganisation organisation={organisation} organisations={organisations} />
        <nav aria-label="Navigation principale" className="flex flex-col gap-3">
          {NAVIGATION.map((groupe) => (
            <div key={groupe.titre} className="flex flex-col gap-px">
              <p className="surtitre px-2.5 pb-1.5 pt-1.5 text-encre-3">{groupe.titre}</p>
              {groupe.entrees.map((e) => (
                <LienTiroir key={e.chemin} entree={e} slug={organisation.slug} actif={courante?.entree.chemin === e.chemin} />
              ))}
            </div>
          ))}
          <div className="flex flex-col gap-px border-t border-trait pt-2.5">
            {NAVIGATION_COMPTE.map((e) => (
              <LienTiroir key={e.chemin} entree={e} slug={organisation.slug} actif={courante?.entree.chemin === e.chemin} />
            ))}
          </div>
        </nav>
        <ChoixTheme className="mx-2.5 mt-auto" />
      </aside>

      <header className="sticky top-0 z-30 print:hidden">
        {/* En-tête global : lanceur, recherche, création, compte. */}
        <div className="flex h-[52px] items-center gap-3 border-b border-trait bg-surface px-3 sm:px-4">
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
          <Lanceur slug={organisation.slug} />
          <Link href={`/${organisation.slug}/tableau-de-bord`} className="shrink-0" aria-label="Pastille, accueil">
            <Logo className="text-[16px]" />
          </Link>
          <div className="flex min-w-0 flex-1 justify-center">
            <button
              type="button"
              onClick={() => setPaletteOuverte(true)}
              className="hidden h-8 w-full max-w-[520px] items-center gap-2 rounded-m border border-trait-fort bg-surface px-3 text-[13px] text-encre-3 hover:border-accent md:flex"
            >
              <Icone nom="recherche" taille={15} />
              Rechercher une page, une action, une entreprise…
              <span className="ml-auto">
                <Kbd>Ctrl K</Kbd>
              </span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => setPaletteOuverte(true)}
            className="grid size-8 place-items-center rounded-m text-encre-2 hover:bg-survol md:hidden"
            aria-label="Rechercher"
          >
            <Icone nom="recherche" />
          </button>
          {facturation && <MenuCreer slug={organisation.slug} />}
          <MenuUtilisateur utilisateur={utilisateur} slug={organisation.slug} />
        </div>

        {/* Barre d'onglets (ordinateur). */}
        <div className="hidden h-10 items-stretch gap-1 border-b border-trait bg-surface px-4 shadow-douce lg:flex">
          <SelecteurOrganisation organisation={organisation} organisations={organisations} compact />
          <nav aria-label="Navigation principale" className="flex items-stretch">
            <ul className="m-0 flex list-none items-stretch p-0">
              {ONGLETS.map((o) =>
                o.type === 'lien' ? (
                  <li key={o.chemin} className="flex">
                    <OngletLien slug={organisation.slug} entree={entree(o.chemin)} libelle={o.libelle} actif={courante?.entree.chemin === o.chemin} />
                  </li>
                ) : (
                  <li key={o.libelle} className="flex">
                    <OngletMenu slug={organisation.slug} libelle={o.libelle} entrees={o.chemins.map(entree)} actif={o.chemins.includes(courante?.entree.chemin ?? '')} />
                  </li>
                ),
              )}
            </ul>
          </nav>
        </div>
      </header>

      {bandeau && (
        <div className={cn('flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-[13px] sm:px-6 print:hidden', bandeau.ton === 'alerte' ? 'border-alerte/30 bg-alerte-doux' : 'border-info/30 bg-info-doux')}>
          <span>{bandeau.texte}</span>
          <Link href={bandeau.lien} className="font-semibold text-accent hover:underline">
            {bandeau.libelleLien}
          </Link>
        </div>
      )}
      <main id="contenu" className="fond-app flex min-w-0 flex-1 flex-col gap-4 px-3 pb-20 pt-4 sm:px-5">
        <Annonces annonces={annonces} />
        {children}
      </main>

      <BulleAide slug={organisation.slug} />
      {paletteOuverte && <Palette fermer={() => setPaletteOuverte(false)} slug={organisation.slug} organisations={organisations} />}
    </div>
  )
}

const CLASSE_ONGLET = 'relative flex items-center gap-1 whitespace-nowrap px-3 text-[13.5px] transition-colors'
const ONGLET_ACTIF = 'font-semibold text-encre after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:bg-accent'
const ONGLET_INACTIF = 'font-medium text-encre-2 hover:bg-survol hover:text-encre'

function OngletLien({ slug, entree, libelle, actif }: { slug: string; entree: EntreeNav; libelle?: string; actif: boolean }) {
  return (
    <Link href={`/${slug}/${entree.chemin}`} aria-current={actif ? 'page' : undefined} className={cn(CLASSE_ONGLET, actif ? ONGLET_ACTIF : ONGLET_INACTIF)}>
      {libelle ?? entree.libelle}
    </Link>
  )
}

function OngletMenu({ slug, libelle, entrees, actif }: { slug: string; libelle: string; entrees: EntreeNav[]; actif: boolean }) {
  const [ouvert, setOuvert] = useState(false)
  const zone = useRef<HTMLDivElement>(null)
  useFermeture(ouvert, () => setOuvert(false), zone)
  return (
    <div ref={zone} className="relative flex">
      <button type="button" onClick={() => setOuvert((o) => !o)} aria-haspopup="menu" aria-expanded={ouvert} className={cn(CLASSE_ONGLET, actif ? ONGLET_ACTIF : ONGLET_INACTIF)}>
        {libelle}
        <Icone nom="chevron-bas" taille={14} className="text-encre-3" />
      </button>
      {ouvert && (
        <div role="menu" className="absolute left-0 top-full z-50 mt-1 flex w-64 flex-col gap-px rounded-l border border-trait bg-surface p-1.5 shadow-haute">
          {entrees.map((e) => (
            <Link
              key={e.chemin}
              role="menuitem"
              href={`/${slug}/${e.chemin}`}
              onClick={() => setOuvert(false)}
              className="flex items-center gap-2.5 rounded-m px-2 py-1.5 text-[13.5px] font-medium hover:bg-survol"
            >
              <IconeObjet icone={e.icone} taille="xs" />
              {e.libelle}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function LienTiroir({ entree, slug, actif }: { entree: EntreeNav; slug: string; actif: boolean }) {
  return (
    <Link
      href={`/${slug}/${entree.chemin}`}
      aria-current={actif ? 'page' : undefined}
      className={cn(
        'flex h-9 items-center gap-2.5 whitespace-nowrap rounded-m px-2.5 text-[13.5px] transition-colors',
        actif ? 'bg-accent-doux font-semibold text-encre' : 'font-medium text-encre-2 hover:bg-survol hover:text-encre',
      )}
    >
      <IconeObjet icone={entree.icone} taille="xs" />
      <span className="truncate">{entree.libelle}</span>
    </Link>
  )
}

/** Lanceur d'applications : toutes les rubriques en tuiles, comme dans Salesforce. */
function Lanceur({ slug }: { slug: string }) {
  const [ouvert, setOuvert] = useState(false)
  const zone = useRef<HTMLDivElement>(null)
  useFermeture(ouvert, () => setOuvert(false), zone)
  return (
    <div ref={zone} className="relative hidden lg:block">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={ouvert}
        aria-label="Toutes les rubriques"
        title="Toutes les rubriques"
        className="grid size-8 place-items-center rounded-m text-encre-2 hover:bg-survol"
      >
        <Icone nom="lanceur" taille={18} />
      </button>
      {ouvert && (
        <div role="dialog" aria-label="Toutes les rubriques" className="absolute left-0 top-[calc(100%+8px)] z-50 w-[560px] rounded-l border border-trait bg-surface p-4 shadow-haute">
          <p className="mb-3 text-[15px] font-bold">Toutes les rubriques</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {[...NAVIGATION.flatMap((g) => g.entrees), ...NAVIGATION_COMPTE].map((e) => (
              <Link
                key={e.chemin}
                href={`/${slug}/${e.chemin}`}
                onClick={() => setOuvert(false)}
                className="flex items-start gap-2.5 rounded-m px-2 py-2 hover:bg-survol"
              >
                <IconeObjet icone={e.icone} taille="s" />
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="text-[13.5px] font-semibold">{e.libelle}</span>
                  <span className="line-clamp-2 text-[12px] text-encre-3">{e.description}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SelecteurOrganisation({
  organisation,
  organisations,
  compact = false,
}: {
  organisation: CoqueProps['organisation']
  organisations: CoqueProps['organisations']
  compact?: boolean
}) {
  const [ouvert, setOuvert] = useState(false)
  const zone = useRef<HTMLDivElement>(null)
  useFermeture(ouvert, () => setOuvert(false), zone)

  return (
    <div ref={zone} className={cn('relative', compact && 'mr-3 flex border-r border-trait pr-3')}>
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        title="Changer d’entreprise"
        className={cn(
          'flex items-center gap-2.5 text-left',
          compact ? 'max-w-[220px] rounded-m px-1.5 hover:bg-survol' : 'w-full rounded-m border border-trait bg-surface p-2 hover:border-trait-fort',
        )}
      >
        <span className={cn('grid shrink-0 place-items-center rounded-[4px] bg-accent font-titre font-bold text-sur-accent', compact ? 'size-6 text-[10px]' : 'size-8 text-[12px]')}>
          {initiales(organisation.nom)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className={cn('truncate font-bold', compact ? 'text-[14px]' : 'text-[13.5px]')}>{organisation.nom}</span>
          {!compact && <span className="truncate text-[12px] text-encre-3">{organisation.detail}</span>}
        </span>
        <Icone nom={compact ? 'chevron-bas' : 'chevrons'} taille={14} className="text-encre-3" />
      </button>
      {ouvert && (
        <div role="menu" className={cn('absolute z-50 flex w-64 flex-col gap-px rounded-l border border-trait bg-surface p-1.5 shadow-haute', compact ? 'left-0 top-full mt-1' : 'inset-x-0 top-[calc(100%+6px)]')}>
          <p className="surtitre px-2 pb-1 pt-1 text-encre-3">Entreprises</p>
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

/** Avatar : compte, réglages, thème, déconnexion. */
function MenuUtilisateur({ utilisateur, slug }: { utilisateur: CoqueProps['utilisateur']; slug: string }) {
  const [ouvert, setOuvert] = useState(false)
  const zone = useRef<HTMLDivElement>(null)
  useFermeture(ouvert, () => setOuvert(false), zone)
  const nom = utilisateur.nom ?? utilisateur.email
  return (
    <div ref={zone} className="relative">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-label={`Mon compte : ${nom}`}
        className="grid size-8 place-items-center rounded-full hover:ring-2 hover:ring-accent-doux"
      >
        <Avatar nom={nom} taille="m" />
      </button>
      {ouvert && (
        <div role="menu" className="absolute right-0 top-[calc(100%+8px)] z-50 flex w-64 flex-col gap-px rounded-l border border-trait bg-surface p-1.5 shadow-haute">
          <div className="flex items-center gap-2.5 px-2 pb-2 pt-1">
            <Avatar nom={nom} taille="m" />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-[13.5px] font-semibold">{utilisateur.nom ?? 'Mon compte'}</span>
              <span className="truncate text-[12px] text-encre-3">{utilisateur.email}</span>
            </span>
          </div>
          <div className="h-px bg-trait" />
          {[
            { href: '/compte', libelle: 'Mon compte et mes données' },
            { href: `/${slug}/reglages`, libelle: 'Réglages de l’entreprise' },
            { href: `/${slug}/aide`, libelle: 'Aide' },
          ].map((l) => (
            <Link key={l.href} role="menuitem" href={l.href} onClick={() => setOuvert(false)} className="rounded-m px-2 py-1.5 text-[13.5px] hover:bg-survol">
              {l.libelle}
            </Link>
          ))}
          <ChoixTheme className="mx-2 my-1.5" />
          <div className="h-px bg-trait" />
          <form action={seDeconnecter}>
            <button type="submit" role="menuitem" className="flex w-full items-center gap-2 rounded-m px-2 py-1.5 text-left text-[13.5px] text-encre-2 hover:bg-survol hover:text-encre">
              <Icone nom="deconnexion" taille={15} />
              Se déconnecter
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

/** « Nouvelle facture » en un clic, et les autres créations dans le menu attenant. */
function MenuCreer({ slug }: { slug: string }) {
  const [ouvert, setOuvert] = useState(false)
  const zone = useRef<HTMLDivElement>(null)
  useFermeture(ouvert, () => setOuvert(false), zone)

  return (
    <div ref={zone} className="relative flex">
      <Link href={`/${slug}/ventes/factures/nouvelle`} className={cn(classesBouton('primaire', 'compact'), 'rounded-r-none')}>
        <Icone nom="plus" taille={15} />
        <span className="hidden sm:inline">Nouvelle facture</span>
        <span className="sm:hidden">Facture</span>
      </Link>
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-label="Créer autre chose"
        title="Créer un devis, un client, un article…"
        className={cn(classesBouton('primaire', 'compact'), 'w-8 rounded-l-none border-l-[rgb(255_255_255/0.4)] px-0!')}
      >
        <Icone nom="chevron-bas" taille={15} />
      </button>
      {ouvert && (
        <div role="menu" className="absolute right-0 top-[calc(100%+8px)] z-50 flex w-60 flex-col gap-px rounded-l border border-trait bg-surface p-1.5 shadow-haute">
          <p className="surtitre px-2 pb-1 pt-1 text-encre-3">Créer</p>
          {CREATIONS.map((c) => (
            <Link
              key={c.id}
              role="menuitem"
              href={`/${slug}/${c.chemin}`}
              onClick={() => setOuvert(false)}
              className="flex items-center gap-2.5 rounded-m px-2 py-1.5 text-[13.5px] font-medium hover:bg-survol"
            >
              <IconeObjet icone={c.icone} taille="xs" />
              {c.libelle}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
