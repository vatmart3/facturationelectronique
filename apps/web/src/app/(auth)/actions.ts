'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { emailValide, motDePasseValide, suiteSure, traduireErreurAuth } from '@/lib/auth'
import { creerClientServeur } from '@/lib/supabase/serveur'

export interface EtatFormulaire {
  erreur?: string
  succes?: string
  email?: string
}

async function origine(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  const h = await headers()
  const hote = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (hote.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${hote}`
}

function texte(formData: FormData, cle: string): string {
  const v = formData.get(cle)
  return typeof v === 'string' ? v.trim() : ''
}

export async function seConnecter(_: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const email = texte(formData, 'email').toLowerCase()
  const motDePasse = String(formData.get('mot_de_passe') ?? '')
  if (!emailValide(email)) return { erreur: 'Saisissez une adresse email valide.', email }
  if (!motDePasse) return { erreur: 'Saisissez votre mot de passe.', email }

  const supabase = await creerClientServeur()
  const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse })
  if (error) return { erreur: traduireErreurAuth(error.code), email }
  redirect(suiteSure(formData.get('suite')))
}

export async function envoyerLienMagique(_: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const email = texte(formData, 'email').toLowerCase()
  if (!emailValide(email)) return { erreur: 'Saisissez une adresse email valide.', email }
  const suite = suiteSure(formData.get('suite'))

  const supabase = await creerClientServeur()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await origine()}/auth/callback?suite=${encodeURIComponent(suite)}` },
  })
  if (error) return { erreur: traduireErreurAuth(error.code), email }
  return { succes: `Lien de connexion envoyé à ${email}. Il est valable une heure.`, email }
}

export async function sInscrire(_: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const email = texte(formData, 'email').toLowerCase()
  const nom = texte(formData, 'nom').slice(0, 200)
  const motDePasse = String(formData.get('mot_de_passe') ?? '')
  if (!nom) return { erreur: 'Indiquez votre nom.', email }
  if (!emailValide(email)) return { erreur: 'Saisissez une adresse email valide.', email }
  if (!motDePasseValide(motDePasse)) return { erreur: traduireErreurAuth('weak_password'), email }

  const supabase = await creerClientServeur()
  const { data, error } = await supabase.auth.signUp({
    email,
    password: motDePasse,
    options: {
      data: { full_name: nom },
      emailRedirectTo: `${await origine()}/auth/callback?suite=/bienvenue`,
    },
  })
  if (error) return { erreur: traduireErreurAuth(error.code), email }
  if (!data.session) {
    return { succes: `Compte créé. Confirmez votre adresse grâce au lien envoyé à ${email}.`, email }
  }
  redirect('/bienvenue')
}

export async function connexionGoogle(formData: FormData): Promise<void> {
  const suite = suiteSure(formData.get('suite'))
  const supabase = await creerClientServeur()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${await origine()}/auth/callback?suite=${encodeURIComponent(suite)}` },
  })
  if (error || !data.url) redirect('/connexion?erreur=google')
  redirect(data.url)
}

export async function demanderReinitialisation(_: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const email = texte(formData, 'email').toLowerCase()
  if (!emailValide(email)) return { erreur: 'Saisissez une adresse email valide.', email }
  const supabase = await creerClientServeur()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await origine()}/auth/callback?suite=/mot-de-passe/nouveau`,
  })
  if (error) return { erreur: traduireErreurAuth(error.code), email }
  // Même message que le compte existe ou non, pour ne pas révéler les adresses inscrites.
  return { succes: `Si un compte existe pour ${email}, un lien de réinitialisation vient d’être envoyé.`, email }
}

export async function changerMotDePasse(_: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const motDePasse = String(formData.get('mot_de_passe') ?? '')
  if (!motDePasseValide(motDePasse)) return { erreur: traduireErreurAuth('weak_password') }
  const supabase = await creerClientServeur()
  const { error } = await supabase.auth.updateUser({ password: motDePasse })
  if (error) return { erreur: traduireErreurAuth(error.code) }
  redirect('/')
}

export async function seDeconnecter(): Promise<void> {
  const supabase = await creerClientServeur()
  await supabase.auth.signOut()
  redirect('/connexion')
}
