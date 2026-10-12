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
  // Émission simulée (la fonction d'émission arrive en phase 5).
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
    ).rejects.toThrow(/row-level security/)
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
