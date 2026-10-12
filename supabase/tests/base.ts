/**
 * Banc de test SQL : crée une base jetable, applique l'imitation Supabase puis
 * toutes les migrations dans l'ordre, et exécute des requêtes « en tant que » un utilisateur.
 *
 * DATABASE_URL doit pointer vers un Postgres où l'on peut créer des bases
 * (par défaut postgres://postgres:postgres@localhost:54329/postgres).
 */
import { randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'

const ADMIN_URL = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:54329/postgres'
const DOSSIER = join(import.meta.dirname, '..')

export interface Banc {
  admin: pg.Client
  creerUtilisateur(email: string, nom?: string): Promise<string>
  enTantQue(userId: string | null): Requeteur
  fermer(): Promise<void>
}

export interface Requeteur {
  query<T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, params?: unknown[]): Promise<pg.QueryResult<T>>
}

export async function ouvrirBanc(): Promise<Banc> {
  const nomBase = `pastille_test_${randomUUID().replace(/-/g, '').slice(0, 12)}`
  const maitre = new pg.Client({ connectionString: ADMIN_URL })
  await maitre.connect()
  await maitre.query(`create database ${nomBase}`)

  const url = new URL(ADMIN_URL)
  url.pathname = `/${nomBase}`
  const admin = new pg.Client({ connectionString: url.toString() })
  await admin.connect()

  await admin.query(readFileSync(join(DOSSIER, 'tests', 'stub-supabase.sql'), 'utf8'))
  const migrations = readdirSync(join(DOSSIER, 'migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort()
  for (const fichier of migrations) {
    await admin.query(readFileSync(join(DOSSIER, 'migrations', fichier), 'utf8'))
  }

  return {
    admin,
    async creerUtilisateur(email, nom) {
      const { rows } = await admin.query<{ id: string }>(
        'insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id',
        [email, JSON.stringify(nom ? { full_name: nom } : {})],
      )
      return rows[0]!.id
    },
    enTantQue(userId) {
      return {
        async query(sql, params) {
          await admin.query('begin')
          try {
            await admin.query(`set local role ${userId ? 'authenticated' : 'anon'}`)
            await admin.query("select set_config('request.jwt.claims', $1, true)", [
              JSON.stringify(userId ? { sub: userId, role: 'authenticated' } : { role: 'anon' }),
            ])
            const resultat = await admin.query(sql, params)
            await admin.query('commit')
            return resultat
          } catch (erreur) {
            await admin.query('rollback')
            throw erreur
          }
        },
      }
    },
    async fermer() {
      await admin.end()
      await maitre.query(`drop database if exists ${nomBase} with (force)`)
      await maitre.end()
    },
  }
}
