import { aujourdHui } from '@/lib/document'
import { creerClientService } from '@/lib/supabase/service'
import { actualiserTransmission, releverFactures } from '@/lib/plateforme-serveur'
import { executerRecurrences, executerRelances } from '@/lib/taches'

/**
 * Tâche quotidienne (Vercel Cron, vercel.json) : factures récurrentes puis relances,
 * pour chaque organisation. Protégée par CRON_SECRET ; nécessite SUPABASE_SERVICE_ROLE_KEY.
 */
export const maxDuration = 300

export async function GET(requete: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || requete.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Non autorisé', { status: 401 })
  const supabase = creerClientService()
  if (!supabase) return Response.json({ erreur: 'SUPABASE_SERVICE_ROLE_KEY manquante' }, { status: 503 })

  const jour = aujourdHui()
  const { data: organisations, error } = await supabase.from('organizations').select('*')
  if (error) return Response.json({ erreur: error.message }, { status: 500 })
  const bilan: Record<string, unknown> = {}
  for (const organisation of organisations ?? []) {
    try {
      const recurrences = await executerRecurrences(supabase, organisation, jour)
      const relances = await executerRelances(supabase, organisation, jour)
      // Plateforme agréée : statuts des flux en cours, factures reçues.
      const { data: enCours } = await supabase.from('einvoice_transmissions').select('*').eq('organization_id', organisation.id).lt('status_code', 205)
      for (const t of enCours ?? []) await actualiserTransmission(supabase, organisation, t)
      const reception = organisation.pa_provider === 'afnor' ? await releverFactures(supabase, organisation) : null
      bilan[organisation.slug] = { recurrences, relances, transmissions: enCours?.length ?? 0, reception }
    } catch (e) {
      bilan[organisation.slug] = { erreur: e instanceof Error ? e.message : 'inconnue' }
    }
  }
  return Response.json({ jour, bilan })
}
