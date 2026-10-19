/** Lien de paiement en ligne : réglage de l'entreprise, exposé sur la page publique des factures à régler. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Banc, ouvrirBanc } from './base'

let banc: Banc
let alice: string
let org: string
let client: string

async function emise(type = 'facture', ttc = 12000): Promise<string> {
  const a = banc.enTantQue(alice)
  const { rows } = await a.query<{ id: string }>(
    "insert into documents (organization_id, type, client_id, issue_date, total_ttc, amount_due) values ($1, $2, $3, '2026-10-01', $4, $4) returning id",
    [org, type, client, ttc],
  )
  const id = rows[0]!.id
  await a.query("insert into document_lines (organization_id, document_id, position, designation, unit_price_cents) values ($1, $2, 1, 'Conseil', $3)", [org, id, ttc])
  await a.query('select emettre_document($1)', [id])
  return id
}

async function lienPublic(id: string) {
  const t = (await banc.enTantQue(alice).query('select lien_public($1) as t', [id])).rows[0].t
  return (await banc.enTantQue(null).query('select document_public($1) as d', [t])).rows[0].d
}

beforeAll(async () => {
  banc = await ouvrirBanc()
  alice = await banc.creerUtilisateur('alice@exemple.fr')
  org = (await banc.enTantQue(alice).query<{ id: string }>("select id from create_organization('Atelier')")).rows[0]!.id
  client = (await banc.enTantQue(alice).query<{ id: string }>("insert into clients (organization_id, kind, name) values ($1, 'b2c', 'Client') returning id", [org])).rows[0]!.id
})

afterAll(async () => {
  await banc?.fermer()
})

describe('lien de paiement en ligne', () => {
  it('se règle par l’entreprise, en https uniquement', async () => {
    const a = banc.enTantQue(alice)
    await expect(a.query("update organizations set payment_link = 'http://exemple.fr/payer' where id = $1", [org])).rejects.toThrow(/check/)
    await expect(a.query("update organizations set payment_link = 'https://exemple.fr/a b' where id = $1", [org])).rejects.toThrow(/check/)
    await a.query("update organizations set payment_link = 'https://buy.stripe.com/abc' where id = $1", [org])
  })

  it('figure sur la page publique d’une facture à régler, pas sur un devis ni une facture payée', async () => {
    const f = await emise()
    expect((await lienPublic(f)).paiement_en_ligne).toBe('https://buy.stripe.com/abc')
    expect((await lienPublic(await emise('devis'))).paiement_en_ligne).toBeNull()
    await banc.enTantQue(alice).query('insert into payments (organization_id, document_id, amount_cents) values ($1, $2, 12000)', [org, f])
    expect((await lienPublic(f)).paiement_en_ligne).toBeNull()
  })
})
