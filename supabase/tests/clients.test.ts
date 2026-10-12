/** Clients, contacts, catalogue, prix par client et logos : isolation et droits. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Banc, ouvrirBanc } from './base'

let banc: Banc
let alice: string
let bruno: string
let lecteur: string
let orgA: string
let orgB: string
let clientA: string
let produitA: string
let clientB: string

beforeAll(async () => {
  banc = await ouvrirBanc()
  alice = await banc.creerUtilisateur('alice@exemple.fr')
  bruno = await banc.creerUtilisateur('bruno@exemple.fr')
  lecteur = await banc.creerUtilisateur('lecteur@exemple.fr')
  orgA = (await banc.enTantQue(alice).query<{ id: string }>("select id from create_organization('Atelier A')")).rows[0]!.id
  orgB = (await banc.enTantQue(bruno).query<{ id: string }>("select id from create_organization('Studio B')")).rows[0]!.id
  await banc.enTantQue(alice).query("insert into memberships (organization_id, user_id, role) values ($1, $2, 'viewer')", [orgA, lecteur])
  clientA = (
    await banc
      .enTantQue(alice)
      .query<{ id: string }>(
        "insert into clients (organization_id, kind, name, siren) values ($1, 'b2b', 'Atelier Dupont', '732829320') returning id",
        [orgA],
      )
  ).rows[0]!.id
  produitA = (
    await banc
      .enTantQue(alice)
      .query<{ id: string }>("insert into products (organization_id, name, unit_price_cents) values ($1, 'Création logo', 45000) returning id", [orgA])
  ).rows[0]!.id
  clientB = (
    await banc
      .enTantQue(bruno)
      .query<{ id: string }>("insert into clients (organization_id, kind, name) values ($1, 'b2c', 'Jeanne Morel') returning id", [orgB])
  ).rows[0]!.id
})

afterAll(async () => {
  await banc?.fermer()
})

describe('clients', () => {
  it('ne sont visibles que dans leur organisation', async () => {
    const a = await banc.enTantQue(alice).query('select name from clients')
    expect(a.rows.map((r) => r.name)).toEqual(['Atelier Dupont'])
    const b = await banc.enTantQue(bruno).query('select name from clients')
    expect(b.rows.map((r) => r.name)).toEqual(['Jeanne Morel'])
  })

  it('ne peuvent pas être créés dans une autre organisation', async () => {
    await expect(
      banc.enTantQue(bruno).query("insert into clients (organization_id, kind, name) values ($1, 'b2c', 'Intrus')", [orgA]),
    ).rejects.toThrow(/row-level security/)
  })

  it('ne peuvent pas être déplacés vers une autre organisation', async () => {
    await expect(
      banc.enTantQue(alice).query('update clients set organization_id = $1 where id = $2', [orgB, clientA]),
    ).rejects.toThrow(/organisation|row-level security/)
  })

  it('sont en lecture seule pour un membre « lecture seule »', async () => {
    const lus = await banc.enTantQue(lecteur).query('select id from clients')
    expect(lus.rows).toHaveLength(1)
    await expect(
      banc.enTantQue(lecteur).query("insert into clients (organization_id, kind, name) values ($1, 'b2c', 'Non')", [orgA]),
    ).rejects.toThrow(/row-level security/)
    const maj = await banc.enTantQue(lecteur).query("update clients set name = 'Non' where id = $1", [clientA])
    expect(maj.rowCount).toBe(0)
  })

  it('exigent un SIREN pour une entreprise française', async () => {
    await expect(
      banc.enTantQue(alice).query("insert into clients (organization_id, kind, name) values ($1, 'b2b', 'Sans SIREN')", [orgA]),
    ).rejects.toThrow(/check constraint/)
  })

  it('refusent deux clients actifs avec le même SIREN', async () => {
    await expect(
      banc
        .enTantQue(alice)
        .query("insert into clients (organization_id, kind, name, siren) values ($1, 'b2b', 'Doublon', '732829320')", [orgA]),
    ).rejects.toThrow(/duplicate key/)
  })
})

describe('contacts et prix par client', () => {
  it('ne peuvent pas viser un client d’une autre organisation', async () => {
    await expect(
      banc
        .enTantQue(alice)
        .query("insert into client_contacts (organization_id, client_id, name) values ($1, $2, 'Pirate')", [orgA, clientB]),
    ).rejects.toThrow(/foreign key/)
    await expect(
      banc
        .enTantQue(bruno)
        .query('insert into client_prices (organization_id, client_id, product_id, unit_price_cents) values ($1, $2, $3, 100)', [
          orgB,
          clientB,
          produitA,
        ]),
    ).rejects.toThrow(/foreign key/)
  })

  it('fonctionnent dans la même organisation', async () => {
    await banc
      .enTantQue(alice)
      .query("insert into client_contacts (organization_id, client_id, name, email, receives_invoices) values ($1, $2, 'Claire', 'claire@dupont.fr', true)", [
        orgA,
        clientA,
      ])
    await banc
      .enTantQue(alice)
      .query('insert into client_prices (organization_id, client_id, product_id, unit_price_cents) values ($1, $2, $3, 42000)', [orgA, clientA, produitA])
    const prix = await banc.enTantQue(alice).query('select unit_price_cents from client_prices where client_id = $1', [clientA])
    expect(prix.rows[0].unit_price_cents).toBe('42000')
    const etranger = await banc.enTantQue(bruno).query('select * from client_contacts')
    expect(etranger.rows).toHaveLength(0)
  })

  it('rejettent un email de contact invalide', async () => {
    await expect(
      banc
        .enTantQue(alice)
        .query("insert into client_contacts (organization_id, client_id, name, email) values ($1, $2, 'X', 'pas-un-email')", [orgA, clientA]),
    ).rejects.toThrow(/check constraint/)
  })
})

describe('catalogue', () => {
  it('impose la cohérence TVA et nature', async () => {
    await expect(
      banc
        .enTantQue(alice)
        .query("insert into products (organization_id, name, unit_price_cents, vat_category, vat_rate) values ($1, 'X', 100, 'S', 0)", [orgA]),
    ).rejects.toThrow(/check constraint/)
    await expect(
      banc
        .enTantQue(alice)
        .query("insert into products (organization_id, name, unit_price_cents, nature) values ($1, 'Frais', 100, 'debours')", [orgA]),
    ).rejects.toThrow(/check constraint/)
  })

  it('reste isolé', async () => {
    const b = await banc.enTantQue(bruno).query('select * from products')
    expect(b.rows).toHaveLength(0)
    const supprime = await banc.enTantQue(bruno).query('delete from products where id = $1', [produitA])
    expect(supprime.rowCount).toBe(0)
  })
})

describe('réglages de facturation', () => {
  it('se modifient par un propriétaire et sont validés', async () => {
    const ok = await banc
      .enTantQue(alice)
      .query("update organizations set invoice_number_format = 'FA{AA}-{NNNNN}', invoice_template = 'galet' where id = $1", [orgA])
    expect(ok.rowCount).toBe(1)
    await expect(
      banc.enTantQue(alice).query("update organizations set invoice_number_format = 'SANS-NUMERO' where id = $1", [orgA]),
    ).rejects.toThrow(/check constraint/)
  })
})

describe('logos', () => {
  it('ne s’écrivent que dans le dossier de son organisation', async () => {
    await banc.enTantQue(alice).query("insert into storage.objects (bucket_id, name) values ('logos', $1)", [`${orgA}/logo.png`])
    await expect(
      banc.enTantQue(bruno).query("insert into storage.objects (bucket_id, name) values ('logos', $1)", [`${orgA}/pirate.png`]),
    ).rejects.toThrow(/row-level security/)
    await expect(
      banc.enTantQue(lecteur).query("insert into storage.objects (bucket_id, name) values ('logos', $1)", [`${orgA}/lecteur.png`]),
    ).rejects.toThrow(/row-level security/)
  })
})
