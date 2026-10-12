/** Plateforme agréée : isolation des transmissions, factures reçues figées, e-reporting unique par période. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Banc, ouvrirBanc } from './base'

let banc: Banc
let alice: string
let bruno: string
let lecteur: string
let org: string
let recue: string

beforeAll(async () => {
  banc = await ouvrirBanc()
  alice = await banc.creerUtilisateur('alice@exemple.fr')
  bruno = await banc.creerUtilisateur('bruno@exemple.fr')
  lecteur = await banc.creerUtilisateur('lecteur@exemple.fr')
  org = (await banc.enTantQue(alice).query<{ id: string }>("select id from create_organization('Atelier')")).rows[0]!.id
  await banc.enTantQue(bruno).query("select create_organization('Autre')")
  await banc.admin.query("insert into memberships (organization_id, user_id, role) values ($1, $2, 'viewer')", [org, lecteur])
  recue = (
    await banc
      .enTantQue(alice)
      .query<{ id: string }>(
        "insert into received_invoices (organization_id, provider, flow_id, format, number, issue_date, seller_name, total_ht, total_vat, total_ttc, amount_due, xml) values ($1, 'simulee', 'F1', 'cii', 'X-1', '2026-10-01', 'Fournisseur', 100, 20, 120, 120, '<x/>') returning id",
        [org],
      )
  ).rows[0]!.id
})

afterAll(async () => {
  await banc?.fermer()
})

describe('factures reçues', () => {
  it('isolées par organisation, lisibles par un lecteur', async () => {
    expect((await banc.enTantQue(bruno).query('select id from received_invoices')).rows).toHaveLength(0)
    expect((await banc.enTantQue(lecteur).query('select id from received_invoices')).rows).toHaveLength(1)
  })

  it('seul le statut évolue ; le contenu du fournisseur est figé', async () => {
    const a = banc.enTantQue(alice)
    expect((await a.query("update received_invoices set status = 'approuvee', status_code = 205 where id = $1", [recue])).rowCount).toBe(1)
    await expect(a.query('update received_invoices set total_ttc = 1 where id = $1', [recue])).rejects.toThrow(/permission/)
    expect((await banc.enTantQue(lecteur).query("update received_invoices set status = 'refusee' where id = $1", [recue])).rowCount).toBe(0)
    await expect(a.query('delete from received_invoices where id = $1', [recue])).rejects.toThrow(/permission/)
  })

  it('un flux n’est enregistré qu’une fois', async () => {
    await expect(
      banc
        .enTantQue(alice)
        .query(
          "insert into received_invoices (organization_id, provider, flow_id, format, number, issue_date, seller_name, total_ht, total_vat, total_ttc, amount_due, xml) values ($1, 'simulee', 'F1', 'cii', 'X-1', '2026-10-01', 'F', 1, 0, 1, 1, '<x/>')",
          [org],
        ),
    ).rejects.toThrow(/duplicate key/)
  })
})

describe('e-reporting et transmissions', () => {
  it('une période ne se dépose qu’une fois par type', async () => {
    const q = "insert into ereporting_reports (organization_id, kind, period_start, period_end, provider, summary) values ($1, 'transactions', '2026-09-01', '2026-09-30', 'simulee', '{}')"
    await banc.enTantQue(alice).query(q, [org])
    await expect(banc.enTantQue(alice).query(q, [org])).rejects.toThrow(/duplicate key/)
    await expect(banc.enTantQue(lecteur).query(q.replace("'transactions'", "'paiements'"), [org])).rejects.toThrow(/row-level security/)
  })

  it('une transmission vise un document de l’organisation', async () => {
    const autre = (await banc.enTantQue(bruno).query<{ id: string }>("select id from organizations")).rows[0]!.id
    const doc = (await banc.enTantQue(bruno).query<{ id: string }>("insert into documents (organization_id, type) values ($1, 'facture') returning id", [autre])).rows[0]!.id
    await expect(
      banc.enTantQue(alice).query("insert into einvoice_transmissions (organization_id, document_id, provider, format) values ($1, $2, 'simulee', 'factur-x')", [org, doc]),
    ).rejects.toThrow(/foreign key/)
  })
})
