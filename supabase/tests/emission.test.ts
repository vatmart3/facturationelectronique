/** Émission : numérotation sans trou, contenu figé, chaînage des empreintes, audit. */
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Banc, enTantQueSur, ouvrirBanc } from './base'

let banc: Banc
let alice: string
let lecteur: string
let org: string
let client: string

async function brouillon(type = 'facture', date = '2026-10-01', origine: string | null = null, ttc = 12000): Promise<string> {
  const { rows } = await banc
    .enTantQue(alice)
    .query<{ id: string }>(
      'insert into documents (organization_id, type, client_id, issue_date, origin_document_id, total_ht, total_vat, total_ttc, amount_due) values ($1, $2, $3, $4, $5, $6, $7, $8, $8) returning id',
      [org, type, client, date, origine, Math.round(ttc / 1.2), ttc - Math.round(ttc / 1.2), ttc],
    )
  const id = rows[0]!.id
  await banc
    .enTantQue(alice)
    .query("insert into document_lines (organization_id, document_id, position, designation, quantity_milli, unit_price_cents) values ($1, $2, 1, 'Conseil', $3, 10000)", [
      org,
      id,
      ttc < 0 ? -1000 : 1000,
    ])
  return id
}

async function emettre(id: string) {
  return (await banc.enTantQue(alice).query<{ number: string; status: string; content_hash: string; previous_hash: string | null }>('select * from emettre_document($1)', [id])).rows[0]!
}

beforeAll(async () => {
  banc = await ouvrirBanc()
  alice = await banc.creerUtilisateur('alice@exemple.fr')
  lecteur = await banc.creerUtilisateur('lecteur@exemple.fr')
  org = (await banc.enTantQue(alice).query<{ id: string }>("select id from create_organization('Atelier')")).rows[0]!.id
  await banc.admin.query("insert into memberships (organization_id, user_id, role) values ($1, $2, 'viewer')", [org, lecteur])
  await banc.enTantQue(alice).query('update organizations set invoice_start_number = 42 where id = $1', [org])
  client = (await banc.enTantQue(alice).query<{ id: string }>("insert into clients (organization_id, kind, name, siren) values ($1, 'b2b', 'Dupont', '404833048') returning id", [org]))
    .rows[0]!.id
})

afterAll(async () => {
  await banc?.fermer()
})

describe('numérotation', () => {
  it('commence au numéro de départ, au format de l’entreprise', async () => {
    expect((await emettre(await brouillon())).number).toBe('F-2026-0042')
    expect((await emettre(await brouillon())).number).toBe('F-2026-0043')
  })

  it('les factures d’acompte partagent la série des factures ; avoirs et devis ont la leur', async () => {
    expect((await emettre(await brouillon('acompte'))).number).toBe('F-2026-0044')
    const devis = await emettre(await brouillon('devis'))
    expect(devis).toMatchObject({ number: 'D-2026-0001', status: 'envoye' })
  })

  it('le numéro de départ est ensuite figé', async () => {
    await expect(banc.enTantQue(alice).query('update organizations set invoice_start_number = 1 where id = $1', [org])).rejects.toThrow(/numéro de départ/)
  })

  it('refuse une date antérieure au dernier document de la série, ou future', async () => {
    await expect(emettre(await brouillon('facture', '2026-09-30'))).rejects.toThrow(/chronologique/)
    await expect(emettre(await brouillon('facture', '2099-01-01'))).rejects.toThrow(/futur/)
  })

  it('une nouvelle année repart à 1', async () => {
    await banc.admin.query("update documents set issue_date = '2025-12-31' where status = 'brouillon' and issue_date = '2026-09-30'")
    // Série 2025 vierge : on n'applique pas le numéro de départ une seconde fois.
    const id = (await banc.admin.query<{ id: string }>("select id from documents where issue_date = '2025-12-31'")).rows[0]!.id
    expect((await emettre(id)).number).toBe('F-2025-0001')
  })

  it('refuse un document sans client ou sans ligne, et un lecteur', async () => {
    const vide = (await banc.enTantQue(alice).query<{ id: string }>("insert into documents (organization_id, type, client_id, issue_date) values ($1, 'facture', $2, '2026-10-02') returning id", [org, client])).rows[0]!.id
    await expect(emettre(vide)).rejects.toThrow(/aucune ligne/)
    const sansClient = (await banc.enTantQue(alice).query<{ id: string }>("insert into documents (organization_id, type, issue_date) values ($1, 'facture', '2026-10-02') returning id", [org])).rows[0]!.id
    await expect(emettre(sansClient)).rejects.toThrow(/client/)
    const id = await brouillon('facture', '2026-10-02')
    await expect(banc.enTantQue(lecteur).query('select emettre_document($1)', [id])).rejects.toThrow(/introuvable/)
    await expect(emettre(await brouillon('avoir', '2026-10-02'))).rejects.toThrow(/avoir doit se rapporter/)
  })

  it('aucun trou ni doublon sous émissions concurrentes', async () => {
    const ids = await Promise.all(Array.from({ length: 8 }, () => brouillon('facture', '2026-10-05')))
    const connexions = await Promise.all(
      ids.map(async () => {
        const c = new pg.Client({ connectionString: banc.url })
        await c.connect()
        return c
      }),
    )
    try {
      const numeros = await Promise.all(
        ids.map((id, i) => enTantQueSur(connexions[i]!, alice, 'select number from emettre_document($1)', [id]).then((r) => r.rows[0].number as string)),
      )
      const n = numeros.map((x) => Number(x.slice(-4))).sort((a, b) => a - b)
      expect(new Set(n).size).toBe(8)
      expect(n.at(-1)! - n[0]! + 1).toBe(8)
      const { rows } = await banc.admin.query<{ sequence_number: number }>(
        "select sequence_number from documents where sequence_key = 'facture:2026' order by sequence_number",
      )
      rows.forEach((r, i) => expect(r.sequence_number).toBe(42 + i))
    } finally {
      await Promise.all(connexions.map((c) => c.end()))
    }
  })
})

describe('intégrité', () => {
  it('un document émis est figé, même pour l’administrateur de la base', async () => {
    const { rows } = await banc.admin.query<{ id: string }>("select id from documents where number = 'F-2026-0042'")
    const id = rows[0]!.id
    await expect(banc.admin.query("update documents set total_ttc = 1 where id = $1", [id])).rejects.toThrow(/figé/)
    await expect(banc.admin.query('delete from documents where id = $1', [id])).rejects.toThrow(/avoir/)
    await expect(banc.admin.query("update document_lines set designation = 'X' where document_id = $1", [id])).rejects.toThrow(/figées/)
    await expect(banc.admin.query("update documents set status = 'brouillon' where id = $1", [id])).rejects.toThrow(/statut impossible/)
    await banc.admin.query("update documents set status = 'envoye', sent_at = now() where id = $1", [id])
  })

  it('les empreintes sont chaînées et vérifiables', async () => {
    const { rows } = await banc.enTantQue(alice).query<{ empreinte_ok: boolean; lien_ok: boolean }>('select * from verifier_chaine($1)', [org])
    expect(rows.length).toBeGreaterThan(10)
    expect(rows.every((r) => r.empreinte_ok && r.lien_ok)).toBe(true)
    const premier = (await banc.admin.query<{ previous_hash: string | null; content_hash: string }>('select previous_hash, content_hash from documents where chain_position = 1')).rows[0]!
    expect(premier.previous_hash).toBeNull()
    expect(premier.content_hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('une altération (triggers désactivés) est détectée', async () => {
    await banc.admin.query('alter table documents disable trigger documents_fige')
    await banc.admin.query("update documents set total_ttc = total_ttc + 1 where number = 'F-2026-0043'")
    await banc.admin.query('alter table documents enable trigger documents_fige')
    const { rows } = await banc.enTantQue(alice).query<{ number: string; empreinte_ok: boolean }>('select * from verifier_chaine($1)', [org])
    expect(rows.filter((r) => !r.empreinte_ok).map((r) => r.number)).toEqual(['F-2026-0043'])
  })

  it('le journal d’audit enregistre et ne s’efface pas', async () => {
    const { rows } = await banc.enTantQue(alice).query<{ action: string }>("select action from audit_log where action = 'document.emis'")
    expect(rows.length).toBeGreaterThan(5)
    await expect(banc.admin.query('delete from audit_log')).rejects.toThrow(/journal/)
    await expect(banc.enTantQue(alice).query('insert into audit_log (organization_id, action, entity) values ($1, $2, $3)', [org, 'x', 'y'])).rejects.toThrow(/permission/)
    expect((await banc.enTantQue(lecteur).query('select * from audit_log')).rows).toHaveLength(0)
  })
})

describe('effets sur le document d’origine', () => {
  it('un avoir total annule la facture ; une facture transforme le devis', async () => {
    const facture = await brouillon('facture', '2026-10-06')
    await emettre(facture)
    await emettre(await brouillon('avoir', '2026-10-06', facture, -12000))
    expect((await banc.admin.query('select status from documents where id = $1', [facture])).rows[0].status).toBe('annule')

    const devis = await brouillon('devis', '2026-10-06')
    await emettre(devis)
    await banc.enTantQue(alice).query("select changer_statut($1, 'accepte')", [devis])
    await emettre(await brouillon('facture', '2026-10-06', devis))
    expect((await banc.admin.query('select status, accepted_at from documents where id = $1', [devis])).rows[0]).toMatchObject({ status: 'transforme' })
  })

  it('un avoir partiel laisse la facture ouverte', async () => {
    const facture = await brouillon('facture', '2026-10-06')
    await emettre(facture)
    const avoir = await emettre(await brouillon('avoir', '2026-10-06', facture, -6000))
    expect(avoir.number).toMatch(/^A-2026-/)
    expect((await banc.admin.query('select status from documents where id = $1', [facture])).rows[0].status).toBe('emis')
  })

  it('changer_statut refuse les transitions interdites', async () => {
    const facture = await brouillon('facture', '2026-10-07')
    await expect(banc.enTantQue(alice).query("select changer_statut($1, 'envoye')", [facture])).rejects.toThrow(/impossible/)
    await emettre(facture)
    await expect(banc.enTantQue(alice).query("select changer_statut($1, 'paye')", [facture])).rejects.toThrow(/impossible/)
    await expect(banc.enTantQue(alice).query("select changer_statut($1, 'accepte')", [facture])).rejects.toThrow(/statut impossible/)
    await banc.enTantQue(alice).query("select changer_statut($1, 'envoye')", [facture])
  })
})
