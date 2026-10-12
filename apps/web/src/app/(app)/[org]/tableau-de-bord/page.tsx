import type { Metadata } from 'next'
import Link from 'next/link'
import { EnTeteVue } from '@/components/ui/EnTeteVue'
import { Icone } from '@/components/ui/Icone'
import { Indicateurs } from '@/components/ui/Indicateurs'
import { Panneau, PanneauCorps, PanneauTete } from '@/components/ui/Panneau'
import { cn } from '@/lib/cn'
import { formatMontant } from '@/lib/format'
import { EMISSION_PME_TPE, joursAvant } from '@/lib/reforme'
import { chargerContexte } from '@/lib/session'

export const metadata: Metadata = { title: 'Tableau de bord' }

export default async function TableauDeBord({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params
  const { organisation, utilisateur } = await chargerContexte(org)
  const jours = joursAvant(EMISSION_PME_TPE)
  const mois = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date())

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
    { fait: false, titre: 'Ajouter un premier client', detail: 'Recherche par nom ou SIREN, ou import CSV.', href: `/${org}/clients/nouveau` },
    { fait: false, titre: 'Émettre une première facture', detail: 'Disponible en phase 4.', href: `/${org}/ventes/factures` },
  ]
  const faites = etapes.filter((e) => e.fait).length

  return (
    <>
      <EnTeteVue
        titre="Tableau de bord"
        description={<span className="first-letter:uppercase">{mois} · {organisation.name}</span>}
      />
      <Indicateurs
        indicateurs={[
          { libelle: 'Encaissé ce mois', valeur: formatMontant(0), detail: 'Aucun paiement', ton: 'ok' },
          { libelle: 'En attente', valeur: formatMontant(0), detail: 'Aucune facture envoyée', ton: 'info' },
          { libelle: 'En retard', valeur: formatMontant(0), detail: 'Rien en retard', ton: 'alerte' },
          { libelle: 'Chiffre d’affaires HT', valeur: formatMontant(0), detail: `Exercice ${new Date().getFullYear()}` },
        ]}
      />
      <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
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
