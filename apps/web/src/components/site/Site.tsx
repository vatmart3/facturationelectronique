import Link from 'next/link'
import type { ReactNode } from 'react'
import { Logo } from '@/components/marque/Logo'
import { classesBouton } from '@/components/ui/Bouton'

export const CTA = 'Créer ma première facture'

export function EnTeteSite() {
  return (
    <header className="sticky top-0 z-30 border-b border-trait bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-6 px-4">
        <Link href="/" aria-label="Pastille, accueil">
          <Logo />
        </Link>
        <nav aria-label="Site" className="hidden flex-1 items-center gap-5 text-[14px] text-encre-2 md:flex">
          <Link href="/#fonctionnalites" className="hover:text-encre">
            Fonctionnalités
          </Link>
          <Link href="/tarifs" className="hover:text-encre">
            Tarifs
          </Link>
          <Link href="/facturation-electronique-2027" className="hover:text-encre">
            Réforme 2027
          </Link>
          <Link href="/#faq" className="hover:text-encre">
            Questions
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/connexion" className={classesBouton('fantome')}>
            Se connecter
          </Link>
          <Link href="/inscription" className={`${classesBouton('primaire')} hidden sm:inline-flex`}>
            {CTA}
          </Link>
        </div>
      </div>
    </header>
  )
}

export function PiedSite() {
  return (
    <footer className="border-t border-trait bg-surface-2">
      <div className="mx-auto grid max-w-[1120px] gap-8 px-4 py-10 text-[13.5px] sm:grid-cols-4">
        <div className="flex flex-col gap-2">
          <Logo />
          <p className="text-encre-3">Facturation électronique conforme pour indépendants, TPE et PME. Données hébergées dans l’Union européenne.</p>
        </div>
        <ColonnePied
          titre="Produit"
          liens={[
            ['/#fonctionnalites', 'Fonctionnalités'],
            ['/tarifs', 'Tarifs'],
            ['/inscription', 'Essai gratuit'],
            ['/connexion', 'Se connecter'],
          ]}
        />
        <ColonnePied
          titre="Guides"
          liens={[
            ['/facturation-electronique-2027', 'Facturation électronique 2027'],
            ['/facture-auto-entrepreneur', 'Facture auto-entrepreneur'],
            ['/modele-facture-factur-x', 'Modèle de facture Factur-X'],
          ]}
        />
        <ColonnePied
          titre="Légal"
          liens={[
            ['/legal/mentions-legales', 'Mentions légales'],
            ['/legal/cgu', 'Conditions d’utilisation'],
            ['/legal/cgv', 'Conditions de vente'],
            ['/legal/confidentialite', 'Confidentialité'],
            ['/legal/cookies', 'Cookies'],
            ['/legal/dpa', 'Accord de traitement (DPA)'],
          ]}
        />
      </div>
    </footer>
  )
}

function ColonnePied({ titre, liens }: { titre: string; liens: Array<[string, string]> }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="surtitre">{titre}</p>
      {liens.map(([href, libelle]) => (
        <Link key={href} href={href} className="text-encre-2 hover:text-encre hover:underline">
          {libelle}
        </Link>
      ))}
    </div>
  )
}

export function PageSite({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-fond">
      <EnTeteSite />
      <main id="contenu" className="flex-1">
        {children}
      </main>
      <PiedSite />
    </div>
  )
}

/** Page de contenu (guides, pages légales) : colonne de lecture confortable. */
export function Article({ titre, chapo, children, maj }: { titre: string; chapo?: string; children: ReactNode; maj?: string }) {
  return (
    <article className="mx-auto max-w-[760px] px-4 py-12">
      <h1 className="text-[34px] font-bold leading-tight tracking-tight">{titre}</h1>
      {chapo && <p className="mt-3 text-[17px] text-encre-2">{chapo}</p>}
      {maj && <p className="mt-2 text-[13px] text-encre-3">Mise à jour : {maj}</p>}
      <div className="contenu-article mt-8 flex flex-col gap-4 text-[15px] leading-relaxed text-encre-2 [&_a]:text-accent [&_a]:underline [&_h2]:mt-6 [&_h2]:text-[21px] [&_h2]:font-semibold [&_h2]:text-encre [&_h3]:mt-3 [&_h3]:text-[16px] [&_h3]:font-semibold [&_h3]:text-encre [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-encre [&_table]:w-full [&_td]:border-b [&_td]:border-trait [&_td]:py-2 [&_td]:pr-3 [&_th]:border-b [&_th]:border-trait-fort [&_th]:py-2 [&_th]:text-left">
        {children}
      </div>
    </article>
  )
}

export function AppelAction({ titre = 'Prêt pour la réforme en 5 minutes', texte = 'Essai gratuit de 14 jours, sans carte bancaire.' }: { titre?: string; texte?: string }) {
  return (
    <section className="mx-auto my-10 flex max-w-[760px] flex-col items-start gap-3 rounded-l border border-trait bg-surface p-6 shadow-douce sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-[18px] font-semibold">{titre}</p>
        <p className="text-[14px] text-encre-2">{texte}</p>
      </div>
      <Link href="/inscription" className={classesBouton('primaire')}>
        {CTA}
      </Link>
    </section>
  )
}
