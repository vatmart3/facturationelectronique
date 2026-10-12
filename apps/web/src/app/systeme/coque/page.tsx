import type { Metadata } from 'next'
import { CoqueApp } from '@/components/coque/CoqueApp'
import { Avatar } from '@/components/ui/Avatar'
import { Bouton } from '@/components/ui/Bouton'
import { Categorie, type CleCategorie } from '@/components/ui/Categorie'
import { EnTeteVue } from '@/components/ui/EnTeteVue'
import { Message } from '@/components/ui/Message'
import { Tableau, Td, Th } from '@/components/ui/Tableau'
import { formatMontant, grouperChiffres } from '@/lib/format'

export const metadata: Metadata = { title: 'Aperçu de la coque' }

const CLIENTS: Array<{ nom: string; detail: string; categorie: CleCategorie; id: string; encours: number; ca: number; delai: number | null }> = [
  { nom: 'Atelier Dupont', detail: 'SARL · Nantes', categorie: 'b2b', id: grouperChiffres('732829320'), encours: 421800, ca: 2864000, delai: 28 },
  { nom: 'Cabinet Leroy Avocats', detail: 'SELARL · Paris', categorie: 'b2b', id: grouperChiffres('404833048'), encours: 132000, ca: 1584000, delai: 35 },
  { nom: 'Hofmann GmbH', detail: 'GmbH · Hambourg', categorie: 'ue', id: 'DE811234567', encours: 540000, ca: 1620000, delai: 32 },
  { nom: 'Mairie de Vannes', detail: 'Collectivité · Vannes', categorie: 'b2g', id: '—', encours: 294000, ca: 1176000, delai: 41 },
  { nom: 'Jeanne Morel', detail: 'Rennes', categorie: 'b2c', id: '—', encours: 0, ca: 96000, delai: 3 },
]

/** Démonstration de la coque applicative avec des données d'exemple, sans Supabase. */
export default function ApercuCoque() {
  return (
    <CoqueApp
      organisation={{ slug: 'demo', nom: 'Atelier Lumen', detail: 'SAS · Réel normal' }}
      organisations={[
        { slug: 'demo', nom: 'Atelier Lumen', role: 'owner' },
        { slug: 'studio-nebuleuse', nom: 'Studio Nébuleuse', role: 'admin' },
      ]}
      utilisateur={{ email: 'camille@atelier-lumen.fr', nom: 'Camille Roux' }}
    >
      <Message ton="info">Aperçu de démonstration : les liens mènent à la connexion, les données sont fictives.</Message>
      <EnTeteVue
        titre="Clients"
        description={`${CLIENTS.length} clients · encours ${formatMontant(CLIENTS.reduce((s, c) => s + c.encours, 0))}`}
        actions={
          <>
            <Bouton>Importer CSV</Bouton>
            <Bouton variante="primaire">Nouveau client</Bouton>
          </>
        }
      />
      <Tableau legende="Clients (exemple)">
        <thead>
          <tr>
            <Th>Client</Th>
            <Th>Catégorie</Th>
            <Th>Identifiant</Th>
            <Th numerique>Encours</Th>
            <Th numerique>CA 12 mois</Th>
            <Th numerique>Délai moyen</Th>
          </tr>
        </thead>
        <tbody>
          {CLIENTS.map((c) => (
            <tr key={c.nom}>
              <Td>
                <span className="flex items-center gap-2.5">
                  <Avatar nom={c.nom} />
                  <span className="flex flex-col leading-tight">
                    <span className="whitespace-nowrap font-semibold">{c.nom}</span>
                    <span className="whitespace-nowrap text-[12px] text-encre-3">{c.detail}</span>
                  </span>
                </span>
              </Td>
              <Td>
                <Categorie categorie={c.categorie} />
              </Td>
              <Td className="num text-encre-3">{c.id}</Td>
              <Td numerique className={c.categorie === 'b2g' ? 'text-alerte' : undefined}>
                {c.encours ? formatMontant(c.encours) : '—'}
              </Td>
              <Td numerique>{formatMontant(c.ca)}</Td>
              <Td numerique>{c.delai ? `${c.delai} j` : '—'}</Td>
            </tr>
          ))}
        </tbody>
      </Tableau>
    </CoqueApp>
  )
}
