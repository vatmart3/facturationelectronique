import { describe, expect, it } from 'vitest'
import { normaliserCle, normaliserUrlSupabase } from './env'

describe('configuration Supabase', () => {
  it('accepte les copies courantes de l’URL du projet', () => {
    expect(normaliserUrlSupabase('https://abcd.supabase.co')).toBe('https://abcd.supabase.co')
    expect(normaliserUrlSupabase(' https://abcd.supabase.co/ ')).toBe('https://abcd.supabase.co')
    expect(normaliserUrlSupabase('https://abcd.supabase.co/rest/v1/')).toBe('https://abcd.supabase.co')
    expect(normaliserUrlSupabase('"https://abcd.supabase.co"')).toBe('https://abcd.supabase.co')
    expect(normaliserUrlSupabase('abcd.supabase.co')).toBe('https://abcd.supabase.co')
    expect(normaliserUrlSupabase('http://localhost:54321')).toBe('http://localhost:54321')
    expect(normaliserUrlSupabase(' http://localhost:54321/rest/v1/ ')).toBe('http://localhost:54321')
  })

  it('retrouve l’URL du projet depuis le lien du tableau de bord, la référence ou la chaîne Postgres', () => {
    const ref = 'mgfcmsxayycudcgsfdtd'
    expect(normaliserUrlSupabase(`https://supabase.com/dashboard/project/${ref}/settings/api`)).toBe(`https://${ref}.supabase.co`)
    expect(normaliserUrlSupabase(ref)).toBe(`https://${ref}.supabase.co`)
    expect(normaliserUrlSupabase(`postgresql://postgres:motdepasse@db.${ref}.supabase.co:5432/postgres`)).toBe(`https://${ref}.supabase.co`)
    expect(normaliserUrlSupabase(`postgresql://postgres.${ref}:motdepasse@aws-0-eu-west-3.pooler.supabase.com:6543/postgres`)).toBe(`https://${ref}.supabase.co`)
    expect(normaliserUrlSupabase(`https://${ref}.supabase.co/storage/v1/`)).toBe(`https://${ref}.supabase.co`)
  })

  it('refuse ce qui n’est pas l’URL du projet', () => {
    expect(normaliserUrlSupabase('')).toBeNull()
    expect(normaliserUrlSupabase(undefined)).toBeNull()
    expect(normaliserUrlSupabase('https://supabase.com/dashboard/project/abcd')).toBeNull()
    expect(normaliserUrlSupabase('sb_publishable_xxx')).toBeNull()
  })

  it('nettoie les clés collées avec espaces, guillemets ou retour à la ligne', () => {
    expect(normaliserCle(' sb_publishable_abc\n')).toBe('sb_publishable_abc')
    expect(normaliserCle("'sb_publishable_abc'")).toBe('sb_publishable_abc')
    expect(normaliserCle('   ')).toBeNull()
  })
})
