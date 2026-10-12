'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { validerProduit, type ErreursProduit } from '@/lib/produits'
import { peutFacturer } from '@/lib/roles'
import { chargerContexte } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export interface EtatProduit {
  erreurs?: ErreursProduit
  erreur?: string
}

export async function enregistrerProduit(slug: string, produitId: string | null, _: EtatProduit, formData: FormData): Promise<EtatProduit> {
  const { organisation, role } = await chargerContexte(slug)
  if (!peutFacturer(role)) return { erreur: 'Votre rôle ne permet pas de modifier le catalogue.' }
  const { donnees, erreurs } = validerProduit((cle) => String(formData.get(cle) ?? '').trim())
  if (Object.keys(erreurs).length > 0) return { erreurs, erreur: 'Certains champs sont à corriger.' }

  const supabase = await creerClientServeur()
  const { error } = produitId
    ? await supabase.from('products').update(donnees).eq('id', produitId).eq('organization_id', organisation.id)
    : await supabase.from('products').insert({ ...donnees, organization_id: organisation.id })
  if (error) return { erreur: 'L’enregistrement a échoué. Réessayez.' }
  revalidatePath(`/${slug}/catalogue`)
  redirect(`/${slug}/catalogue`)
}

export async function basculerFavori(slug: string, produitId: string, favori: boolean): Promise<void> {
  const { organisation } = await chargerContexte(slug)
  const supabase = await creerClientServeur()
  await supabase.from('products').update({ favorite: favori }).eq('id', produitId).eq('organization_id', organisation.id)
  revalidatePath(`/${slug}/catalogue`)
}

export async function archiverProduit(slug: string, produitId: string, archiver: boolean): Promise<void> {
  const { organisation } = await chargerContexte(slug)
  const supabase = await creerClientServeur()
  await supabase
    .from('products')
    .update({ archived_at: archiver ? new Date().toISOString() : null })
    .eq('id', produitId)
    .eq('organization_id', organisation.id)
  revalidatePath(`/${slug}/catalogue`)
}
