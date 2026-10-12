/** Offres et essai, paywall doux, limites, invitations, administrateurs, annonces. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Banc, ouvrirBanc } from './base'

let banc: Banc
let alice: string
let bruno: string
let claire: string
let org: string

const abonnement = (statut: string, plan = 'pro', fin = "now() + interval '10 days'") =>
  banc.admin.query(`update subscriptions set status = $1, plan = $2, trial_ends_at = ${fin} where organization_id = $3`, [statut, plan, org])

beforeAll(async () => {
  banc = await ouvrirBanc()
  alice = await banc.creerUtilisateur('alice@exemple.fr')
  bruno = await banc.creerUtilisateur('bruno@exemple.fr')
  claire = await banc.creerUtilisateur('claire@exemple.fr')
  org = (await banc.enTantQue(alice).query<{ id: string }>("select id from create_organization('Atelier')")).rows[0]!.id
})

afterAll(async () => {
  await banc?.fermer()
})

describe('essai et paywall doux', () => {
  it('une entreprise démarre en essai Pro de 14 jours', async () => {
    const { rows } = await banc.enTantQue(alice).query("select plan, status, trial_ends_at > now() + interval '13 days' as long from subscriptions")
    expect(rows).toEqual([{ plan: 'pro', status: 'trialing', long: true }])
    await expect(banc.enTantQue(alice).query("update subscriptions set plan = 'studio'")).rejects.toThrow(/permission/)
  })

  it('essai terminé : lecture seule, rien ne se crée', async () => {
    const a = banc.enTantQue(alice)
    await a.query("insert into clients (organization_id, kind, name) values ($1, 'b2c', 'Avant')", [org])
    await abonnement('trialing', 'pro', "now() - interval '1 day'")
    await expect(a.query("insert into clients (organization_id, kind, name) values ($1, 'b2c', 'Après')", [org])).rejects.toThrow(/row-level security/)
    expect((await a.query('select name from clients')).rows).toEqual([{ name: 'Avant' }])
    await abonnement('active', 'solo')
    await a.query("insert into clients (organization_id, kind, name) values ($1, 'b2c', 'Payé')", [org])
  })

  it('les fonctions Pro sont réservées aux offres Pro et Studio', async () => {
    const a = banc.enTantQue(alice)
    const client = (await a.query<{ id: string }>('select id from clients limit 1')).rows[0]!.id
    const recurrence = "insert into recurring_invoices (organization_id, client_id, name, frequency, next_date, template) values ($1, $2, 'R', 'mensuelle', '2026-11-01', '{}')"
    await expect(a.query(recurrence, [org, client])).rejects.toThrow(/row-level security/)
    await abonnement('active', 'pro')
    await a.query(recurrence, [org, client])
  })
})

describe('limites d’utilisateurs et invitations', () => {
  it('Solo : un seul utilisateur', async () => {
    await abonnement('active', 'solo')
    await expect(banc.admin.query("insert into memberships (organization_id, user_id, role) values ($1, $2, 'viewer')", [org, bruno])).rejects.toThrow(/limitée à 1/)
    await abonnement('active', 'pro')
  })

  it('invitation acceptée par la bonne adresse uniquement', async () => {
    const a = banc.enTantQue(alice)
    const token = (await a.query<{ token: string }>("insert into invitations (organization_id, email, role) values ($1, 'Bruno@Exemple.fr', 'billing') returning token", [org])).rows[0]!.token
    expect((await banc.enTantQue(null).query('select invitation($1) as i', [token])).rows[0].i).toMatchObject({ organisation: 'Atelier', role: 'billing', expiree: false })
    await expect(banc.enTantQue(claire).query('select accepter_invitation($1)', [token])).rejects.toThrow(/bruno@exemple\.fr/i)
    const slug = (await banc.enTantQue(bruno).query('select accepter_invitation($1) as s', [token])).rows[0].s
    expect(slug).toBe('atelier')
    expect((await banc.enTantQue(bruno).query('select role from memberships where organization_id = $1 and user_id = $2', [org, bruno])).rows[0].role).toBe('billing')
    await expect(banc.enTantQue(bruno).query('select accepter_invitation($1)', [token])).rejects.toThrow(/déjà été utilisée/)
  })

  it('seuls propriétaires et administrateurs invitent ; jamais un propriétaire', async () => {
    await expect(banc.enTantQue(bruno).query("insert into invitations (organization_id, email, role) values ($1, 'x@y.fr', 'viewer')", [org])).rejects.toThrow(/row-level security/)
    await expect(banc.enTantQue(alice).query("insert into invitations (organization_id, email, role) values ($1, 'x@y.fr', 'owner')", [org])).rejects.toThrow(/check constraint/)
    expect((await banc.enTantQue(bruno).query('select * from invitations')).rows).toHaveLength(0)
  })

  it('invitation expirée', async () => {
    const token = (await banc.enTantQue(alice).query<{ token: string }>("insert into invitations (organization_id, email, role) values ($1, 'claire@exemple.fr', 'viewer') returning token", [org])).rows[0]!.token
    await banc.admin.query("update invitations set expires_at = now() - interval '1 minute' where token = $1", [token])
    await expect(banc.enTantQue(claire).query('select accepter_invitation($1)', [token])).rejects.toThrow(/expiré/)
  })

  it('Pro : trois utilisateurs au plus', async () => {
    await banc.admin.query("insert into memberships (organization_id, user_id, role) values ($1, $2, 'viewer')", [org, claire])
    const dan = await banc.creerUtilisateur('dan@exemple.fr')
    await expect(banc.admin.query("insert into memberships (organization_id, user_id, role) values ($1, $2, 'viewer')", [org, dan])).rejects.toThrow(/limitée à 3/)
  })
})

describe('plateforme', () => {
  it('administrateurs, annonces, journal des erreurs', async () => {
    await banc.admin.query('insert into platform_admins (user_id) values ($1)', [alice])
    expect((await banc.enTantQue(alice).query('select user_id from platform_admins')).rows).toHaveLength(1)
    expect((await banc.enTantQue(bruno).query('select user_id from platform_admins')).rows).toHaveLength(0)

    await banc.admin.query("insert into announcements (title, body) values ('Nouveau', 'Texte'), ('Passée', 'x')")
    await banc.admin.query("update announcements set ends_at = now() - interval '1 day' where title = 'Passée'")
    expect((await banc.enTantQue(bruno).query('select title from announcements')).rows).toEqual([{ title: 'Nouveau' }])

    await banc.enTantQue(alice).query("insert into error_logs (organization_id, kind, message) values ($1, 'pdf', 'Police manquante')", [org])
    await expect(banc.enTantQue(alice).query('select * from error_logs')).rejects.toThrow(/permission/)
    const autre = (await banc.enTantQue(claire).query<{ id: string }>("select id from create_organization('Autre')")).rows[0]!.id
    await expect(banc.enTantQue(bruno).query("insert into error_logs (organization_id, kind, message) values ($1, 'pdf', 'x')", [autre])).rejects.toThrow(/row-level security/)
  })

  it('les adresses publiques ne peuvent pas devenir des noms d’entreprise', async () => {
    const r = await banc.enTantQue(claire).query<{ slug: string }>("select slug from create_organization('Invitation')")
    expect(r.rows[0]!.slug).toBe('invitation-2')
  })
})
