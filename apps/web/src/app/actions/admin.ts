'use server'

import { revalidatePath } from 'next/cache'
import { exigerAdmin } from '@/lib/admin'
import type { EtatSuivi } from './suivi'

export async function modifierMention(cle: string, _: EtatSuivi, f: FormData): Promise<EtatSuivi> {
  const service = await exigerAdmin()
  const texte = String(f.get('texte') ?? '').trim()
  if (!texte || texte.length > 600) return { erreur: 'Texte de 1 à 600 caractères.' }
  const { error } = await service.from('legal_mentions').update({ text: texte, updated_at: new Date().toISOString() }).eq('key', cle)
  if (error) return { erreur: 'Enregistrement impossible.' }
  revalidatePath('/admin')
  return { ok: true, message: 'Mention mise à jour.' }
}

export async function ajouterTaux(_: EtatSuivi, f: FormData): Promise<EtatSuivi> {
  const service = await exigerAdmin()
  const taux = Math.round(Number(String(f.get('taux') ?? '').replace(',', '.')) * 100)
  const territoire = String(f.get('territoire') ?? 'metropole')
  const libelle = String(f.get('libelle') ?? '').trim().slice(0, 60)
  const debut = String(f.get('debut') ?? '')
  if (!Number.isInteger(taux) || taux < 0 || taux > 10_000 || !libelle || !/^\d{4}-\d{2}-\d{2}$/.test(debut)) return { erreur: 'Taux, libellé et date de début requis.' }
  const { error } = await service.from('vat_rates').insert({ territory: territoire, label: libelle, rate: taux, valid_from: debut })
  if (error) return { erreur: 'Enregistrement impossible.' }
  revalidatePath('/admin')
  return { ok: true, message: 'Taux ajouté.' }
}

export async function publierAnnonce(_: EtatSuivi, f: FormData): Promise<EtatSuivi> {
  const service = await exigerAdmin()
  const titre = String(f.get('titre') ?? '').trim().slice(0, 120)
  const corps = String(f.get('corps') ?? '').trim().slice(0, 600)
  const fin = String(f.get('fin') ?? '')
  if (!titre || !corps) return { erreur: 'Titre et texte requis.' }
  const { error } = await service.from('announcements').insert({
    title: titre,
    body: corps,
    level: f.get('important') === 'on' ? 'important' : 'info',
    ends_at: /^\d{4}-\d{2}-\d{2}$/.test(fin) ? `${fin}T23:59:59Z` : null,
  })
  if (error) return { erreur: 'Publication impossible.' }
  revalidatePath('/admin')
  return { ok: true, message: 'Annonce publiée.' }
}

export async function terminerAnnonce(id: string): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const service = await exigerAdmin()
  await service.from('announcements').update({ ends_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/admin')
  return { ok: true }
}
