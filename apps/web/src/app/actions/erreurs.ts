'use server'

import { lireUtilisateur } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

/**
 * Erreur d'affichage remontée par une page : enregistrée dans le journal des erreurs
 * (visible dans /admin) pour les utilisateurs connectés. Ne bloque jamais l'affichage.
 */
export async function signalerErreur(e: { message: string; digest?: string; chemin: string }): Promise<void> {
  try {
    const utilisateur = await lireUtilisateur()
    if (!utilisateur) return
    const supabase = await creerClientServeur()
    await supabase.from('error_logs').insert({
      organization_id: null,
      kind: 'autre',
      message: `Affichage : ${String(e.message || 'erreur inconnue')}`.slice(0, 2000),
      context: { digest: e.digest?.slice(0, 100) ?? null, chemin: String(e.chemin).slice(0, 300) },
    })
  } catch {
    // Le journal est un confort : son échec ne doit rien casser.
  }
}
