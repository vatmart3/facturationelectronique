import 'server-only'
import { randomInt } from 'node:crypto'
import { controler, extraireXml, genererCii, lireFacture, type Facture } from '@pastille/facturx'
import { chargerLogo, imprimableDepuis, lireDocument, nomFichier, type ClientSupabase } from './documents-serveur'
import type { CategorieTva } from '@pastille/moteur'
import { versEn16931 } from './en16931'
import { rapportPaiements, rapportTransactions, type DocTransaction, type Periode } from './ereporting'
import type { TypeClient } from './fiscalite'
import { DECISIONS, evenement, libelleStatut, plateforme, type Decision, type Evenement, type FluxRecu } from './pa'
import { genererPdf } from './pdf'
import type { OrganizationRow, TransmissionRow } from './supabase/types'

/**
 * Opérations avec la plateforme agréée de l'organisation (simulée ou API AFNOR),
 * partagées par les actions de l'application et la tâche planifiée.
 */

export type Resultat<T = undefined> = ({ ok: true } & (T extends undefined ? object : { valeur: T })) | { ok: false; erreur: string }

function historique(h: unknown): Evenement[] {
  return Array.isArray(h) ? (h as Evenement[]) : []
}

/** Dépose une facture ou un avoir émis : PDF Factur-X (XML CII EN 16931 joint). */
export async function transmettreDocument(supabase: ClientSupabase, organisation: OrganizationRow, documentId: string): Promise<Resultat<TransmissionRow>> {
  const charge = await lireDocument(supabase, organisation, documentId)
  if (!charge || charge.ligne.status === 'brouillon' || charge.ligne.type === 'devis') return { ok: false, erreur: 'Seules les factures et avoirs émis se transmettent.' }
  const imprimable = await imprimableDepuis(supabase, organisation, charge)
  const facture = imprimable ? versEn16931(imprimable) : null
  if (!imprimable || !facture) return { ok: false, erreur: 'Document incalculable.' }
  const bloquantes = controler(facture).filter((a) => a.bloquant)
  if (bloquantes.length) return { ok: false, erreur: `Non conforme EN 16931 : ${bloquantes.map((a) => a.message).join(' ')}` }
  const pdf = await genererPdf(imprimable, { logo: await chargerLogo(imprimable.vendeur.logo_path) })
  try {
    const pa = plateforme(organisation.pa_provider)
    const r = await pa.transmettre({
      numero: facture.numero,
      format: 'factur-x',
      fichier: pdf.octets,
      nomFichier: nomFichier(imprimable, 'pdf'),
      sirenVendeur: organisation.siren ?? '',
      destinataire: facture.acheteur.adresseElectronique,
    })
    const { data, error } = await supabase
      .from('einvoice_transmissions')
      .insert({
        organization_id: organisation.id,
        document_id: documentId,
        provider: pa.code,
        flow_id: r.fluxId,
        format: 'factur-x',
        status_code: r.statut,
        status_label: libelleStatut(r.statut),
        history: [evenement(r.statut)],
      })
      .select()
      .single()
    if (error || !data) return { ok: false, erreur: 'Dépôt effectué mais non enregistré : réessayez.' }
    return { ok: true, valeur: data }
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : 'Plateforme injoignable.' }
  }
}

/** Interroge la plateforme et enregistre un éventuel nouveau statut. */
export async function actualiserTransmission(supabase: ClientSupabase, organisation: OrganizationRow, t: TransmissionRow): Promise<Resultat<number>> {
  if (!t.flow_id) return { ok: false, erreur: 'Flux sans identifiant.' }
  try {
    const r = await plateforme(t.provider).consulter(t.flow_id, t.status_code)
    if (r.statut !== t.status_code) {
      await supabase
        .from('einvoice_transmissions')
        .update({ status_code: r.statut, status_label: libelleStatut(r.statut), history: [...historique(t.history), evenement(r.statut, new Date(), r.motif)] })
        .eq('id', t.id)
        .eq('organization_id', organisation.id)
    }
    return { ok: true, valeur: r.statut }
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : 'Plateforme injoignable.' }
  }
}

const FOURNISSEURS = [
  { nom: 'Imprimerie du Port', siren: '552100554', ville: 'Nantes', cp: '44000', lignes: [['Impression de 500 brochures', 42000], ['Livraison', 2500]] },
  { nom: 'Bureau Conseil Ouest', siren: '443061841', ville: 'Rennes', cp: '35000', lignes: [['Accompagnement comptable, octobre', 65000]] },
  { nom: 'Fournitures Lemaire', siren: '380129866', ville: 'Lille', cp: '59000', lignes: [['Papier A4, 20 ramettes', 9800], ['Cartouches d’encre', 15600]] },
] as const

/** Facture fournisseur fictive adressée à l'organisation (plateforme simulée). */
export function factureFournisseurSimulee(organisation: Pick<OrganizationRow, 'name' | 'siren' | 'vat_number' | 'address_line1' | 'postal_code' | 'city'>, jour: string): FluxRecu {
  const f = FOURNISSEURS[randomInt(FOURNISSEURS.length)]!
  const numero = `${f.nom.slice(0, 2).toUpperCase()}-${jour.slice(0, 4)}-${String(randomInt(1, 9999)).padStart(4, '0')}`
  const lignes = f.lignes.map(([designation, prix], i) => ({
    id: String(i + 1),
    designation,
    description: null,
    quantite: 1000,
    unite: 'C62',
    prixUnitaire: prix,
    remise: null,
    montantNet: prix,
    categorie: 'S' as const,
    taux: 2000,
  }))
  const ht = lignes.reduce((s, l) => s + l.montantNet, 0)
  const tva = Math.round(ht * 0.2)
  const echeance = new Date(Date.parse(`${jour}T00:00:00Z`) + 30 * 86_400_000).toISOString().slice(0, 10)
  const facture: Facture = {
    numero,
    cadre: 'S1',
    type: '380',
    dateEmission: jour,
    dateEcheance: echeance,
    devise: 'EUR',
    referenceAcheteur: null,
    commande: null,
    notes: [
      { texte: 'Pénalités de retard : trois fois le taux d’intérêt légal', sujet: 'PMD' },
      { texte: 'Indemnité forfaitaire pour frais de recouvrement : 40 €', sujet: 'PMT' },
      { texte: 'Pas d’escompte pour paiement anticipé', sujet: 'AAB' },
    ],
    facturePrecedente: null,
    vendeur: {
      nom: f.nom,
      siren: f.siren,
      siret: null,
      tva: `FR${String((12 + 3 * (Number(f.siren) % 97)) % 97).padStart(2, '0')}${f.siren}`,
      mentionsJuridiques: null,
      adresse: { ligne1: '1 rue du Commerce', ligne2: null, codePostal: f.cp, ville: f.ville, pays: 'FR' },
      adresseElectronique: { valeur: f.siren, schema: '0225' },
    },
    acheteur: {
      nom: organisation.name,
      siren: organisation.siren,
      siret: null,
      tva: organisation.vat_number,
      mentionsJuridiques: null,
      adresse: { ligne1: organisation.address_line1, ligne2: null, codePostal: organisation.postal_code, ville: organisation.city, pays: 'FR' },
      adresseElectronique: organisation.siren ? { valeur: organisation.siren, schema: '0225' } : null,
    },
    dateLivraison: jour,
    periode: null,
    paysLivraison: null,
    paiement: { moyen: '58', iban: 'FR7630004000031234567890143', bic: 'BNPAFRPP', reference: numero, conditions: '30 jours' },
    lignes,
    remises: [],
    ventilation: [{ categorie: 'S', taux: 2000, base: ht, montant: tva, motif: null, codeMotif: null }],
    totaux: { lignes: ht, remises: 0, ht, tva, ttc: ht + tva, dejaPaye: 0, net: ht + tva },
  }
  return { fluxId: `SIM-IN-${numero}`, format: 'cii', fichier: new TextEncoder().encode(genererCii(facture)) }
}

/** Relève les factures reçues et les enregistre (sans doublon). */
export async function releverFactures(supabase: ClientSupabase, organisation: OrganizationRow, flux?: FluxRecu[]): Promise<Resultat<{ nouvelles: number; illisibles: number }>> {
  try {
    const { data: derniere } = await supabase.from('received_invoices').select('received_at').eq('organization_id', organisation.id).order('received_at', { ascending: false }).limit(1)
    const pa = plateforme(organisation.pa_provider, flux ? async () => flux : undefined)
    const recus = await pa.recevoir(derniere?.[0]?.received_at ?? null)
    let nouvelles = 0
    let illisibles = 0
    for (const r of recus) {
      const xml = r.format === 'factur-x' ? await extraireXml(r.fichier) : new TextDecoder().decode(r.fichier)
      let lue
      try {
        if (!xml) throw new Error('XML absent')
        lue = lireFacture(xml)
      } catch {
        illisibles++
        continue
      }
      const { error } = await supabase.from('received_invoices').insert({
        organization_id: organisation.id,
        provider: pa.code,
        flow_id: r.fluxId,
        format: r.format,
        type_code: lue.type,
        number: lue.numero.slice(0, 60),
        issue_date: lue.dateEmission,
        due_date: lue.dateEcheance,
        seller_name: lue.vendeur.nom.slice(0, 200) || 'Fournisseur',
        seller_siren: lue.vendeur.siren,
        seller_vat: lue.vendeur.tva,
        currency: lue.devise,
        total_ht: lue.totaux.ht,
        total_vat: lue.totaux.tva,
        total_ttc: lue.totaux.ttc,
        amount_due: lue.totaux.net,
        vat_breakdown: lue.ventilation,
        lines: lue.lignes,
        xml: xml!,
        history: [evenement(203)],
      })
      if (!error) nouvelles++
    }
    return { ok: true, valeur: { nouvelles, illisibles } }
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : 'Plateforme injoignable.' }
  }
}

const STATUT_DECISION: Record<Decision, 'approuvee' | 'refusee' | 'litige' | 'payee'> = { approuvee: 'approuvee', refusee: 'refusee', litige: 'litige', payee: 'payee' }

/** Décision sur une facture reçue, renvoyée au fournisseur via la plateforme. */
export async function deciderFactureRecue(supabase: ClientSupabase, organisation: OrganizationRow, id: string, decision: Decision, motif: string | null): Promise<Resultat> {
  const { data: f } = await supabase.from('received_invoices').select('*').eq('id', id).eq('organization_id', organisation.id).maybeSingle()
  if (!f) return { ok: false, erreur: 'Facture introuvable.' }
  if ((decision === 'refusee' || decision === 'litige') && !motif?.trim()) return { ok: false, erreur: 'Indiquez le motif : il est transmis au fournisseur.' }
  const code = DECISIONS[decision]
  try {
    await plateforme(f.provider).repondre(f.flow_id, code, motif)
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : 'Plateforme injoignable.' }
  }
  const { error } = await supabase
    .from('received_invoices')
    .update({ status: STATUT_DECISION[decision], status_code: code, motive: motif?.trim() || null, history: [...historique(f.history), evenement(code, new Date(), motif)] })
    .eq('id', id)
  return error ? { ok: false, erreur: 'Enregistrement impossible.' } : { ok: true }
}

/** Données d'e-reporting d'une période, calculées depuis les documents émis et les paiements. */
export async function donneesEreporting(supabase: ClientSupabase, organisation: OrganizationRow, periode: Pick<Periode, 'debut' | 'fin'>) {
  const [{ data: docs }, { data: paiements }] = await Promise.all([
    supabase
      .from('documents')
      .select('id, number, type, issue_date, client_snapshot, operation_category, document_vat_summary(vat_category, vat_rate, base_cents, vat_cents)')
      .eq('organization_id', organisation.id)
      .in('type', ['facture', 'acompte', 'avoir'])
      .neq('status', 'brouillon')
      .gte('issue_date', periode.debut)
      .lte('issue_date', periode.fin),
    supabase
      .from('payments')
      .select('paid_on, amount_cents, documents(number, operation_category, client_snapshot, document_vat_summary(vat_rate, base_cents, vat_cents))')
      .eq('organization_id', organisation.id)
      .gte('paid_on', periode.debut)
      .lte('paid_on', periode.fin),
  ])
  const client = (c: unknown) => {
    const x = (c ?? {}) as { kind?: TypeClient; billing_country?: string; vat_number?: string | null; name?: string }
    return { kind: x.kind ?? 'b2c', pays: x.billing_country ?? 'FR', tva: x.vat_number ?? null, nom: x.name ?? '' }
  }
  const transactions = rapportTransactions(
    (docs ?? []).map((d) => ({
      numero: d.number ?? '',
      type: d.type as DocTransaction['type'],
      date: d.issue_date,
      client: client(d.client_snapshot),
      categorieOperation: d.operation_category,
      ventilation: (d.document_vat_summary ?? []).map((v) => ({ categorie: v.vat_category as CategorieTva, taux: v.vat_rate, base: Number(v.base_cents), tva: Number(v.vat_cents) })),
    })),
    periode,
  )
  // Paiements : seules les prestations entre assujettis français relèvent de la facturation électronique ;
  // l'e-reporting des paiements couvre les services (B2C et B2B), TVA exigible à l'encaissement.
  const encaissements = rapportPaiements(
    (paiements ?? []).map((p) => ({
      date: p.paid_on,
      numero: p.documents?.number ?? '',
      montant: Number(p.amount_cents),
      categorieOperation: p.documents?.operation_category ?? null,
      ventilation: (p.documents?.document_vat_summary ?? []).map((v) => ({ taux: v.vat_rate, base: Number(v.base_cents), tva: Number(v.vat_cents) })),
    })),
    periode,
    organisation.vat_on_debits,
  )
  return { transactions, encaissements }
}

export async function deposerEreporting(
  supabase: ClientSupabase,
  organisation: OrganizationRow,
  type: 'transactions' | 'paiements',
  periode: Pick<Periode, 'debut' | 'fin'>,
): Promise<Resultat> {
  const donnees = await donneesEreporting(supabase, organisation, periode)
  const contenu = type === 'transactions' ? donnees.transactions : donnees.encaissements
  try {
    const pa = plateforme(organisation.pa_provider)
    const r = await pa.deposerEreporting({ type, debut: periode.debut, fin: periode.fin, contenu })
    const { error } = await supabase.from('ereporting_reports').insert({
      organization_id: organisation.id,
      kind: type,
      period_start: periode.debut,
      period_end: periode.fin,
      provider: pa.code,
      flow_id: r.fluxId,
      summary: contenu,
    })
    if (error) return { ok: false, erreur: error.message.includes('duplicate') ? 'Cette période a déjà été déclarée.' : 'Enregistrement impossible.' }
    return { ok: true }
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : 'Plateforme injoignable.' }
  }
}
