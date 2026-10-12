import type { Metadata } from 'next'
import { Logo } from '@/components/marque/Logo'
import { Avatar } from '@/components/ui/Avatar'
import { Bouton } from '@/components/ui/Bouton'
import { Categorie, CATEGORIES, Etiquette, type CleCategorie } from '@/components/ui/Categorie'
import { Case, Champ, Selection } from '@/components/ui/Champ'
import { EnTeteVue } from '@/components/ui/EnTeteVue'
import { EtatVide } from '@/components/ui/EtatVide'
import { Indicateurs } from '@/components/ui/Indicateurs'
import { Kbd, Message } from '@/components/ui/Message'
import { ListeCles, Panneau, PanneauCorps, PanneauTete } from '@/components/ui/Panneau'
import { Statut, type CleStatut } from '@/components/ui/Statut'
import { Tableau, Td, Th } from '@/components/ui/Tableau'
import { formatMontant } from '@/lib/format'

export const metadata: Metadata = { title: 'Design system' }

const COULEURS = [
  ['fond', 'Fond de page'],
  ['surface', 'Panneaux, tableaux'],
  ['surface-2', 'Barre latérale, en-têtes'],
  ['trait', 'Bordures'],
  ['encre-3', 'Texte tertiaire'],
  ['encre-2', 'Texte secondaire'],
  ['encre', 'Texte, bouton principal'],
  ['accent', 'Lien, sélection, focus'],
  ['marque', 'Logo uniquement'],
] as const

const EXEMPLES: Array<{ numero: string; client: string; categorie: CleCategorie; montant: number; statut: CleStatut }> = [
  { numero: 'F-2026-0042', client: 'Atelier Dupont', categorie: 'b2b', montant: 421800, statut: 'envoyee' },
  { numero: 'F-2026-0041', client: 'Boulangerie Kerlann', categorie: 'b2b', montant: 86400, statut: 'payee' },
  { numero: 'F-2026-0039', client: 'Mairie de Vannes', categorie: 'b2g', montant: 294000, statut: 'retard' },
  { numero: 'A-2026-0003', client: 'Hofmann GmbH', categorie: 'ue', montant: -24000, statut: 'avoir' },
]

/** Référence vivante des composants. Données d'exemple uniquement. */
export default function Systeme() {
  return (
    <main className="mx-auto flex max-w-[1100px] flex-col gap-10 px-4 py-10 sm:px-8">
      <div className="flex items-center justify-between gap-4">
        <Logo />
        <span className="surtitre">Design system · phase 1</span>
      </div>
      <EnTeteVue
        titre="Design system"
        description="Tokens et composants de base. Toutes les données affichées sont des exemples."
      />

      <section className="flex flex-col gap-4" aria-labelledby="t-couleurs">
        <h2 id="t-couleurs" className="text-[18px] font-semibold">Couleurs</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {COULEURS.map(([token, role]) => (
            <div key={token} className="flex flex-col gap-1.5 text-[12px]">
              <span className="h-11 rounded-m border border-trait" style={{ background: `var(--${token})` }} />
              <code className="font-chiffre text-[11.5px]">--{token}</code>
              <span className="text-encre-3">{role}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="t-puces">
        <h2 id="t-puces" className="text-[18px] font-semibold">Statuts et catégories</h2>
        <div className="flex flex-wrap gap-2">
          {(['brouillon', 'envoyee', 'retard', 'payee', 'avoir', 'annulee', 'acceptee', 'refusee'] as const).map((s) => (
            <Statut key={s} statut={s} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(CATEGORIES) as CleCategorie[]).map((c) => (
            <Categorie key={c} categorie={c} />
          ))}
          <Etiquette>Reçoit les factures</Etiquette>
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="t-boutons">
        <h2 id="t-boutons" className="text-[18px] font-semibold">Boutons</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Bouton variante="primaire" icone="plus">
            Nouvelle facture
          </Bouton>
          <Bouton>Dupliquer</Bouton>
          <Bouton variante="fantome">Annuler</Bouton>
          <Bouton variante="danger">Retirer</Bouton>
          <Bouton taille="s">Petit</Bouton>
          <Bouton chargement>Génération du PDF</Bouton>
          <Bouton disabled>Indisponible</Bouton>
          <span className="flex items-center gap-1.5 text-[13px] text-encre-3">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="t-champs">
        <h2 id="t-champs" className="text-[18px] font-semibold">Champs</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Champ libelle="SIREN du client" defaultValue="732 829 320" chiffres icone="entreprise" aide="9 chiffres, obligatoire en B2B France." />
          <Champ libelle="Prix unitaire" defaultValue="450,00" chiffres suffixe="€ HT" />
          <Champ libelle="IBAN" defaultValue="FR76 3000 6000 0112" chiffres erreur="IBAN incomplet : il manque 11 caractères." />
          <Selection
            libelle="Régime de TVA"
            defaultValue="reel_normal"
            options={[
              { valeur: 'franchise', libelle: 'Franchise en base' },
              { valeur: 'reel_normal', libelle: 'Réel normal' },
            ]}
          />
          <Champ libelle="Référence de commande" facultatif placeholder="BC-2026-118" />
          <Case libelle="TVA sur les débits" aide="Mention ajoutée sur les factures." defaultChecked />
        </div>
        <div className="flex flex-col gap-2">
          <Message ton="succes">Identité de l’entreprise enregistrée.</Message>
          <Message ton="erreur">SIREN invalide : 9 chiffres avec une clé de contrôle correcte.</Message>
          <Message ton="info">Seuls les propriétaires et administrateurs peuvent modifier l’identité.</Message>
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="t-donnees">
        <h2 id="t-donnees" className="text-[18px] font-semibold">Données</h2>
        <Indicateurs
          indicateurs={[
            { libelle: 'Encaissé ce mois', valeur: formatMontant(1824000), detail: '6 paiements', ton: 'ok' },
            { libelle: 'En attente', valeur: formatMontant(1279800), detail: '4 factures', ton: 'info' },
            { libelle: 'En retard', valeur: formatMontant(294000), detail: '1 facture, 12 jours', ton: 'alerte' },
            { libelle: 'Chiffre d’affaires HT', valeur: formatMontant(9840000), detail: 'Exercice 2026' },
          ]}
        />
        <Tableau legende="Exemple de liste de factures">
          <thead>
            <tr>
              <Th>Numéro</Th>
              <Th>Client</Th>
              <Th>Catégorie</Th>
              <Th numerique>Montant TTC</Th>
              <Th>Statut</Th>
            </tr>
          </thead>
          <tbody>
            {EXEMPLES.map((f) => (
              <tr key={f.numero}>
                <Td className="num">{f.numero}</Td>
                <Td>
                  <span className="flex items-center gap-2.5">
                    <Avatar nom={f.client} />
                    <span className="font-semibold">{f.client}</span>
                  </span>
                </Td>
                <Td>
                  <Categorie categorie={f.categorie} />
                </Td>
                <Td numerique>{formatMontant(f.montant)}</Td>
                <Td>
                  <Statut statut={f.statut} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Tableau>
        <div className="grid gap-4 md:grid-cols-2">
          <Panneau>
            <PanneauTete titre="Réglages commerciaux" actions={<Bouton variante="fantome" taille="s">Modifier</Bouton>} />
            <PanneauCorps>
              <ListeCles
                lignes={[
                  ['TVA par défaut', '20 %'],
                  ['Conditions de paiement', '30 jours fin de mois'],
                  ['Remise par défaut', '5 %'],
                  ['Langue · devise', 'Français · EUR'],
                ]}
              />
            </PanneauCorps>
          </Panneau>
          <EtatVide titre="Aucun client pour l’instant">
            <p>Ajoutez un client ou importez un fichier CSV.</p>
          </EtatVide>
        </div>
      </section>
    </main>
  )
}
