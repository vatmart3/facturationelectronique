import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { CodeOffre } from './offres'

/**
 * Stripe Billing via l'API REST (pas de SDK) : session de paiement d'abonnement,
 * portail client, vérification des notifications. Variables : STRIPE_SECRET_KEY,
 * STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_SOLO, STRIPE_PRICE_PRO, STRIPE_PRICE_STUDIO.
 */

export function stripeConfigure(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_SOLO && process.env.STRIPE_PRICE_PRO && process.env.STRIPE_PRICE_STUDIO)
}

export function prixStripe(plan: CodeOffre): string | undefined {
  return { solo: process.env.STRIPE_PRICE_SOLO, pro: process.env.STRIPE_PRICE_PRO, studio: process.env.STRIPE_PRICE_STUDIO }[plan]
}

export function offreDepuisPrix(prix: string | undefined): CodeOffre | null {
  if (!prix) return null
  if (prix === process.env.STRIPE_PRICE_SOLO) return 'solo'
  if (prix === process.env.STRIPE_PRICE_PRO) return 'pro'
  if (prix === process.env.STRIPE_PRICE_STUDIO) return 'studio'
  return null
}

/** Encodage « form » de l'API Stripe, objets imbriqués compris : a[b][c]=v. */
export function formulaire(valeurs: Record<string, unknown>, prefixe = ''): string[] {
  return Object.entries(valeurs).flatMap(([cle, v]) => {
    const nom = prefixe ? `${prefixe}[${cle}]` : cle
    if (v == null) return []
    if (typeof v === 'object') return formulaire(v as Record<string, unknown>, nom)
    return [`${encodeURIComponent(nom)}=${encodeURIComponent(String(v))}`]
  })
}

async function appel<T>(chemin: string, valeurs: Record<string, unknown>): Promise<T> {
  const r = await fetch(`https://api.stripe.com/v1/${chemin}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formulaire(valeurs).join('&'),
    signal: AbortSignal.timeout(15_000),
  })
  const corps = (await r.json()) as T & { error?: { message?: string } }
  if (!r.ok) throw new Error(corps.error?.message ?? `Stripe : erreur ${r.status}`)
  return corps
}

export async function sessionAbonnement(o: { organisationId: string; plan: CodeOffre; email: string; client: string | null; retour: string }): Promise<string> {
  const s = await appel<{ url: string }>('checkout/sessions', {
    mode: 'subscription',
    line_items: { 0: { price: prixStripe(o.plan), quantity: 1 } },
    client_reference_id: o.organisationId,
    customer: o.client ?? undefined,
    customer_email: o.client ? undefined : o.email,
    subscription_data: { metadata: { organization_id: o.organisationId } },
    metadata: { organization_id: o.organisationId },
    allow_promotion_codes: 'true',
    billing_address_collection: 'required',
    tax_id_collection: { enabled: 'true' },
    locale: 'fr',
    success_url: `${o.retour}?abonnement=ok`,
    cancel_url: o.retour,
  })
  return s.url
}

export async function sessionPortail(client: string, retour: string): Promise<string> {
  const s = await appel<{ url: string }>('billing_portal/sessions', { customer: client, return_url: retour, locale: 'fr' })
  return s.url
}

/** Vérifie l'en-tête Stripe-Signature (t=…,v1=…), tolérance de 5 minutes. */
export function signatureValide(corps: string, entete: string | null, secret: string, maintenant = Date.now()): boolean {
  if (!entete) return false
  const parties = Object.fromEntries(entete.split(',').map((p) => p.split('=') as [string, string]))
  const t = Number(parties.t)
  const v1 = entete
    .split(',')
    .filter((p) => p.startsWith('v1='))
    .map((p) => p.slice(3))
  if (!Number.isFinite(t) || Math.abs(maintenant / 1000 - t) > 300 || v1.length === 0) return false
  const attendu = createHmac('sha256', secret).update(`${t}.${corps}`).digest()
  return v1.some((s) => {
    const recu = Buffer.from(s, 'hex')
    return recu.length === attendu.length && timingSafeEqual(recu, attendu)
  })
}

export interface AbonnementStripe {
  id: string
  customer: string
  status: string
  cancel_at_period_end: boolean
  current_period_end?: number
  trial_end?: number | null
  metadata?: { organization_id?: string }
  items?: { data?: Array<{ price?: { id?: string }; current_period_end?: number }> }
}

/** Abonnement Stripe → ligne de la table subscriptions. */
export function versAbonnement(s: AbonnementStripe) {
  const statut = ['trialing', 'active', 'past_due', 'canceled', 'incomplete', 'unpaid'].includes(s.status) ? s.status : 'incomplete'
  const fin = s.current_period_end ?? s.items?.data?.[0]?.current_period_end
  return {
    plan: offreDepuisPrix(s.items?.data?.[0]?.price?.id) ?? 'pro',
    status: statut as 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'unpaid',
    current_period_end: fin ? new Date(fin * 1000).toISOString() : null,
    trial_ends_at: s.trial_end ? new Date(s.trial_end * 1000).toISOString() : null,
    cancel_at_period_end: s.cancel_at_period_end,
    stripe_customer_id: s.customer,
    stripe_subscription_id: s.id,
  }
}
