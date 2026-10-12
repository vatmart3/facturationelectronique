import type { Metadata } from 'next'
import Link from 'next/link'
import { EnTeteVue } from '@/components/ui/EnTeteVue'
import { Kbd } from '@/components/ui/Message'
import { Panneau, PanneauCorps, PanneauTete } from '@/components/ui/Panneau'

export const metadata: Metadata = { title: 'Aide' }

const TUTORIELS: Array<{ titre: string; etapes: string[]; lien?: [string, string] }> = [
  {
    titre: 'Faire une facture en 30 secondes',
    etapes: [
      'Appuyez sur N, ou sur « Nouvelle facture ».',
      'Choisissez le client : ses conditions, sa remise et ses prix s’appliquent seuls.',
      'Tapez « 3 x Création logo 450 » puis Entrée : quantité, désignation et prix en une fois. Un article du catalogue se propose dès les premières lettres.',
      'Vérifiez le panneau Conformité, puis Ctrl + Entrée pour émettre.',
    ],
    lien: ['ventes/factures/nouvelle', 'Créer une facture'],
  },
  {
    titre: 'Corriger une facture émise',
    etapes: [
      'Une facture émise ne se modifie plus : c’est la loi, et c’est ce qui garantit son intégrité.',
      'Ouvrez-la et choisissez « Créer un avoir ». L’avoir reprend toutes les lignes en négatif : retirez celles qui ne changent pas pour un avoir partiel.',
      'Émettez l’avoir, puis dupliquez la facture d’origine pour la refaire correctement.',
    ],
  },
  {
    titre: 'Devis, acompte et facture de solde',
    etapes: [
      'Finalisez le devis : il reçoit son numéro. Envoyez-le, votre client l’accepte en ligne.',
      'Depuis le devis accepté, facturez un acompte (30 % par exemple).',
      'À la livraison, « Transformer en facture » : les acomptes déjà facturés sont déduits automatiquement.',
    ],
    lien: ['ventes/devis/nouveau', 'Créer un devis'],
  },
  {
    titre: 'Être prêt pour la réforme',
    etapes: [
      'Complétez le SIREN et l’adresse de vos clients professionnels.',
      'Choisissez votre plateforme agréée dans Réforme 2027 et activez la transmission automatique.',
      'Chaque mois, déposez l’e-reporting de vos ventes aux particuliers et à l’étranger.',
    ],
    lien: ['e-facturation/reforme', 'Où j’en suis'],
  },
  {
    titre: 'Donner accès à votre expert-comptable',
    etapes: [
      'Réglages · Membres et rôles : invitez son adresse avec le rôle « Expert-comptable ».',
      'Il consulte vos factures et télécharge les exports (FEC, journal des ventes, état de TVA, archive) sans rien pouvoir modifier.',
    ],
    lien: ['reglages/membres', 'Inviter'],
  },
]

export default async function Aide({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params
  return (
    <>
      <EnTeteVue titre="Aide" description="Les gestes essentiels, en quelques étapes." />
      <Panneau>
        <PanneauTete titre="Raccourcis clavier" />
        <PanneauCorps>
          <ul className="m-0 grid list-none gap-2 p-0 text-[13.5px] sm:grid-cols-2">
            <li>
              <Kbd>N</Kbd> nouvelle facture
            </li>
            <li>
              <Kbd>Ctrl</Kbd> <Kbd>K</Kbd> rechercher et aller partout
            </li>
            <li>
              <Kbd>Entrée</Kbd> dans une ligne : ligne suivante
            </li>
            <li>
              <Kbd>Ctrl</Kbd> <Kbd>S</Kbd> enregistrer · <Kbd>Ctrl</Kbd> <Kbd>Entrée</Kbd> émettre
            </li>
          </ul>
        </PanneauCorps>
      </Panneau>
      <div className="grid gap-[18px] lg:grid-cols-2">
        {TUTORIELS.map((t) => (
          <Panneau key={t.titre}>
            <PanneauTete titre={t.titre} />
            <PanneauCorps>
              <ol className="m-0 flex flex-col gap-1.5 pl-5 text-[13.5px] text-encre-2">
                {t.etapes.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ol>
              {t.lien && (
                <Link href={`/${org}/${t.lien[0]}`} className="text-[13.5px] font-medium text-accent hover:underline">
                  {t.lien[1]}
                </Link>
              )}
            </PanneauCorps>
          </Panneau>
        ))}
      </div>
    </>
  )
}
