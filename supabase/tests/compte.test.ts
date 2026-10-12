/** Suppression de compte : entreprises vides supprimées, archives fiscales conservées. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Banc, ouvrirBanc } from './base'

let banc: Banc

beforeAll(async () => {
  banc = await ouvrirBanc()
})

afterAll(async () => {
  await banc?.fermer()
})

async function emettre(user: string, org: string) {
  const a = banc.enTantQue(user)
  const client = (await a.query<{ id: string }>("insert into clients (organization_id, kind, name) values ($1, 'b2c', 'C') returning id", [org])).rows[0]!.id
  const doc = (await a.query<{ id: string }>("insert into documents (organization_id, type, client_id, issue_date) values ($1, 'facture', $2, '2026-10-01') returning id", [org, client])).rows[0]!.id
  await a.query("insert into document_lines (organization_id, document_id, position, designation) values ($1, $2, 1, 'L')", [org, doc])
  await a.query('select emettre_document($1)', [doc])
}

describe('suppression de compte', () => {
  it('exige la confirmation', async () => {
    const u = await banc.creerUtilisateur('u@x.fr')
    await expect(banc.enTantQue(u).query("select supprimer_mon_compte('oui')")).rejects.toThrow(/SUPPRIMER/)
  })

  it('supprime l’entreprise vide, clôt celle qui a des factures émises', async () => {
    const u = await banc.creerUtilisateur('solo@x.fr')
    const vide = (await banc.enTantQue(u).query<{ id: string }>("select id from create_organization('Vide')")).rows[0]!.id
    const archive = (await banc.enTantQue(u).query<{ id: string }>("select id from create_organization('Archive')")).rows[0]!.id
    await emettre(u, archive)
    const r = (await banc.enTantQue(u).query("select supprimer_mon_compte('SUPPRIMER') as r")).rows[0].r
    expect(r).toEqual({ supprimees: 1, closes: 1 })
    expect((await banc.admin.query('select id from organizations where id = $1', [vide])).rows).toHaveLength(0)
    const o = (await banc.admin.query('select closed_at from organizations where id = $1', [archive])).rows[0]
    expect(o.closed_at).not.toBeNull()
    expect((await banc.admin.query("select count(*)::int as n from documents where organization_id = $1 and status <> 'brouillon'", [archive])).rows[0].n).toBe(1)
    expect((await banc.admin.query('select id from auth.users where id = $1', [u])).rows).toHaveLength(0)
  })

  it('refuse tant qu’un autre membre resterait sans propriétaire', async () => {
    const p = await banc.creerUtilisateur('proprio@x.fr')
    const m = await banc.creerUtilisateur('membre@x.fr')
    const org = (await banc.enTantQue(p).query<{ id: string }>("select id from create_organization('Equipe')")).rows[0]!.id
    await banc.admin.query("insert into memberships (organization_id, user_id, role) values ($1, $2, 'billing')", [org, m])
    await expect(banc.enTantQue(p).query("select supprimer_mon_compte('SUPPRIMER')")).rejects.toThrow(/autre propriétaire de « Equipe »/)
    // Le membre simple peut partir sans toucher à l'entreprise.
    expect((await banc.enTantQue(m).query("select supprimer_mon_compte('SUPPRIMER') as r")).rows[0].r).toEqual({ supprimees: 0, closes: 0 })
    expect((await banc.admin.query('select count(*)::int as n from memberships where organization_id = $1', [org])).rows[0].n).toBe(1)
  })
})
