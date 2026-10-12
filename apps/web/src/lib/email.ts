import 'server-only'
import type { Email } from './modeles-email'

/**
 * Envoi d'emails via Resend (RESEND_API_KEY, EMAIL_EXPEDITEUR).
 * Sans clé, l'envoi est « simulé » : il est journalisé mais rien ne part,
 * ce qui permet d'essayer l'application sans configurer de messagerie.
 */

export interface PieceJointe {
  nom: string
  contenu: Uint8Array
}

export type ResultatEmail = { statut: 'envoye'; id: string } | { statut: 'simule' } | { statut: 'echec'; erreur: string }

export function emailConfigure(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_EXPEDITEUR)
}

export async function envoyerEmail(destinataire: string, email: Email, options: { repondreA?: string | null; pieces?: PieceJointe[] } = {}): Promise<ResultatEmail> {
  if (!emailConfigure()) return { statut: 'simule' }
  try {
    const reponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_EXPEDITEUR,
        to: [destinataire],
        subject: email.sujet,
        text: email.texte,
        html: email.html,
        reply_to: options.repondreA ?? undefined,
        attachments: options.pieces?.map((p) => ({ filename: p.nom, content: Buffer.from(p.contenu).toString('base64') })),
      }),
      signal: AbortSignal.timeout(15_000),
    })
    const corps = (await reponse.json().catch(() => ({}))) as { id?: string; message?: string }
    if (!reponse.ok || !corps.id) return { statut: 'echec', erreur: corps.message ?? `Erreur ${reponse.status}` }
    return { statut: 'envoye', id: corps.id }
  } catch (e) {
    return { statut: 'echec', erreur: e instanceof Error ? e.message : 'Envoi impossible' }
  }
}
