'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { creerClientServeur } from '@/lib/supabase/serveur'

export type EtatSignature = { erreur?: string; decision?: 'accepte' | 'refuse' } | null

/** Décision du client sur un devis, depuis le lien public (sans compte). */
export async function signerDevis(token: string, _: EtatSignature, f: FormData): Promise<EtatSignature> {
  const decision = f.get('decision') === 'refuse' ? 'refuse' : 'accepte'
  const nom = String(f.get('nom') ?? '').trim()
  if (nom.length < 2) return { erreur: 'Indiquez votre nom et prénom.' }
  if (decision === 'accepte' && f.get('accord') !== 'on') return { erreur: 'Cochez « Bon pour accord » pour accepter le devis.' }
  const email = String(f.get('email') ?? '').trim()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { erreur: 'Adresse email invalide.' }
  const supabase = await creerClientServeur()
  const { error } = await supabase.rpc('signer_devis', {
    p_token: token,
    p_decision: decision,
    p_nom: nom.slice(0, 120),
    p_email: email || null,
    p_commentaire: String(f.get('commentaire') ?? '').slice(0, 1000) || null,
    p_agent: (await headers()).get('user-agent') ?? '',
  })
  if (error) return { erreur: error.message || 'Enregistrement impossible.' }
  revalidatePath(`/d/${token}`)
  return { decision }
}
