/**
 * Textes des emails envoyés aux clients : envoi d'un document, relances, remerciement.
 * Ton professionnel et sobre ; le texte brut accompagne toujours la version HTML.
 */

import { formatMontant } from './format'
import { dateCourte } from './imprimable'

export interface Email {
  sujet: string
  texte: string
  html: string
}

interface Contexte {
  entreprise: string
  type: 'facture' | 'acompte' | 'avoir' | 'devis'
  numero: string
  montant: number
  devise: string
  echeance: string | null
  lien: string | null
  signature: string | null
}

const NOMS = { facture: 'la facture', acompte: 'la facture d’acompte', avoir: 'l’avoir', devis: 'le devis' }
const TITRES = { facture: 'Facture', acompte: 'Facture d’acompte', avoir: 'Avoir', devis: 'Devis' }

function echapper(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function html(paragraphes: string[], lien: { texte: string; url: string } | null, pied: string): string {
  const corps = paragraphes.map((p) => `<p style="margin:0 0 14px">${echapper(p).replace(/\n/g, '<br>')}</p>`).join('')
  const bouton = lien
    ? `<p style="margin:22px 0"><a href="${echapper(lien.url)}" style="display:inline-block;background:#16181d;color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:600">${echapper(lien.texte)}</a></p>`
    : ''
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f5f7;padding:24px 12px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1d1f24;font-size:15px;line-height:1.55"><div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e3e5e9;border-radius:12px;padding:28px">${corps}${bouton}<p style="margin:22px 0 0;color:#6b7280;font-size:13px">${echapper(pied).replace(/\n/g, '<br>')}</p></div></body></html>`
}

function signature(c: Contexte): string {
  return c.signature?.trim() || c.entreprise
}

export function emailEnvoi(c: Contexte, message: string | null): Email {
  const montant = formatMontant(c.montant, c.devise)
  const p = [
    'Bonjour,',
    message?.trim() ||
      (c.type === 'devis'
        ? `Veuillez trouver ci-joint notre devis n° ${c.numero} d’un montant de ${montant}. Vous pouvez l’accepter en ligne en quelques secondes.`
        : c.type === 'avoir'
          ? `Veuillez trouver ci-joint l’avoir n° ${c.numero} d’un montant de ${montant}.`
          : `Veuillez trouver ci-joint ${NOMS[c.type]} n° ${c.numero} d’un montant de ${montant}${c.echeance ? `, à régler au plus tard le ${dateCourte(c.echeance)}` : ''}.`),
    'Nous restons à votre disposition pour toute question.',
  ]
  const lien = c.lien ? { texte: c.type === 'devis' ? 'Consulter et accepter le devis' : `Consulter ${NOMS[c.type]}`, url: c.lien } : null
  return {
    sujet: `${TITRES[c.type]} ${c.numero} · ${c.entreprise}`,
    texte: [...p, ...(lien ? [`${lien.texte} : ${lien.url}`] : []), '', signature(c)].join('\n\n'),
    html: html(p, lien, signature(c)),
  }
}

export function emailRelance(c: Contexte, retard: number): Email {
  const montant = formatMontant(c.montant, c.devise)
  const echeance = c.echeance ? dateCourte(c.echeance) : ''
  const [sujet, corps] =
    retard < 0
      ? [`Rappel : facture ${c.numero} à échéance le ${echeance}`, `Nous vous rappelons que la facture n° ${c.numero} d’un montant de ${montant} arrive à échéance le ${echeance}. Si le règlement est déjà en cours, merci de ne pas tenir compte de ce message.`]
      : retard < 15
        ? [`Facture ${c.numero} en attente de règlement`, `Sauf erreur de notre part, la facture n° ${c.numero} d’un montant de ${montant}, échue le ${echeance}, reste à régler. Pourriez-vous nous indiquer la date de règlement prévue ?`]
        : [
            `Second rappel : facture ${c.numero} échue depuis ${retard} jours`,
            `Malgré notre précédent rappel, la facture n° ${c.numero} d’un montant de ${montant}, échue le ${echeance}, n’est toujours pas réglée. Nous vous remercions de procéder au règlement dans les meilleurs délais. Pour rappel, une indemnité forfaitaire de 40 € pour frais de recouvrement et des pénalités de retard sont exigibles.`,
          ]
  const p = ['Bonjour,', corps, 'Bien cordialement,']
  const lien = c.lien ? { texte: 'Consulter et régler la facture', url: c.lien } : null
  return {
    sujet: `${sujet} · ${c.entreprise}`,
    texte: [...p, ...(lien ? [`${lien.texte} : ${lien.url}`] : []), '', signature(c)].join('\n\n'),
    html: html(p, lien, signature(c)),
  }
}

export function emailRemerciement(c: Contexte): Email {
  const p = ['Bonjour,', `Nous avons bien reçu le règlement de la facture n° ${c.numero}. Merci !`, 'Bien cordialement,']
  return { sujet: `Paiement reçu · facture ${c.numero}`, texte: [...p, '', signature(c)].join('\n\n'), html: html(p, null, signature(c)) }
}
