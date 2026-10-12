/** Paiements, relances, récurrences, lien public et signature des devis. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Banc, ouvrirBanc } from './base'

let banc: Banc
let alice: string
let bruno: string
let org: string
let orgB: string
let client: string

async function emise(type = 'facture', ttc = 12000): Promise<string> {
  const a = banc.enTantQue(alice)
  const { rows } = await a.query<{ id: string }>(
    "insert into documents (organization_id, type, client_id, issue_date, total_ttc, amount_due, internal_notes) values ($1, $2, $3, '2026-10-01', $4, $4, 'note interne') returning id",
    [org, type, client, ttc],
  )
  const id = rows[0]!.id
  await a.query("insert into document_lines (organization_id, document_id, position, designation, unit_price_cents) values ($1, $2, 1, 'Conseil', $3)", [org, id, ttc])
  await a.query('select emettre_document($1)', [id])
  return id
}

const statut = async (id: string) => (await banc.admin.query('select status, amount_paid from documents where id = $1', [id])).rows[0]

beforeAll(async () => {
  banc = await ouvrirBanc()
  alice = await banc.creerUtilisateur('alice@exemple.fr')
  bruno = await banc.creerUtilisateur('bruno@exemple.fr')
  org = (await banc.enTantQue(alice).query<{ id: string }>("select id from create_organization('Atelier')")).rows[0]!.id
  orgB = (await banc.enTantQue(bruno).query<{ id: string }>("select id from create_organization('Autre')")).rows[0]!.id
  client = (await banc.enTantQue(alice).query<{ id: string }>("insert into clients (organization_id, kind, name) values ($1, 'b2c', 'Client') returning id", [org])).rows[0]!.id
})

afterAll(async () => {
  await banc?.fermer()
})

describe('paiements', () => {
  it('partiel puis total, puis suppression : statut et montant suivent', async () => {
    const f = await emise()
    const a = banc.enTantQue(alice)
    await a.query("insert into payments (organization_id, document_id, amount_cents) values ($1, $2, 5000)", [org, f])
    expect(await statut(f)).toMatchObject({ status: 'partiellement_paye', amount_paid: '5000' })
    const { rows } = await a.query<{ id: string }>("insert into payments (organization_id, document_id, amount_cents, method) values ($1, $2, 7000, 'cheque') returning id", [org, f])
    expect(await statut(f)).toMatchObject({ status: 'paye', amount_paid: '12000' })
    await a.query('delete from payments where id = $1', [rows[0]!.id])
    expect(await statut(f)).toMatchObject({ status: 'partiellement_paye', amount_paid: '5000' })
    const audit = await a.query("select count(*)::int as n from audit_log where action like 'paiement.%'")
    expect(audit.rows[0].n).toBe(3)
  })

  it('refuse le trop-perçu, les brouillons, les factures annulées et les autres organisations', async () => {
    const f = await emise()
    const a = banc.enTantQue(alice)
    await expect(a.query("insert into payments (organization_id, document_id, amount_cents) values ($1, $2, 12001)", [org, f])).rejects.toThrow(/dépasse/)
    const brouillon = (await a.query<{ id: string }>("insert into documents (organization_id, type, client_id) values ($1, 'facture', $2) returning id", [org, client])).rows[0]!.id
    await expect(a.query("insert into payments (organization_id, document_id, amount_cents) values ($1, $2, 1)", [org, brouillon])).rejects.toThrow(/émise/)
    await expect(banc.enTantQue(bruno).query("insert into payments (organization_id, document_id, amount_cents) values ($1, $2, 1)", [orgB, f])).rejects.toThrow(/foreign key/)
    expect((await banc.enTantQue(bruno).query('select * from payments')).rows).toHaveLength(0)
  })
})

describe('relances', () => {
  it('une étape de scénario ne part qu’une fois', async () => {
    const f = await emise()
    const a = banc.enTantQue(alice)
    const r = "insert into reminders (organization_id, document_id, step, kind, recipient, subject, status) values ($1, $2, 7, 'relance', 'c@x.fr', 'Rappel', $3)"
    await a.query(r, [org, f, 'echec'])
    await a.query(r, [org, f, 'envoye'])
    await expect(a.query(r, [org, f, 'envoye'])).rejects.toThrow(/duplicate key/)
  })
})

describe('récurrences', () => {
  it('isolées par organisation', async () => {
    await banc
      .enTantQue(alice)
      .query("insert into recurring_invoices (organization_id, client_id, name, frequency, next_date, template) values ($1, $2, 'Maintenance', 'mensuelle', '2026-11-01', '{}')", [org, client])
    expect((await banc.enTantQue(bruno).query('select * from recurring_invoices')).rows).toHaveLength(0)
    await expect(
      banc.enTantQue(bruno).query("insert into recurring_invoices (organization_id, client_id, name, frequency, next_date, template) values ($1, $2, 'x', 'mensuelle', '2026-11-01', '{}')", [orgB, client]),
    ).rejects.toThrow(/foreign key/)
  })
})

describe('lien public et signature', () => {
  it('un brouillon ne se partage pas ; le lien est stable', async () => {
    const a = banc.enTantQue(alice)
    const brouillon = (await a.query<{ id: string }>("insert into documents (organization_id, type, client_id) values ($1, 'devis', $2) returning id", [org, client])).rows[0]!.id
    await expect(a.query('select lien_public($1)', [brouillon])).rejects.toThrow(/brouillon/)
    const f = await emise()
    const t1 = (await a.query('select lien_public($1) as t', [f])).rows[0].t
    const t2 = (await a.query('select lien_public($1) as t', [f])).rows[0].t
    expect(t1).toBe(t2)
    await expect(banc.enTantQue(bruno).query('select lien_public($1)', [f])).rejects.toThrow(/introuvable/)
  })

  it('lecture anonyme sans données internes', async () => {
    const f = await emise()
    const t = (await banc.enTantQue(alice).query('select lien_public($1) as t', [f])).rows[0].t
    const { rows } = await banc.enTantQue(null).query('select document_public($1) as d', [t])
    const d = rows[0].d
    expect(d.document.number).toMatch(/^F-/)
    expect(d.document.internal_notes).toBeUndefined()
    expect(d.lignes).toHaveLength(1)
    expect((await banc.enTantQue(null).query('select document_public($1) as d', ['00000000-0000-0000-0000-000000000000'])).rows[0].d).toBeNull()
    await expect(banc.enTantQue(null).query('select * from documents')).rejects.toThrow(/permission/)
  })

  it('signature en ligne d’un devis : une seule décision, preuve conservée', async () => {
    const devis = await emise('devis')
    const t = (await banc.enTantQue(alice).query('select lien_public($1) as t', [devis])).rows[0].t
    const anonyme = banc.enTantQue(null)
    await expect(anonyme.query("select signer_devis($1, 'accepte', 'X', null, null, 'test')", [t])).rejects.toThrow(/nom/)
    await anonyme.query("select signer_devis($1, 'accepte', 'Claire Dupont', 'claire@dupont.fr', 'Bon pour accord', 'Mozilla')", [t])
    expect((await statut(devis)).status).toBe('accepte')
    await expect(anonyme.query("select signer_devis($1, 'refuse', 'Claire Dupont', null, null, 'x')", [t])).rejects.toThrow(/plus de réponse/)
    const s = (await banc.enTantQue(alice).query('select * from quote_signatures where document_id = $1', [devis])).rows[0]
    expect(s).toMatchObject({ decision: 'accepte', signer_name: 'Claire Dupont' })
    expect(s.content_hash).toMatch(/^[0-9a-f]{64}$/)
    const facture = await emise()
    const tf = (await banc.enTantQue(alice).query('select lien_public($1) as t', [facture])).rows[0].t
    await expect(anonyme.query("select signer_devis($1, 'accepte', 'Claire', null, null, 'x')", [tf])).rejects.toThrow(/introuvable/)
  })

  it('le jeton public ne modifie pas le contenu figé', async () => {
    const f = await emise()
    await banc.enTantQue(alice).query('select lien_public($1)', [f])
    await expect(banc.admin.query('update documents set public_token = gen_random_uuid() where id = $1', [f])).rejects.toThrow(/lien public/)
    const { rows } = await banc.enTantQue(alice).query<{ empreinte_ok: boolean }>('select * from verifier_chaine($1)', [org])
    expect(rows.every((r) => r.empreinte_ok)).toBe(true)
  })
})

describe('service', () => {
  it('la clé de service peut émettre (récurrences automatiques)', async () => {
    const id = (await banc.enTantQue(alice).query<{ id: string }>("insert into documents (organization_id, type, client_id, issue_date) values ($1, 'facture', $2, '2026-10-02') returning id", [org, client])).rows[0]!.id
    await banc.enTantQue(alice).query("insert into document_lines (organization_id, document_id, position, designation) values ($1, $2, 1, 'Abonnement')", [org, id])
    await banc.admin.query('begin')
    await banc.admin.query('set local role service_role')
    await banc.admin.query("select set_config('request.jwt.claims', '{\"role\":\"service_role\"}', true)")
    const r = await banc.admin.query('select number from emettre_document($1)', [id])
    await banc.admin.query('commit')
    expect(r.rows[0].number).toMatch(/^F-2026-/)
  })
})
