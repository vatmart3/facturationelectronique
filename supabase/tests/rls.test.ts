/**
 * Isolation entre organisations et règles de rôles, vérifiées en base.
 * Chaque requête « en tant que » s'exécute avec le rôle Postgres `authenticated`
 * et les claims JWT de l'utilisateur, exactement comme via l'API Supabase.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Banc, ouvrirBanc } from './base'

let banc: Banc
let alice: string // propriétaire de « Atelier Lumen »
let bruno: string // propriétaire de « Studio Bruno »
let chloe: string // invitée par Alice comme lecture seule, puis admin
let david: string // sans organisation
let orgAlice: string
let orgBruno: string

async function creerOrg(user: string, nom: string) {
  const { rows } = await banc.enTantQue(user).query<{ id: string; slug: string }>(
    'select id, slug from public.create_organization($1)',
    [nom],
  )
  return rows[0]!
}

beforeAll(async () => {
  banc = await ouvrirBanc()
  alice = await banc.creerUtilisateur('alice@exemple.fr', 'Alice Martin')
  bruno = await banc.creerUtilisateur('bruno@exemple.fr', 'Bruno Petit')
  chloe = await banc.creerUtilisateur('chloe@exemple.fr')
  david = await banc.creerUtilisateur('david@exemple.fr')
  orgAlice = (await creerOrg(alice, 'Atelier Lumen')).id
  orgBruno = (await creerOrg(bruno, 'Studio Bruno')).id
})

afterAll(async () => {
  await banc?.fermer()
})

describe('création d’organisation', () => {
  it('rend le créateur propriétaire et génère un slug', async () => {
    const { rows } = await banc
      .enTantQue(alice)
      .query('select o.slug, m.role from organizations o join memberships m on m.organization_id = o.id where o.id = $1', [orgAlice])
    expect(rows).toEqual([{ slug: 'atelier-lumen', role: 'owner' }])
  })

  it('dédoublonne les slugs', async () => {
    const org = await creerOrg(david, 'Atelier Lumen')
    expect(org.slug).toBe('atelier-lumen-2')
    const org3 = await creerOrg(david, 'Atelier  Lumen !')
    expect(org3.slug).toBe('atelier-lumen-3')
  })

  it('translittère les accents comme le front', async () => {
    const org = await creerOrg(david, 'Société Générale d’Études')
    expect(org.slug).toBe('societe-generale-d-etudes')
  })

  it('n’attribue jamais un slug réservé aux routes de l’application', async () => {
    expect((await creerOrg(david, 'Connexion')).slug).toBe('connexion-2')
    expect((await creerOrg(david, 'Admin')).slug).toBe('admin-2')
  })

  it('refuse un nom vide et un appel anonyme', async () => {
    await expect(banc.enTantQue(alice).query("select public.create_organization('   ')")).rejects.toThrow(/obligatoire/)
    await expect(banc.enTantQue(null).query("select public.create_organization('Pirate')")).rejects.toThrow(
      /permission denied/,
    )
  })

  it('interdit l’insertion directe dans organizations', async () => {
    await expect(
      banc.enTantQue(alice).query("insert into organizations (slug, name) values ('directe', 'Directe')"),
    ).rejects.toThrow(/permission denied/)
  })
})

describe('isolation entre organisations', () => {
  it('chacun ne voit que ses organisations', async () => {
    const a = await banc.enTantQue(alice).query('select id from organizations')
    expect(a.rows.map((r) => r.id)).toEqual([orgAlice])
    const b = await banc.enTantQue(bruno).query('select id from organizations')
    expect(b.rows.map((r) => r.id)).toEqual([orgBruno])
  })

  it('un utilisateur ne lit pas les adhésions d’une autre organisation', async () => {
    const { rows } = await banc.enTantQue(bruno).query('select * from memberships where organization_id = $1', [orgAlice])
    expect(rows).toHaveLength(0)
  })

  it('un utilisateur ne modifie pas une autre organisation', async () => {
    const res = await banc.enTantQue(bruno).query("update organizations set name = 'Piraté' where id = $1", [orgAlice])
    expect(res.rowCount).toBe(0)
    const { rows } = await banc.admin.query('select name from organizations where id = $1', [orgAlice])
    expect(rows[0].name).toBe('Atelier Lumen')
  })

  it('un utilisateur ne s’ajoute pas dans une autre organisation', async () => {
    await expect(
      banc
        .enTantQue(bruno)
        .query("insert into memberships (organization_id, user_id, role) values ($1, $2, 'owner')", [orgAlice, bruno]),
    ).rejects.toThrow(/row-level security/)
  })

  it('un utilisateur ne retire personne d’une autre organisation', async () => {
    const res = await banc.enTantQue(bruno).query('delete from memberships where organization_id = $1', [orgAlice])
    expect(res.rowCount).toBe(0)
  })

  it('anon ne voit rien et ne peut rien lire', async () => {
    await expect(banc.enTantQue(null).query('select * from organizations')).rejects.toThrow(/permission denied/)
    await expect(banc.enTantQue(null).query('select * from memberships')).rejects.toThrow(/permission denied/)
    await expect(banc.enTantQue(null).query('select * from profiles')).rejects.toThrow(/permission denied/)
  })
})

describe('profils', () => {
  it('sont créés à l’inscription', async () => {
    const { rows } = await banc.enTantQue(alice).query('select email, full_name from profiles where id = $1', [alice])
    expect(rows).toEqual([{ email: 'alice@exemple.fr', full_name: 'Alice Martin' }])
  })

  it('ne sont visibles qu’entre membres d’une même organisation', async () => {
    const avant = await banc.enTantQue(alice).query('select id from profiles where id = $1', [chloe])
    expect(avant.rows).toHaveLength(0)
    const etranger = await banc.enTantQue(bruno).query('select id from profiles where id = $1', [alice])
    expect(etranger.rows).toHaveLength(0)
  })

  it('ne se modifient que soi-même, et seulement le nom', async () => {
    const autre = await banc.enTantQue(bruno).query("update profiles set full_name = 'X' where id = $1", [alice])
    expect(autre.rowCount).toBe(0)
    const soi = await banc.enTantQue(alice).query("update profiles set full_name = 'Alice M.' where id = $1", [alice])
    expect(soi.rowCount).toBe(1)
    await expect(
      banc.enTantQue(alice).query("update profiles set email = 'x@y.z' where id = $1", [alice]),
    ).rejects.toThrow(/permission denied/)
  })
})

describe('rôles', () => {
  it('un propriétaire ajoute un membre, qui voit alors l’organisation', async () => {
    await banc
      .enTantQue(alice)
      .query("insert into memberships (organization_id, user_id, role) values ($1, $2, 'viewer')", [orgAlice, chloe])
    const { rows } = await banc.enTantQue(chloe).query('select id from organizations')
    expect(rows.map((r) => r.id)).toEqual([orgAlice])
    const profils = await banc.enTantQue(chloe).query('select id from profiles where id = $1', [alice])
    expect(profils.rows).toHaveLength(1)
  })

  it('un membre en lecture seule ne modifie ni l’organisation ni son propre rôle', async () => {
    const maj = await banc.enTantQue(chloe).query("update organizations set name = 'Non' where id = $1", [orgAlice])
    expect(maj.rowCount).toBe(0)
    const role = await banc
      .enTantQue(chloe)
      .query("update memberships set role = 'admin' where organization_id = $1 and user_id = $2", [orgAlice, chloe])
    expect(role.rowCount).toBe(0)
  })

  it('les colonnes protégées ne sont pas modifiables', async () => {
    await expect(
      banc.enTantQue(alice).query("update organizations set slug = 'autre' where id = $1", [orgAlice]),
    ).rejects.toThrow(/permission denied/)
    await expect(
      banc.enTantQue(alice).query('update organizations set created_by = $2 where id = $1', [orgAlice, bruno]),
    ).rejects.toThrow(/permission denied/)
  })

  it('un propriétaire modifie l’identité de son organisation', async () => {
    const res = await banc
      .enTantQue(alice)
      .query("update organizations set siren = '732829320', vat_regime = 'reel_normal' where id = $1", [orgAlice])
    expect(res.rowCount).toBe(1)
  })

  it('un admin gère les membres mais pas les propriétaires', async () => {
    await banc
      .enTantQue(alice)
      .query("update memberships set role = 'admin' where organization_id = $1 and user_id = $2", [orgAlice, chloe])

    await expect(
      banc
        .enTantQue(chloe)
        .query("insert into memberships (organization_id, user_id, role) values ($1, $2, 'owner')", [orgAlice, david]),
    ).rejects.toThrow(/row-level security/)

    await banc
      .enTantQue(chloe)
      .query("insert into memberships (organization_id, user_id, role) values ($1, $2, 'billing')", [orgAlice, david])

    const retrograder = await banc
      .enTantQue(chloe)
      .query("update memberships set role = 'viewer' where organization_id = $1 and user_id = $2", [orgAlice, alice])
    expect(retrograder.rowCount).toBe(0)

    await expect(
      banc
        .enTantQue(chloe)
        .query("update memberships set role = 'owner' where organization_id = $1 and user_id = $2", [orgAlice, chloe]),
    ).rejects.toThrow(/row-level security/)

    const retirer = await banc
      .enTantQue(chloe)
      .query('delete from memberships where organization_id = $1 and user_id = $2', [orgAlice, alice])
    expect(retirer.rowCount).toBe(0)
  })

  it('un membre peut quitter une organisation', async () => {
    const res = await banc
      .enTantQue(david)
      .query('delete from memberships where organization_id = $1 and user_id = $2', [orgAlice, david])
    expect(res.rowCount).toBe(1)
  })

  it('le dernier propriétaire ne peut ni partir ni être rétrogradé', async () => {
    await expect(
      banc.enTantQue(alice).query('delete from memberships where organization_id = $1 and user_id = $2', [orgAlice, alice]),
    ).rejects.toThrow(/au moins un propriétaire/)
    await expect(
      banc
        .enTantQue(alice)
        .query("update memberships set role = 'admin' where organization_id = $1 and user_id = $2", [orgAlice, alice]),
    ).rejects.toThrow(/au moins un propriétaire/)
  })

  it('avec un second propriétaire, le premier peut partir', async () => {
    await banc
      .enTantQue(alice)
      .query("update memberships set role = 'owner' where organization_id = $1 and user_id = $2", [orgAlice, chloe])
    const res = await banc
      .enTantQue(alice)
      .query('delete from memberships where organization_id = $1 and user_id = $2', [orgAlice, alice])
    expect(res.rowCount).toBe(1)
    const { rows } = await banc.enTantQue(alice).query('select id from organizations where id = $1', [orgAlice])
    expect(rows).toHaveLength(0)
  })
})

describe('fonctions privées', () => {
  it('ne sont pas appelables par anon', async () => {
    await expect(banc.enTantQue(null).query('select private.is_member($1)', [orgAlice])).rejects.toThrow(
      /permission denied/,
    )
  })
})
