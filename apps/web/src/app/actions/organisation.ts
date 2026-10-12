'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { normaliserIban } from '@/lib/format'
import { bicValide, ibanValide } from '@/lib/identifiants'
import { formatValide } from '@/lib/numerotation'
import { validerFacturation, validerIdentite, type ErreursIdentite } from '@/lib/organisation'
import { estRole, peutAgirSur, rolesAttribuables } from '@/lib/roles'
import { chargerContexte, exigerUtilisateur } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import type { OrganizationUpdate } from '@/lib/supabase/types'

export interface EtatCreation {
  erreur?: string
  nom?: string
}

export async function creerOrganisation(_: EtatCreation, formData: FormData): Promise<EtatCreation> {
  await exigerUtilisateur()
  const nom = String(formData.get('nom') ?? '').trim()
  if (!nom) return { erreur: 'Indiquez le nom de votre entreprise.' }
  if (nom.length > 200) return { erreur: '200 caractères maximum.', nom }

  const supabase = await creerClientServeur()
  const { data, error } = await supabase.rpc('create_organization', { p_name: nom })
  if (error || !data) {
    return {
      erreur: error?.message.includes('maximal') ? 'Vous avez atteint le nombre maximal d’entreprises.' : 'La création a échoué. Réessayez.',
      nom,
    }
  }

  // Identité trouvée dans la base INSEE : enregistrée seulement si elle est valide.
  const { donnees, erreurs } = validerIdentite((cle) => (cle === 'name' ? nom : String(formData.get(cle) ?? '').trim()))
  const identite: OrganizationUpdate = {}
  for (const cle of ['legal_form', 'siren', 'siret', 'vat_number', 'naf_code', 'address_line1', 'postal_code', 'city'] as const) {
    const valeur = donnees[cle]
    if (!erreurs[cle] && typeof valeur === 'string' && valeur) identite[cle] = valeur
  }
  if (Object.keys(identite).length > 0) await supabase.from('organizations').update(identite).eq('id', data.id)

  redirect(`/${data.slug}/demarrage`)
}

export interface EtatIdentite {
  erreurs?: ErreursIdentite
  erreur?: string
  succes?: string
}

export async function enregistrerIdentite(slug: string, _: EtatIdentite, formData: FormData): Promise<EtatIdentite> {
  const { organisation } = await chargerContexte(slug)
  const { donnees, erreurs } = validerIdentite((cle) => String(formData.get(cle) ?? '').trim())
  if (Object.keys(erreurs).length > 0) {
    return { erreurs, erreur: 'Certains champs sont à corriger.' }
  }

  const supabase = await creerClientServeur()
  // La RLS refuse silencieusement (0 ligne) si l'utilisateur n'est ni propriétaire ni admin.
  const { data, error } = await supabase.from('organizations').update(donnees).eq('id', organisation.id).select('id')
  if (error) return { erreur: 'L’enregistrement a échoué. Vérifiez les champs et réessayez.' }
  if (!data || data.length === 0) return { erreur: 'Vous n’avez pas les droits pour modifier cette entreprise.' }

  revalidatePath(`/${slug}`, 'layout')
  return { succes: 'Identité de l’entreprise enregistrée.' }
}

export interface EtatMembre {
  erreur?: string
  succes?: string
}

export async function changerRole(slug: string, userId: string, _: EtatMembre, formData: FormData): Promise<EtatMembre> {
  const { organisation, role, utilisateur } = await chargerContexte(slug)
  const nouveau = formData.get('role')
  if (!estRole(nouveau)) return { erreur: 'Rôle inconnu.' }
  if (!rolesAttribuables(role).includes(nouveau)) return { erreur: 'Vous ne pouvez pas attribuer ce rôle.' }

  const supabase = await creerClientServeur()
  const { data: cible } = await supabase
    .from('memberships')
    .select('role')
    .eq('organization_id', organisation.id)
    .eq('user_id', userId)
    .maybeSingle()
  if (!cible || !estRole(cible.role)) return { erreur: 'Membre introuvable.' }
  if (!peutAgirSur(role, cible.role)) return { erreur: 'Vous ne pouvez pas modifier ce membre.' }

  const { data, error } = await supabase
    .from('memberships')
    .update({ role: nouveau })
    .eq('organization_id', organisation.id)
    .eq('user_id', userId)
    .select('user_id')
  if (error) {
    return { erreur: error.message.includes('propriétaire') ? error.message : 'La modification a échoué.' }
  }
  if (!data?.length) return { erreur: 'Vous ne pouvez pas modifier ce membre.' }

  revalidatePath(`/${slug}/reglages/membres`)
  if (userId === utilisateur.id) revalidatePath(`/${slug}`, 'layout')
  return { succes: 'Rôle mis à jour.' }
}

export async function retirerMembre(slug: string, userId: string): Promise<EtatMembre> {
  const { organisation, utilisateur } = await chargerContexte(slug)
  const supabase = await creerClientServeur()
  const { data, error } = await supabase
    .from('memberships')
    .delete()
    .eq('organization_id', organisation.id)
    .eq('user_id', userId)
    .select('user_id')
  if (error) {
    return { erreur: error.message.includes('propriétaire') ? error.message : 'Le retrait a échoué.' }
  }
  if (!data?.length) return { erreur: 'Vous ne pouvez pas retirer ce membre.' }

  if (userId === utilisateur.id) redirect('/')
  revalidatePath(`/${slug}/reglages/membres`)
  return { succes: 'Membre retiré.' }
}

export interface EtatFacturation {
  erreurs?: Record<string, string>
  erreur?: string
  succes?: string
}

export async function enregistrerFacturation(slug: string, _: EtatFacturation, formData: FormData): Promise<EtatFacturation> {
  const { organisation } = await chargerContexte(slug)
  const { donnees, erreurs } = validerFacturation((cle) => String(formData.get(cle) ?? '').trim())
  if (Object.keys(erreurs).length > 0) return { erreurs, erreur: 'Certains champs sont à corriger.' }
  const supabase = await creerClientServeur()
  const { data, error } = await supabase.from('organizations').update(donnees).eq('id', organisation.id).select('id')
  if (error) return { erreur: 'L’enregistrement a échoué.' }
  if (!data?.length) return { erreur: 'Vous n’avez pas les droits pour modifier ces réglages.' }
  revalidatePath(`/${slug}`, 'layout')
  return { succes: 'Réglages de facturation enregistrés.' }
}

export async function definirLogo(slug: string, chemin: string | null): Promise<{ erreur?: string }> {
  const { organisation } = await chargerContexte(slug)
  if (chemin && !chemin.startsWith(`${organisation.id}/`)) return { erreur: 'Emplacement de logo invalide.' }
  const supabase = await creerClientServeur()
  const { data, error } = await supabase.from('organizations').update({ logo_path: chemin }).eq('id', organisation.id).select('id')
  if (error || !data?.length) return { erreur: 'Impossible d’enregistrer le logo.' }
  revalidatePath(`/${slug}`, 'layout')
  return {}
}

export type EtapeDemarrage = 'tva' | 'banque' | 'apparence' | 'numerotation' | 'fin'
const SUITE: Record<EtapeDemarrage, EtapeDemarrage | null> = { tva: 'banque', banque: 'apparence', apparence: 'numerotation', numerotation: 'fin', fin: null }

export async function etapeDemarrage(slug: string, etape: EtapeDemarrage, _: EtatFacturation, formData: FormData): Promise<EtatFacturation> {
  const { organisation } = await chargerContexte(slug)
  const lire = (cle: string) => String(formData.get(cle) ?? '').trim()
  const erreurs: Record<string, string> = {}
  let maj: OrganizationUpdate = {}

  if (etape === 'tva') {
    const regime = lire('vat_regime')
    if (!['franchise', 'reel_simplifie', 'reel_normal', 'non_assujetti'].includes(regime)) erreurs.vat_regime = 'Choisissez votre régime de TVA.'
    maj = { vat_regime: regime as OrganizationUpdate['vat_regime'], vat_on_debits: lire('vat_on_debits') === 'on' && regime !== 'franchise' }
  } else if (etape === 'banque') {
    const iban = normaliserIban(lire('iban'))
    const bic = lire('bic').replace(/\s+/g, '').toUpperCase()
    if (iban && !ibanValide(iban)) erreurs.iban = 'IBAN invalide : vérifiez la saisie.'
    if (bic && !bicValide(bic)) erreurs.bic = 'BIC invalide : 8 ou 11 caractères.'
    const conditions = lire('default_payment_terms')
    if (!['reception', '15j', '30j', '30jfm', '45jfm', '60j'].includes(conditions)) erreurs.default_payment_terms = 'Conditions inconnues.'
    maj = { iban: iban || null, bic: bic || null, default_payment_terms: conditions as OrganizationUpdate['default_payment_terms'] }
  } else if (etape === 'apparence') {
    const couleur = lire('accent_color')
    if (!/^#[0-9A-Fa-f]{6}$/.test(couleur)) erreurs.accent_color = 'Couleur invalide.'
    const modele = lire('invoice_template')
    if (!['galet', 'papeterie', 'classique'].includes(modele)) erreurs.invoice_template = 'Modèle inconnu.'
    maj = { accent_color: couleur.toUpperCase(), invoice_template: modele as OrganizationUpdate['invoice_template'] }
  } else if (etape === 'numerotation') {
    const format = lire('invoice_number_format')
    if (!formatValide(format)) erreurs.invoice_number_format = 'Le format doit contenir {NNN} et seulement lettres, chiffres, - _ / .'
    const depart = Number(lire('invoice_start_number') || '1')
    if (!Number.isInteger(depart) || depart < 1 || depart > 99_999_999) erreurs.invoice_start_number = 'Numéro de départ invalide.'
    maj = { invoice_number_format: format, invoice_start_number: depart }
  } else {
    maj = { onboarding_completed_at: new Date().toISOString() }
  }
  if (Object.keys(erreurs).length) return { erreurs, erreur: 'Certains champs sont à corriger.' }

  const supabase = await creerClientServeur()
  const { data, error } = await supabase.from('organizations').update(maj).eq('id', organisation.id).select('id')
  if (error || !data?.length) return { erreur: 'Enregistrement impossible : seuls les propriétaires et administrateurs configurent l’entreprise.' }
  revalidatePath(`/${slug}`, 'layout')
  const suivante = SUITE[etape]
  redirect(suivante ? `/${slug}/demarrage?etape=${suivante}` : `/${slug}/tableau-de-bord`)
}
