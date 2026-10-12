import type { Metadata } from 'next'
import Link from 'next/link'
import { modifierNom, supprimerCompte } from '@/app/actions/rgpd'
import { ChoixTheme } from '@/components/coque/Theme'
import { ChampSuivi, FormulaireSuivi } from '@/components/documents/Suivi'
import { Logo } from '@/components/marque/Logo'
import { classesBouton } from '@/components/ui/Bouton'
import { Icone } from '@/components/ui/Icone'
import { Panneau, PanneauCorps, PanneauTete } from '@/components/ui/Panneau'
import { LIBELLES_ROLE } from '@/lib/roles'
import { exigerUtilisateur, listerOrganisations } from '@/lib/session'

export const metadata: Metadata = { title: 'Mon compte' }

const CHAMP = 'h-[34px] w-full rounded-m border border-trait-fort bg-surface px-2.5 text-[13.5px] font-normal text-encre outline-none focus:border-accent'

export default async function Compte() {
  const utilisateur = await exigerUtilisateur()
  const organisations = await listerOrganisations()
  const retour = organisations[0] ? `/${organisations[0].slug}/tableau-de-bord` : '/bienvenue'

  return (
    <main className="min-h-dvh bg-fond px-4 py-8">
      <div className="mx-auto flex max-w-[720px] flex-col gap-5">
        <div className="flex items-center justify-between">
          <Logo />
          <Link href={retour} className="inline-flex items-center gap-1 text-[13px] text-encre-2 hover:text-encre">
            <Icone nom="chevron-gauche" taille={13} />
            Retour à l’application
          </Link>
        </div>
        <h1 className="text-[24px] font-bold">Mon compte</h1>
        <Panneau>
          <PanneauTete titre="Profil" description={utilisateur.email} />
          <PanneauCorps>
            <FormulaireSuivi action={modifierNom} bouton="Enregistrer" variante="secondaire">
              <ChampSuivi libelle="Nom et prénom">
                <input name="nom" defaultValue={utilisateur.nom ?? ''} maxLength={200} className={CHAMP} />
              </ChampSuivi>
            </FormulaireSuivi>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13.5px] font-medium">Thème</span>
              <ChoixTheme className="w-60" />
            </div>
          </PanneauCorps>
        </Panneau>
        <Panneau>
          <PanneauTete titre="Mes entreprises" />
          <ul className="m-0 flex list-none flex-col p-0">
            {organisations.map((o) => (
              <li key={o.id} className="flex items-center justify-between border-b border-trait px-[18px] py-2.5 text-[13.5px] last:border-b-0">
                <Link href={`/${o.slug}/tableau-de-bord`} className="font-medium hover:underline">
                  {o.nom}
                </Link>
                <span className="text-encre-3">{LIBELLES_ROLE[o.role]}</span>
              </li>
            ))}
            {organisations.length === 0 && <li className="px-[18px] py-3 text-[13.5px] text-encre-3">Aucune entreprise.</li>}
          </ul>
        </Panneau>
        <Panneau>
          <PanneauTete titre="Mes données" description="Règlement général sur la protection des données (RGPD)" />
          <PanneauCorps>
            <p className="text-[13.5px] text-encre-2">
              Téléchargez à tout moment l’ensemble de vos données : profil, entreprises, clients, catalogue, documents, paiements. Les données sont
              hébergées dans l’Union européenne.
            </p>
            {/* Route de téléchargement (archive ZIP), pas une page : un lien classique avec « download ». */}
            <a href="/compte/export" download className={`${classesBouton('secondaire')} self-start`}>
              Exporter toutes mes données
            </a>
          </PanneauCorps>
        </Panneau>
        <Panneau className="border-alerte/40">
          <PanneauTete titre="Supprimer mon compte" />
          <PanneauCorps>
            <p className="text-[13.5px] text-encre-2">
              Votre compte et vos accès sont supprimés définitivement. Une entreprise dont vous êtes le seul membre est supprimée si elle n’a émis
              aucune facture. Si elle en a émis, elle est close mais ses factures sont conservées pendant la durée légale de 10 ans (article L102 B du
              livre des procédures fiscales) : pensez à les exporter d’abord.
            </p>
            <FormulaireSuivi action={supprimerCompte} bouton="Supprimer définitivement" variante="secondaire">
              <ChampSuivi libelle="Tapez SUPPRIMER pour confirmer">
                <input name="confirmation" autoComplete="off" className={CHAMP} />
              </ChampSuivi>
            </FormulaireSuivi>
          </PanneauCorps>
        </Panneau>
      </div>
    </main>
  )
}
