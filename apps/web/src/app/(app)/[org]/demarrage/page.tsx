import type { Metadata } from 'next'
import type { EtapeDemarrage } from '@/app/actions/organisation'
import { EtapesDemarrage } from '@/components/organisation/EtapesDemarrage'
import { Message } from '@/components/ui/Message'
import { cn } from '@/lib/cn'
import { peutModifierOrganisation } from '@/lib/roles'
import { chargerContexte } from '@/lib/session'

export const metadata: Metadata = { title: 'Configuration' }

const ETAPES: Array<{ cle: EtapeDemarrage; titre: string; description: string }> = [
  { cle: 'tva', titre: 'Régime de TVA', description: 'Il détermine les taux et les mentions appliqués par défaut.' },
  { cle: 'banque', titre: 'Paiement', description: 'Où et quand vos clients vous paient.' },
  { cle: 'apparence', titre: 'Apparence', description: 'Logo, modèle et couleur de vos factures.' },
  { cle: 'numerotation', titre: 'Numérotation', description: 'Un numéro unique, chronologique et sans trou.' },
  { cle: 'fin', titre: 'C’est prêt', description: 'Votre entreprise peut facturer.' },
]

export default async function Demarrage({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ etape?: string }> }) {
  const { org } = await params
  const { etape: demandee } = await searchParams
  const { organisation, role } = await chargerContexte(org)
  const index = Math.max(0, ETAPES.findIndex((e) => e.cle === demandee))
  const etape = ETAPES[index]!

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <p className="surtitre">
          Configuration · étape {index + 1} sur {ETAPES.length}
        </p>
        <h1 className="text-[24px] font-bold">{etape.titre}</h1>
        <p className="text-encre-2">{etape.description}</p>
      </div>
      <ol className="m-0 grid list-none grid-cols-5 gap-1.5 p-0" aria-label="Progression">
        {ETAPES.map((e, i) => (
          <li key={e.cle} className={cn('h-1.5 rounded-full', i <= index ? 'bg-accent' : 'bg-trait')}>
            <span className="sr-only">
              {e.titre} {i < index ? '(fait)' : i === index ? '(en cours)' : ''}
            </span>
          </li>
        ))}
      </ol>
      <div className="rounded-xl border border-trait bg-surface p-5 sm:p-6">
        {peutModifierOrganisation(role) ? (
          <EtapesDemarrage organisation={organisation} etape={etape.cle} />
        ) : (
          <Message ton="info">Seuls les propriétaires et administrateurs configurent l’entreprise.</Message>
        )}
      </div>
    </div>
  )
}
