import { signatureValide, versAbonnement, type AbonnementStripe } from '@/lib/stripe'
import { creerClientService } from '@/lib/supabase/service'

/** Notifications Stripe : création, mise à jour et fin des abonnements. */
export async function POST(requete: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const supabase = creerClientService()
  if (!secret || !supabase) return new Response('Non configuré', { status: 503 })
  const corps = await requete.text()
  if (!signatureValide(corps, requete.headers.get('stripe-signature'), secret)) return new Response('Signature invalide', { status: 400 })

  const evenement = JSON.parse(corps) as { type: string; data: { object: Record<string, unknown> } }
  const objet = evenement.data.object
  if (evenement.type.startsWith('customer.subscription.')) {
    const s = objet as unknown as AbonnementStripe
    const organisation = s.metadata?.organization_id
    if (!organisation) return Response.json({ ignore: 'sans organisation' })
    const { error } = await supabase.from('subscriptions').upsert({ organization_id: organisation, ...versAbonnement(s) }, { onConflict: 'organization_id' })
    if (error) {
      await supabase.from('error_logs').insert({ organization_id: organisation, kind: 'stripe', message: error.message, context: { type: evenement.type } })
      return new Response('Erreur', { status: 500 })
    }
  } else if (evenement.type === 'checkout.session.completed') {
    const organisation = (objet.client_reference_id as string | null) ?? null
    const client = objet.customer as string | null
    if (organisation && client) await supabase.from('subscriptions').update({ stripe_customer_id: client }).eq('organization_id', organisation)
  }
  return Response.json({ recu: true })
}
