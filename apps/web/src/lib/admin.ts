import 'server-only'
import { exigerUtilisateur } from './session'
import { creerClientServeur } from './supabase/serveur'
import { creerClientService } from './supabase/service'

/** Administrateur de la plateforme (table platform_admins) ; renvoie le client service. */
export async function exigerAdmin() {
  const u = await exigerUtilisateur()
  const supabase = await creerClientServeur()
  const { data } = await supabase.from('platform_admins').select('user_id').eq('user_id', u.id).maybeSingle()
  if (!data) throw new Error('Accès réservé à l’administration de la plateforme.')
  const service = creerClientService()
  if (!service) throw new Error('SUPABASE_SERVICE_ROLE_KEY manquante.')
  return service
}
