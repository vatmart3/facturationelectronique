'use server'

import { redirect } from 'next/navigation'
import { exigerUtilisateur } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import type { EtatSuivi } from './suivi'

export async function modifierNom(_: EtatSuivi, f: FormData): Promise<EtatSuivi> {
  const u = await exigerUtilisateur()
  const nom = String(f.get('nom') ?? '').trim().slice(0, 200)
  if (!nom) return { erreur: 'Indiquez votre nom.' }
  const supabase = await creerClientServeur()
  const { error } = await supabase.from('profiles').update({ full_name: nom }).eq('id', u.id)
  return error ? { erreur: 'Enregistrement impossible.' } : { ok: true, message: 'Nom enregistré.' }
}

export async function supprimerCompte(_: EtatSuivi, f: FormData): Promise<EtatSuivi> {
  await exigerUtilisateur()
  const supabase = await creerClientServeur()
  const { error } = await supabase.rpc('supprimer_mon_compte', { p_confirmation: String(f.get('confirmation') ?? '').trim() })
  if (error) return { erreur: error.message }
  await supabase.auth.signOut()
  redirect('/?compte=supprime')
}
