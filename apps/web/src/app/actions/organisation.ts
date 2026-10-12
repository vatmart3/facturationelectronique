'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { validerIdentite, type ErreursIdentite } from '@/lib/organisation'
import { estRole, peutAgirSur, rolesAttribuables } from '@/lib/roles'
import { chargerContexte, exigerUtilisateur } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

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
  redirect(`/${data.slug}/reglages?bienvenue=1`)
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
