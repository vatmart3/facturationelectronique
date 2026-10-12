import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { formulaire, offreDepuisPrix, signatureValide, versAbonnement } from './stripe'

describe('Stripe', () => {
  beforeEach(() => {
    process.env.STRIPE_PRICE_SOLO = 'price_solo'
    process.env.STRIPE_PRICE_PRO = 'price_pro'
    process.env.STRIPE_PRICE_STUDIO = 'price_studio'
  })
  afterEach(() => {
    delete process.env.STRIPE_PRICE_SOLO
    delete process.env.STRIPE_PRICE_PRO
    delete process.env.STRIPE_PRICE_STUDIO
  })

  it('encode les paramètres imbriqués', () => {
    expect(formulaire({ mode: 'subscription', line_items: { 0: { price: 'p', quantity: 1 } }, vide: undefined, metadata: { organization_id: 'a b' } })).toEqual([
      'mode=subscription',
      'line_items%5B0%5D%5Bprice%5D=p',
      'line_items%5B0%5D%5Bquantity%5D=1',
      'metadata%5Borganization_id%5D=a%20b',
    ])
  })

  it('vérifie la signature des notifications', () => {
    const corps = '{"id":"evt_1"}'
    const t = 1_760_000_000
    const sig = createHmac('sha256', 'whsec').update(`${t}.${corps}`).digest('hex')
    expect(signatureValide(corps, `t=${t},v1=${sig}`, 'whsec', t * 1000)).toBe(true)
    expect(signatureValide(corps, `t=${t},v1=00${sig.slice(2)}`, 'whsec', t * 1000)).toBe(false)
    expect(signatureValide(corps, `t=${t},v1=${sig}`, 'whsec', (t + 600) * 1000)).toBe(false)
    expect(signatureValide(corps, null, 'whsec')).toBe(false)
    expect(signatureValide(corps, `t=${t}`, 'whsec', t * 1000)).toBe(false)
  })

  it('traduit un abonnement Stripe', () => {
    expect(offreDepuisPrix('price_studio')).toBe('studio')
    expect(offreDepuisPrix('autre')).toBeNull()
    expect(
      versAbonnement({ id: 'sub_1', customer: 'cus_1', status: 'active', cancel_at_period_end: false, items: { data: [{ price: { id: 'price_solo' }, current_period_end: 1_760_000_000 }] } }),
    ).toEqual({
      plan: 'solo',
      status: 'active',
      current_period_end: new Date(1_760_000_000_000).toISOString(),
      trial_ends_at: null,
      cancel_at_period_end: false,
      stripe_customer_id: 'cus_1',
      stripe_subscription_id: 'sub_1',
    })
    expect(versAbonnement({ id: 's', customer: 'c', status: 'paused', cancel_at_period_end: true, trial_end: 1_760_000_000 })).toMatchObject({ plan: 'pro', status: 'incomplete', current_period_end: null })
  })
})
