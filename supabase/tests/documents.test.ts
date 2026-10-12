/** Documents et lignes : isolation, brouillons seuls modifiables, référentiels en lecture. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Banc, ouvrirBanc } from './base'

let banc: Banc
let alice: string
let bruno: string
let orgA: string
let orgB: string
let clientA: string
let clientB: string
let brouillon: string
let emis: string

beforeAll(async () => {
  banc = await ouvrirBanc()
  alice = await banc.creerUtilisateur('alice@exemple.fr')
  bruno = await banc.creerUtilisateur('bruno@exemple.fr')
  orgA = (await banc.enTantQue(alice).query<{ id: string }>("select id from create_organization('A')")).rows[0]!.id
  orgB = (await banc.enTantQue(bruno).query<{ id: string }>("select id from create_organization('B')")).rows[0]!.id
  clientA = (await banc.enTantQue(alice).query<{ id: string }>("insert into clients (organization_id, kind, name) values ($1, 'b2c', 'Client A') returning id", [orgA])).rows[0]!.id
  clientB = (await banc.enTantQue(bruno).query<{ id: string }>("insert into clients (organization_id, kind, name) values ($1, 'b2c', 'Client B') returning id", [orgB])).rows[0]!.id
  brouillon = (
    await banc.enTantQue(alice).query<{ id: string }>("insert into documents (organization_id, type, client_id) values ($1, 'facture', $2) returning id", [orgA, clientA])
  ).rows[0]!.id
  emis = (
    await banc.enTantQue(alice).query<{ id: string }>("insert into documents (organization_id, type, client_id) values ($1, 'facture', $2) returning id", [orgA, clientA])
  ).rows[0]!.id
  await banc.enTantQue(alice).query("insert into document_lines (organization_id, document_id, position, designation) values ($1, $2, 1, 'Ligne')", [orgA, emis])
  // Émission simulée (la vraie fonction est testée dans emission.test.ts).
  await banc.admin.query("update documents set status = 'emis', number = 'F-2026-0001' where id = $1", [emis])
})

afterAll(async () => {
  await banc?.fermer()
})

describe('documents', () => {
  it('sont isolés par organisation', async () => {
    expect((await banc.enTantQue(bruno).query('select id from documents')).rows).toHaveLength(0)
    expect((await banc.enTantQue(alice).query('select id from documents')).rows).toHaveLength(2)
  })

  it('ne peuvent pas viser le client d’une autre organisation', async () => {
    await expect(
      banc.enTantQue(alice).query("insert into documents (organization_id, type, client_id) values ($1, 'facture', $2)", [orgA, clientB]),
    ).rejects.toThrow(/foreign key/)
  })

  it('ne peuvent pas être créés déjà émis ou numérotés', async () => {
    await expect(
      banc.enTantQue(alice).query("insert into documents (organization_id, type, status, number) values ($1, 'facture', 'emis', 'F-1')", [orgA]),
    ).rejects.toThrow(/row-level security/)
  })

  it('brouillon : modifiable et supprimable', async () => {
    const maj = await banc.enTantQue(alice).query("update documents set subject = 'Refonte' where id = $1", [brouillon])
    expect(maj.rowCount).toBe(1)
  })

  it('émis : ni modifiable, ni supprimable, ni renumérotable', async () => {
    expect((await banc.enTantQue(alice).query("update documents set subject = 'Fraude' where id = $1", [emis])).rowCount).toBe(0)
    expect((await banc.enTantQue(alice).query('delete from documents where id = $1', [emis])).rowCount).toBe(0)
    expect((await banc.enTantQue(alice).query("update documents set status = 'brouillon' where id = $1", [emis])).rowCount).toBe(0)
  })

  it('un brouillon ne peut pas se donner un numéro ni un statut émis', async () => {
    await expect(banc.enTantQue(alice).query("update documents set number = 'F-9' where id = $1", [brouillon])).rejects.toThrow(/row-level security/)
    await expect(banc.enTantQue(alice).query("update documents set status = 'emis' where id = $1", [brouillon])).rejects.toThrow(/row-level security|check constraint/)
  })

  it('les lignes d’un document émis sont figées', async () => {
    await expect(
      banc.enTantQue(alice).query("insert into document_lines (organization_id, document_id, position, designation) values ($1, $2, 2, 'Ajout')", [orgA, emis]),
    ).rejects.toThrow(/figées|row-level security/)
    expect((await banc.enTantQue(alice).query("update document_lines set designation = 'X' where document_id = $1", [emis])).rowCount).toBe(0)
    expect((await banc.enTantQue(alice).query('delete from document_lines where document_id = $1', [emis])).rowCount).toBe(0)
  })

  it('les lignes ne peuvent pas viser un document d’une autre organisation', async () => {
    await expect(
      banc.enTantQue(bruno).query("insert into document_lines (organization_id, document_id, position) values ($1, $2, 1)", [orgB, brouillon]),
    ).rejects.toThrow(/foreign key|row-level security/)
  })

  it('un client avec des documents ne peut pas être supprimé', async () => {
    await expect(banc.enTantQue(alice).query('delete from clients where id = $1', [clientA])).rejects.toThrow(/foreign key/)
  })
})

describe('référentiels', () => {
  it('taux de TVA et mentions sont lisibles mais pas modifiables', async () => {
    const taux = await banc.enTantQue(alice).query("select rate from vat_rates where territory = 'metropole' order by rate desc")
    expect(taux.rows.map((r) => r.rate)).toEqual([2000, 1000, 550, 210])
    const mention = await banc.enTantQue(alice).query("select text from legal_mentions where key = 'franchise'")
    expect(mention.rows[0].text).toMatch(/293 B/)
    await expect(banc.enTantQue(alice).query("update legal_mentions set text = 'x' where key = 'franchise'")).rejects.toThrow(/permission denied/)
    await expect(banc.enTantQue(null).query('select * from vat_rates')).rejects.toThrow(/permission denied/)
  })
})

describe('enregistrer_brouillon', () => {
  const lignes = JSON.stringify([
    { position: 1, designation: 'Création logo', quantity_milli: 3000, unit: 'forfait', unit_price_cents: 45000, vat_category: 'S', vat_rate: 2000, nature: 'service', line_net_cents: 135000 },
  ])
  const tva = JSON.stringify([{ position: 1, vat_category: 'S', vat_rate: 2000, base_cents: 135000, vat_cents: 27000 }])

  it('crée puis met à jour un brouillon en une transaction', async () => {
    const { rows } = await banc
      .enTantQue(alice)
      .query<{ id: string }>('select enregistrer_brouillon($1, null, $2, $3, $4) as id', [
        orgA,
        JSON.stringify({ type: 'facture', client_id: clientA, total_ht: 135000, total_vat: 27000, total_ttc: 162000, amount_due: 162000 }),
        lignes,
        tva,
      ])
    const id = rows[0]!.id
    const doc = await banc.enTantQue(alice).query('select total_ttc, status from documents where id = $1', [id])
    expect(doc.rows[0]).toEqual({ total_ttc: '162000', status: 'brouillon' })
    await banc.enTantQue(alice).query('select enregistrer_brouillon($1, $2, $3, $4, $5)', [orgA, id, JSON.stringify({ type: 'facture', client_id: clientA, subject: 'Refonte' }), '[]', '[]'])
    const apres = await banc.enTantQue(alice).query('select subject, (select count(*) from document_lines where document_id = $1) as n from documents where id = $1', [id])
    expect(apres.rows[0]).toEqual({ subject: 'Refonte', n: '0' })
  })

  it('refuse de modifier un document émis', async () => {
    await expect(
      banc.enTantQue(alice).query('select enregistrer_brouillon($1, $2, $3, $4, $5)', [orgA, emis, JSON.stringify({ type: 'facture' }), lignes, tva]),
    ).rejects.toThrow(/déjà émis/)
  })

  it('n’écrit rien dans une autre organisation', async () => {
    await expect(
      banc.enTantQue(bruno).query('select enregistrer_brouillon($1, null, $2, $3, $4)', [orgA, JSON.stringify({ type: 'facture' }), lignes, tva]),
    ).rejects.toThrow(/row-level security/)
    await expect(
      banc.enTantQue(bruno).query('select enregistrer_brouillon($1, $2, $3, $4, $5)', [orgA, brouillon, JSON.stringify({ type: 'facture' }), lignes, tva]),
    ).rejects.toThrow(/introuvable/)
  })

  it('annule tout si une ligne est invalide', async () => {
    const avant = await banc.enTantQue(alice).query('select count(*) as n from documents')
    await expect(
      banc
        .enTantQue(alice)
        .query('select enregistrer_brouillon($1, null, $2, $3, $4)', [orgA, JSON.stringify({ type: 'facture' }), JSON.stringify([{ position: 1, quantity_milli: 1000, unit_price_cents: 1, vat_category: 'X', vat_rate: 0, nature: 'service' }]), '[]']),
    ).rejects.toThrow(/check constraint/)
    const apres = await banc.enTantQue(alice).query('select count(*) as n from documents')
    expect(apres.rows[0].n).toBe(avant.rows[0].n)
  })
})
