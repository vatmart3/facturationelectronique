import 'server-only'
import { verifierConformite } from './conformite'
import { aujourdHui, calculer, type DocumentEdition } from './document'
import { imprimableDepuis, lireDocument, nomFichier, chargerLogo, sauverBrouillon, type ClientSupabase } from './documents-serveur'
import { envoyerEmail, type ResultatEmail } from './email'
import { emailEnvoi, emailRelance } from './modeles-email'
import { genererPdf } from './pdf'
import { origineSite } from './site'
import { echeancesDues, prochaineDate, relancesDues, remplacerVariables } from './suivi'
import type { OrganizationRow } from './supabase/types'

/**
 * Tâches de suivi partagées entre l'application (session de l'utilisateur, RLS)
 * et la tâche planifiée quotidienne (client service) : envoi par email,
 * relances automatiques, génération des factures récurrentes.
 */

type Organisation = OrganizationRow

/** Adresse de facturation du client : contact « reçoit les factures », sinon le premier contact avec email. */
export async function destinataireClient(supabase: ClientSupabase, organisationId: string, clientId: string): Promise<string | null> {
  const { data } = await supabase
    .from('client_contacts')
    .select('email, receives_invoices')
    .eq('organization_id', organisationId)
    .eq('client_id', clientId)
    .not('email', 'is', null)
    .order('receives_invoices', { ascending: false })
    .order('created_at')
    .limit(1)
  return data?.[0]?.email ?? null
}

async function lienPublic(supabase: ClientSupabase, id: string): Promise<string | null> {
  const { data } = await supabase.rpc('lien_public', { p_id: id })
  return data ? `${await origineSite()}/d/${data}` : null
}

export interface ResultatEnvoi {
  resultat: ResultatEmail
  destinataire: string
}

/** Envoie un document émis par email (PDF Factur-X joint, lien public) et le journalise. */
export async function envoyerDocument(
  supabase: ClientSupabase,
  organisation: Organisation,
  id: string,
  options: { destinataire?: string | null; message?: string | null; relance?: { etape: number | null; retard: number } } = {},
): Promise<ResultatEnvoi | { erreur: string }> {
  const charge = await lireDocument(supabase, organisation, id)
  if (!charge || charge.ligne.status === 'brouillon') return { erreur: 'Seul un document émis peut être envoyé.' }
  const d = charge.ligne
  const destinataire = options.destinataire?.trim() || (d.client_id ? await destinataireClient(supabase, organisation.id, d.client_id) : null)
  if (!destinataire || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destinataire)) return { erreur: 'Aucune adresse email valide pour ce client.' }
  const imprimable = await imprimableDepuis(supabase, organisation, charge)
  if (!imprimable) return { erreur: 'Document incalculable.' }
  const pdf = await genererPdf(imprimable, { logo: await chargerLogo(imprimable.vendeur.logo_path) })
  const contexte = {
    entreprise: imprimable.vendeur.name,
    type: d.type,
    numero: d.number ?? '',
    montant: options.relance ? Math.max(0, Number(d.amount_due) - Number(d.amount_paid)) : Number(d.amount_due),
    devise: d.currency,
    echeance: d.due_date,
    lien: await lienPublic(supabase, id),
    signature: organisation.reminder_signature,
  }
  const email = options.relance ? emailRelance(contexte, options.relance.retard) : emailEnvoi(contexte, options.message ?? null)
  const resultat = await envoyerEmail(destinataire, email, {
    repondreA: organisation.reminder_email_from,
    pieces: [{ nom: nomFichier(imprimable, 'pdf'), contenu: pdf.octets }],
  })
  await supabase.from('reminders').insert({
    organization_id: organisation.id,
    document_id: id,
    step: options.relance?.etape ?? null,
    kind: options.relance ? 'relance' : 'envoi',
    recipient: destinataire,
    subject: email.sujet,
    status: resultat.statut,
    provider_id: resultat.statut === 'envoye' ? resultat.id : null,
    error: resultat.statut === 'echec' ? resultat.erreur : null,
  })
  // Premier envoi : la facture passe à « envoyée » (le devis l'est dès sa finalisation).
  if (resultat.statut !== 'echec' && d.status === 'emis') await supabase.rpc('changer_statut', { p_id: id, p_statut: 'envoye' })
  return { resultat, destinataire }
}

export interface BilanRelances {
  envoyees: number
  simulees: number
  echecs: number
  sansEmail: number
}

/** Relances automatiques du jour pour une organisation. */
export async function executerRelances(supabase: ClientSupabase, organisation: Organisation, jour = aujourdHui()): Promise<BilanRelances> {
  const bilan: BilanRelances = { envoyees: 0, simulees: 0, echecs: 0, sansEmail: 0 }
  if (!organisation.reminders_enabled || organisation.reminder_days.length === 0) return bilan
  const [{ data: factures }, { data: historique }] = await Promise.all([
    supabase
      .from('documents')
      .select('id, due_date, status, clients(reminders_enabled)')
      .eq('organization_id', organisation.id)
      .in('type', ['facture', 'acompte'])
      .in('status', ['emis', 'envoye', 'partiellement_paye']),
    supabase.from('reminders').select('document_id, step').eq('organization_id', organisation.id).not('step', 'is', null).neq('status', 'echec'),
  ])
  const deja = new Map<string, Set<number>>()
  for (const r of historique ?? []) {
    if (!deja.has(r.document_id)) deja.set(r.document_id, new Set())
    deja.get(r.document_id)!.add(r.step!)
  }
  const dues = relancesDues(
    (factures ?? []).map((f) => ({ id: f.id, due_date: f.due_date, status: f.status, relancesClient: f.clients?.reminders_enabled ?? true })),
    organisation.reminder_days,
    deja,
    jour,
  )
  for (const due of dues) {
    const r = await envoyerDocument(supabase, organisation, due.id, { relance: { etape: due.etape, retard: due.retard } })
    if ('erreur' in r) bilan.sansEmail++
    else if (r.resultat.statut === 'envoye') bilan.envoyees++
    else if (r.resultat.statut === 'simule') bilan.simulees++
    else bilan.echecs++
  }
  return bilan
}

export interface BilanRecurrences {
  creees: number
  emises: number
  aVerifier: number
}

/** Génère les factures récurrentes arrivées à échéance (rattrapage borné à 12 échéances). */
export async function executerRecurrences(supabase: ClientSupabase, organisation: Organisation, jour = aujourdHui()): Promise<BilanRecurrences> {
  const bilan: BilanRecurrences = { creees: 0, emises: 0, aVerifier: 0 }
  const { data: recurrences } = await supabase
    .from('recurring_invoices')
    .select('*')
    .eq('organization_id', organisation.id)
    .eq('active', true)
    .lte('next_date', jour)
  if (!recurrences?.length) return bilan
  const [{ data: mentions }, { data: clients }] = await Promise.all([
    supabase.from('legal_mentions').select('key, text'),
    supabase.from('clients').select('*').eq('organization_id', organisation.id),
  ])
  const textes = Object.fromEntries((mentions ?? []).map((m) => [m.key, m.text]))

  for (const r of recurrences) {
    const modele = r.template as DocumentEdition & { jourAncre?: number }
    const client = (clients ?? []).find((c) => c.id === r.client_id) ?? null
    const dates = echeancesDues({ next_date: r.next_date, end_date: r.end_date, frequency: r.frequency, jourAncre: modele.jourAncre }, jour)
    let dernier: string | null = r.last_document_id
    for (const date of dates) {
      const doc: DocumentEdition = {
        ...modele,
        id: '',
        type: 'facture',
        clientId: r.client_id,
        issueDate: date,
        validUntil: null,
        servicePeriodStart: null,
        servicePeriodEnd: null,
        subject: remplacerVariables(modele.subject ?? '', date, r.frequency),
        lignes: modele.lignes.map((l) => ({ ...l, designation: remplacerVariables(l.designation, date, r.frequency), description: remplacerVariables(l.description, date, r.frequency) })),
        acomptes: [],
        originDocumentId: null,
      }
      const enregistre = await sauverBrouillon(supabase, organisation.id, doc, null)
      if (!enregistre.ok) break
      bilan.creees++
      dernier = enregistre.id
      if (r.mode === 'emission') {
        const calcul = calculer(doc)
        const conformite = verifierConformite(doc, organisation, client, calcul.ok ? calcul.totaux : null, textes)
        const { error } = conformite.peutEmettre ? await supabase.rpc('emettre_document', { p_id: enregistre.id }) : { error: true }
        if (error) bilan.aVerifier++
        else {
          bilan.emises++
          await envoyerDocument(supabase, organisation, enregistre.id)
        }
      } else bilan.aVerifier++
    }
    const derniere = dates.at(-1)
    const suivante = derniere ? prochaineDate(derniere, r.frequency, modele.jourAncre) : r.next_date
    await supabase
      .from('recurring_invoices')
      .update({
        next_date: suivante,
        last_document_id: dernier,
        last_run_at: new Date().toISOString(),
        active: !r.end_date || suivante <= r.end_date,
      })
      .eq('id', r.id)
  }
  return bilan
}
