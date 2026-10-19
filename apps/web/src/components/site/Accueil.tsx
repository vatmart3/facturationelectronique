import Link from 'next/link'
import { Chronometre, Simulateur } from '@/components/site/Interactif'
import { CTA, PageSite } from '@/components/site/Site'
import { classesBouton } from '@/components/ui/Bouton'
import { Icone } from '@/components/ui/Icone'
import { IconeObjet } from '@/components/ui/IconeObjet'
import type { IconeNav } from '@/lib/navigation'
import { cn } from '@/lib/cn'
import { formatMontant } from '@/lib/format'
import { OFFRES } from '@/lib/offres'
import { EMISSION_PME_TPE, joursAvant } from '@/lib/reforme'

const LIGNES = [
  ['Identité visuelle', '2', '420,00 €', '840,00 €'],
  ['Site vitrine, 5 pages', '1', '1 800,00 €', '1 800,00 €'],
  ['Impression de cartes', '500', '0,30 €', '150,00 €'],
] as const

const FONCTIONS: Array<{ icone: IconeNav; titre: string; texte: string }> = [
  { icone: 'reforme', titre: 'Factur-X conforme, contrôlé', texte: 'Chaque facture est un PDF/A-3 avec son XML EN 16931, validé par les règles officielles avant de partir.' },
  { icone: 'recues', titre: 'Plateforme agréée et e-reporting', texte: 'Transmission, suivi du cycle de vie, factures fournisseurs reçues et e-reporting au même endroit.' },
  { icone: 'relances', titre: 'Relances automatiques', texte: 'Rappel avant l’échéance, relances graduées ensuite, facture jointe et lien de paiement. Vous ne courez plus après.' },
  { icone: 'devis', titre: 'Devis signés en ligne', texte: 'Votre client accepte d’un clic, l’acompte part, la facture de solde déduit tout automatiquement.' },
  { icone: 'recurrence', titre: 'Factures récurrentes', texte: 'Abonnements, maintenance, loyers : préparées ou émises toutes seules, chaque mois ou chaque trimestre.' },
  { icone: 'exports', titre: 'Exports pour le comptable', texte: 'FEC, journal des ventes, état de TVA et archive de toutes les factures, ou un accès invité en lecture.' },
]

const COMPARATIF: Array<[string, string, string]> = [
  ['Temps pour une facture', '10 à 15 minutes', '30 secondes'],
  ['Numérotation sans trou', 'À surveiller soi-même', 'Garantie, même à plusieurs'],
  ['Mentions légales', 'Copiées, souvent incomplètes', 'Ajoutées et vérifiées'],
  ['Format électronique 2027', 'Impossible', 'Factur-X, UBL, CII'],
  ['Transmission à la plateforme', 'Manuelle', 'Automatique'],
  ['Relances', 'Quand on y pense', 'Programmées'],
]

export const FAQ: Array<[string, string]> = [
  [
    'Qui est concerné par la facturation électronique, et quand ?',
    'Toutes les entreprises assujetties à la TVA en France. Depuis le 1er septembre 2026, toutes doivent pouvoir recevoir des factures électroniques, et les grandes entreprises et ETI les émettent. Au 1er septembre 2027, les PME, TPE et micro-entreprises devront aussi les émettre.',
  ],
  [
    'Un PDF envoyé par email suffira-t-il encore ?',
    'Non. Entre entreprises françaises, la facture devra être structurée (Factur-X, UBL ou CII) et transmise via une plateforme agréée par l’administration. Pastille produit ces formats et s’occupe de la transmission.',
  ],
  [
    'Qu’est-ce qu’une plateforme agréée ?',
    'Un opérateur immatriculé par la DGFiP qui transmet vos factures à celles de vos clients, reçoit les vôtres et communique à l’administration les données nécessaires. Pastille se connecte à votre plateforme.',
  ],
  [
    'Et mes clients particuliers ou étrangers ?',
    'Ils continuent de recevoir une facture classique. Les montants sont en revanche déclarés à l’administration par l’e-reporting, que Pastille prépare et transmet.',
  ],
  [
    'Que risque-t-on en cas de non-conformité ?',
    'Une amende de 15 € par facture non émise au format électronique, et de 250 € par manquement à l’e-reporting, chacune plafonnée à 15 000 € par an.',
  ],
  [
    'Puis-je partir avec mes données ?',
    'À tout moment : export complet de vos données et de toutes vos factures (PDF et XML), sans frais. Les données sont hébergées dans l’Union européenne.',
  ],
]

export function Accueil() {
  const jours = joursAvant(EMISSION_PME_TPE)
  return (
    <PageSite>
      {/* Accroche */}
      <section className="border-b border-trait bg-surface">
        <div className="mx-auto grid max-w-[1120px] items-center gap-12 px-4 pb-16 pt-12 lg:grid-cols-[minmax(0,1fr)_470px] lg:pb-20 lg:pt-20">
          <div className="flex flex-col gap-5">
            <p className="surtitre text-accent">Réforme de la facturation électronique 2026-2027</p>
            <h1 className="text-[40px] font-bold leading-[1.08] tracking-[-0.025em] sm:text-[52px]">Une facture conforme en 30 secondes.</h1>
            <p className="max-w-[54ch] text-[18px] text-encre-2">
              Pastille crée vos devis et factures, les transmet au format exigé en 2027 et relance vos clients. Vous facturez, la conformité suit.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/inscription" className={cn(classesBouton('primaire'), 'h-11 px-5 text-[15px]')}>
                {CTA}
              </Link>
              <Link href="/tarifs" className={cn(classesBouton('secondaire'), 'h-11 px-5 text-[15px]')}>
                Voir les tarifs
              </Link>
            </div>
            <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-[13.5px] text-encre-2">
              {['14 jours gratuits, sans carte', 'Factur-X EN 16931', 'Données hébergées en UE'].map((x) => (
                <li key={x} className="flex items-center gap-1.5">
                  <Icone nom="coche" taille={15} className="text-ok" />
                  {x}
                </li>
              ))}
            </ul>
          </div>
          <FactureAnimee />
        </div>
      </section>

      {/* Urgence réelle */}
      <section className="border-b border-trait bg-surface-2">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4 px-4 py-6">
          <p className="text-[16.5px]">
            Votre obligation d’émettre des factures électroniques commence dans{' '}
            <strong className="font-titre text-[24px] tabular-nums">{jours}</strong> jours.
          </p>
          <Link href="/facturation-electronique-2027" className="text-[14px] font-semibold text-accent hover:underline">
            Ce qui change, en clair
          </Link>
        </div>
      </section>

      {/* Preuve par la vitesse et simulateur */}
      <section className="mx-auto flex max-w-[1120px] flex-col gap-8 px-4 py-16">
        <div className="max-w-[640px]">
          <h2 className="text-[30px] font-bold leading-tight tracking-tight">
            Facture créée en <Chronometre /> secondes.
          </h2>
          <p className="mt-2 text-[16px] text-encre-2">
            Choisissez le client, tapez « 3 x Logo 450 », appuyez sur Entrée. Les prix du client, la TVA, les mentions et l’échéance se remplissent seuls.
          </p>
        </div>
        <Simulateur />
      </section>

      {/* Fonctionnalités */}
      <section id="fonctionnalites" className="py-16">
        <div className="mx-auto max-w-[1120px] px-4">
          <p className="surtitre text-accent">Fonctionnalités</p>
          <h2 className="mt-1 text-[32px] font-bold tracking-tight">Tout ce qu’exige la réforme, sans y penser</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FONCTIONS.map((f) => (
              <div key={f.titre} className="flex flex-col gap-2.5 rounded-l border border-trait bg-surface p-6">
                <IconeObjet icone={f.icone} taille="m" />
                <h3 className="text-[16px] font-semibold">{f.titre}</h3>
                <p className="text-[14px] text-encre-2">{f.texte}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Avant / après */}
      <section className="mx-auto max-w-[1120px] px-4 py-16">
        <h2 className="text-[30px] font-bold tracking-tight">Word et Excel, ou Pastille</h2>
        <div role="region" aria-label="Comparatif" tabIndex={0} className="mt-6 overflow-x-auto rounded-l border border-trait bg-surface">
          <table className="w-full min-w-[560px] border-collapse text-[14px]">
            <thead>
              <tr className="bg-surface-2 text-left text-[12px] uppercase tracking-[0.05em] text-encre-3">
                <th scope="col" className="px-4 py-3 font-semibold">
                  <span className="sr-only">Critère</span>
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Word, Excel
                </th>
                <th scope="col" className="px-4 py-3 font-semibold text-accent">
                  Pastille
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARATIF.map(([c, avant, apres]) => (
                <tr key={c} className="border-t border-trait">
                  <th scope="row" className="px-4 py-3 text-left font-medium">
                    {c}
                  </th>
                  <td className="px-4 py-3 text-encre-3">{avant}</td>
                  <td className="px-4 py-3 font-medium">
                    <span className="flex items-center gap-2">
                      <Icone nom="coche" taille={15} className="shrink-0 text-ok" />
                      {apres}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Tarifs />

      {/* Réduction du risque */}
      <section className="border-y border-trait bg-surface">
        <ul className="mx-auto grid max-w-[1120px] list-none gap-4 px-4 py-8 text-[14px] sm:grid-cols-4">
          {['Essai de 14 jours sans carte', 'Export de toutes vos données à tout moment', 'Données hébergées dans l’Union européenne', 'Sans engagement, résiliable en un clic'].map((x) => (
            <li key={x} className="flex items-start gap-2">
              <Icone nom="coche" taille={16} className="mt-0.5 shrink-0 text-ok" />
              {x}
            </li>
          ))}
        </ul>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-[820px] px-4 py-16">
        <h2 className="text-[30px] font-bold tracking-tight">Vos questions sur la réforme</h2>
        <div className="mt-6 flex flex-col gap-2">
          {FAQ.map(([q, r]) => (
            <details key={q} className="group rounded-l border border-trait bg-surface px-5 py-4">
              <summary className="cursor-pointer list-none text-[15.5px] font-semibold marker:hidden">
                <span className="flex items-center justify-between gap-3">
                  {q}
                  <span className="text-encre-3 transition-transform group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-2 text-[15px] text-encre-2">{r}</p>
            </details>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center gap-3 rounded-l border border-trait bg-surface px-6 py-10 text-center">
          <p className="text-[24px] font-bold">Prêt avant le 1er septembre 2027.</p>
          <p className="max-w-[46ch] text-[15px] text-encre-2">Créez votre compte, ajoutez un client, émettez une facture conforme : tout tient dans les 14 jours d’essai.</p>
          <Link href="/inscription" className={cn(classesBouton('primaire'), 'mt-1 h-11 px-5 text-[15px]')}>
            {CTA}
          </Link>
        </div>
      </section>
    </PageSite>
  )
}

export function Tarifs({ titre = 'Un prix simple, sans surprise' }: { titre?: string }) {
  return (
    <section id="tarifs" className="border-y border-trait bg-surface-2 py-16">
      <div className="mx-auto max-w-[1120px] px-4">
        <h2 className="text-[30px] font-bold tracking-tight">{titre}</h2>
        <p className="mt-2 text-[15px] text-encre-2">Prix HT par mois et par entreprise. 14 jours d’essai gratuit sur l’offre Pro, sans carte bancaire.</p>
        <div className="mt-8 grid items-stretch gap-4 md:grid-cols-3">
          {OFFRES.map((o) => {
            const mise = o.code === 'pro'
            return (
              <div key={o.code} className={cn('relative flex flex-col gap-4 rounded-l border bg-surface p-6', mise ? 'border-accent shadow-haute md:-my-3 md:py-9' : 'border-trait')}>
                {mise && <span className="absolute -top-3 left-6 rounded-full bg-accent px-3 py-1 text-[12px] font-semibold text-sur-accent">Le plus choisi</span>}
                <div>
                  <h3 className="text-[18px] font-semibold">{o.nom}</h3>
                  <p className="text-[13.5px] text-encre-3">{o.cible}</p>
                </div>
                <p>
                  <span className="font-titre text-[38px] font-bold tabular-nums">{formatMontant(o.prix).replace(',00', '')}</span>
                  <span className="text-[14px] text-encre-3"> HT / mois</span>
                </p>
                <ul className="m-0 flex flex-1 list-none flex-col gap-2 p-0 text-[14px]">
                  {o.points.map((p) => (
                    <li key={p} className="flex items-start gap-2">
                      <Icone nom="coche" taille={15} className="mt-0.5 shrink-0 text-accent" />
                      {p}
                    </li>
                  ))}
                </ul>
                <Link href="/inscription" className={cn(classesBouton(mise ? 'primaire' : 'secondaire'), 'h-10')}>
                  {mise ? CTA : 'Essayer gratuitement'}
                </Link>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/** Aperçu d'une facture qui se construit ligne par ligne, puis reçoit le tampon « ÉMISE ». */
function FactureAnimee() {
  const pas = (i: number) => ({ animationDelay: `${300 + i * 380}ms` })
  return (
    <div className="relative rounded-l border border-trait bg-[#fff] p-6 text-[12.5px] text-[#1d1f24] shadow-haute" aria-label="Exemple de facture émise avec Pastille" role="img">
      <div className="construction flex items-start justify-between" style={pas(0)}>
        <div>
          <p className="text-[14px] font-bold">Atelier Lumen</p>
          <p className="text-[#4d535d]">12 rue des Lilas, 75011 Paris</p>
        </div>
        <div className="text-right">
          <p className="text-[18px] font-bold text-[#1f3a5f]">Facture</p>
          <p className="font-semibold tabular-nums">N° F-2027-0042</p>
        </div>
      </div>
      <div className="construction mt-4 rounded-[8px] bg-[#f4f5f7] p-3" style={pas(1)}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#5b616c]">Facturé à</p>
        <p className="font-semibold">Maison Dupont SAS</p>
        <p className="text-[#4d535d]">SIREN 404 833 048</p>
      </div>
      <table className="mt-4 w-full border-collapse">
        <tbody>
          {LIGNES.map(([d, q, pu, t], i) => (
            <tr key={d} className="construction border-b border-[#e6e7ea]" style={pas(2 + i)}>
              <td className="py-1.5">{d}</td>
              <td className="py-1.5 text-right tabular-nums text-[#4d535d]">{q}</td>
              <td className="py-1.5 text-right tabular-nums text-[#4d535d]">{pu}</td>
              <td className="py-1.5 text-right font-medium tabular-nums">{t}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="construction ml-auto mt-3 w-[210px]" style={pas(5)}>
        <p className="flex justify-between">
          <span>Total HT</span>
          <span className="tabular-nums">2 790,00 €</span>
        </p>
        <p className="flex justify-between text-[#4d535d]">
          <span>TVA 20 %</span>
          <span className="tabular-nums">558,00 €</span>
        </p>
        <p className="mt-1 flex justify-between rounded-[5px] bg-[#1f3a5f] px-2 py-1 font-bold text-[#fff]">
          <span>Net à payer</span>
          <span className="tabular-nums">3 348,00 €</span>
        </p>
      </div>
      <p className="construction mt-3 text-[10px] text-[#5b616c]" style={pas(6)}>
        Factur-X EN 16931 · transmis via la plateforme agréée
      </p>
      <p className="tampon absolute right-6 top-24 rounded-[4px] border-2 border-[#17734b] bg-[#fff] px-3 py-1 text-[16px] font-bold uppercase tracking-[0.2em] text-[#17734b]" style={pas(7)}>
        Émise
      </p>
    </div>
  )
}
