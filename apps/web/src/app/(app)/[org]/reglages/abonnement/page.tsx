import type { Metadata } from 'next'
import { choisirOffre, gererAbonnement } from '@/app/actions/compte'
import { BoutonAction } from '@/components/documents/Actions'
import { Message } from '@/components/ui/Message'
import { Panneau, PanneauCorps, PanneauTete } from '@/components/ui/Panneau'
import { Statut } from '@/components/ui/Statut'
import { cn } from '@/lib/cn'
import { formatDate, formatMontant } from '@/lib/format'
import { OFFRES } from '@/lib/offres'
import { chargerContexte } from '@/lib/session'
import { stripeConfigure } from '@/lib/stripe'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Abonnement' }

export default async function Abonnement({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ abonnement?: string }> }) {
  const { org } = await params
  const { abonnement: retour } = await searchParams
  const { organisation, roleReel, abonnement } = await chargerContexte(org)
  const supabase = await creerClientServeur()
  const { data: sub } = await supabase.from('subscriptions').select('*').eq('organization_id', organisation.id).maybeSingle()
  const gestion = roleReel === 'owner' || roleReel === 'admin'
  const payant = Boolean(sub?.stripe_subscription_id)

  return (
    <>
      {retour === 'ok' && <Message ton="succes">Merci ! Votre abonnement est en cours d’activation : il apparaît ici dans quelques secondes.</Message>}
      {!stripeConfigure() && (
        <Message ton="info">Le paiement en ligne n’est pas configuré sur cette installation : ajoutez les clés Stripe (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET et les trois STRIPE_PRICE_*).</Message>
      )}
      <Panneau>
        <PanneauTete
          titre="Votre abonnement"
          description={`${OFFRES.find((o) => o.code === abonnement.plan)?.nom} · ${abonnement.libelle}`}
          actions={<Statut statut={abonnement.ton === 'ok' ? 'payee' : abonnement.ton === 'attente' ? 'brouillon' : 'retard'} libelle={abonnement.actif ? 'Actif' : 'Inactif'} />}
        />
        <PanneauCorps>
          {!abonnement.actif && (
            <p className="text-[13.5px] text-encre-2">
              Vos factures restent consultables et téléchargeables à tout moment (obligation de conservation). Choisissez une offre pour créer et émettre de
              nouveaux documents.
            </p>
          )}
          {sub?.current_period_end && payant && <p className="text-[13.5px] text-encre-2">Prochaine échéance le {formatDate(sub.current_period_end)}.</p>}
          {payant && gestion && (
            <BoutonAction action={gererAbonnement.bind(null, org) as () => Promise<{ ok: false; erreur: string }>} variante="secondaire">
              Factures, moyen de paiement, résiliation
            </BoutonAction>
          )}
        </PanneauCorps>
      </Panneau>
      <div className="grid gap-[18px] md:grid-cols-3">
        {OFFRES.map((o) => {
          const actuelle = payant && abonnement.plan === o.code && abonnement.actif
          return (
            <section key={o.code} className={cn('flex flex-col gap-3 rounded-l border bg-surface p-5', o.code === 'pro' ? 'border-accent shadow-douce' : 'border-trait')}>
              <div>
                <h2 className="text-[16px] font-semibold">{o.nom}</h2>
                <p className="text-[12.5px] text-encre-3">{o.cible}</p>
              </div>
              <p>
                <span className="font-titre text-[28px] font-bold tabular-nums">{formatMontant(o.prix).replace(',00', '')}</span>
                <span className="text-[13px] text-encre-3"> HT / mois</span>
              </p>
              <ul className="m-0 flex flex-1 list-none flex-col gap-1.5 p-0 text-[13px] text-encre-2">
                {o.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              {gestion &&
                (actuelle ? (
                  <p className="text-[13px] font-medium text-ok">Offre actuelle</p>
                ) : (
                  <BoutonAction action={choisirOffre.bind(null, org, o.code) as () => Promise<{ ok: false; erreur: string }>} variante={o.code === 'pro' ? 'primaire' : 'secondaire'}>
                    {payant ? `Passer à ${o.nom.replace('Pastille ', '')}` : `Choisir ${o.nom.replace('Pastille ', '')}`}
                  </BoutonAction>
                ))}
            </section>
          )
        })}
      </div>
      <p className="text-[12.5px] text-encre-3">Sans engagement, résiliable à tout moment. Paiement sécurisé par Stripe. Une facture conforme vous est envoyée chaque mois.</p>
    </>
  )
}
