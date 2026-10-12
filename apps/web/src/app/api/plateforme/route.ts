import { createHmac, timingSafeEqual } from 'node:crypto'
import { evenement, libelleStatut } from '@/lib/pa/cycle'
import { creerClientService } from '@/lib/supabase/service'

/**
 * Notifications de la plateforme agréée : changement de statut d'un flux émis.
 * Corps JSON { flowId, statusCode, reason? } signé : en-tête X-Signature = HMAC-SHA256 hexadécimal
 * du corps avec PA_WEBHOOK_SECRET.
 */
export async function POST(requete: Request) {
  const secret = process.env.PA_WEBHOOK_SECRET
  const supabase = creerClientService()
  if (!secret || !supabase) return new Response('Non configuré', { status: 503 })
  const corps = await requete.text()
  const attendu = createHmac('sha256', secret).update(corps).digest()
  const recu = Buffer.from(requete.headers.get('x-signature') ?? '', 'hex')
  if (recu.length !== attendu.length || !timingSafeEqual(recu, attendu)) return new Response('Signature invalide', { status: 401 })

  let message: { flowId?: unknown; statusCode?: unknown; reason?: unknown }
  try {
    message = JSON.parse(corps)
  } catch {
    return new Response('JSON invalide', { status: 400 })
  }
  const statut = Number(message.statusCode)
  if (typeof message.flowId !== 'string' || !Number.isInteger(statut) || statut < 200 || statut > 213) return new Response('Message invalide', { status: 400 })

  const { data: t } = await supabase.from('einvoice_transmissions').select('id, history, status_code').eq('provider', 'afnor').eq('flow_id', message.flowId).maybeSingle()
  if (!t) return new Response('Flux inconnu', { status: 404 })
  if (t.status_code !== statut) {
    const motif = typeof message.reason === 'string' ? message.reason.slice(0, 500) : null
    await supabase
      .from('einvoice_transmissions')
      .update({ status_code: statut, status_label: libelleStatut(statut), history: [...(Array.isArray(t.history) ? t.history : []), evenement(statut, new Date(), motif)] })
      .eq('id', t.id)
  }
  return Response.json({ ok: true })
}
