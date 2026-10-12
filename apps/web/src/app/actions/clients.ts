'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { validerClient, type ErreursClient } from '@/lib/clients'
import { eurosEnCentimes } from '@/lib/montant'
import { peutFacturer } from '@/lib/roles'
import { chargerContexte } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export interface EtatClient {
  erreurs?: ErreursClient
  erreur?: string
  succes?: string
}

function lecteur(formData: FormData) {
  return (cle: string) => String(formData.get(cle) ?? '').trim()
}

function messageBase(message: string): string {
  if (message.includes('clients_organization_siren_idx')) return 'Un client actif utilise déjà ce SIREN.'
  if (message.includes('row-level security')) return 'Vous n’avez pas les droits pour cette action.'
  return 'L’enregistrement a échoué. Vérifiez les champs et réessayez.'
}

export async function enregistrerClient(slug: string, clientId: string | null, _: EtatClient, formData: FormData): Promise<EtatClient> {
  const { organisation, role } = await chargerContexte(slug)
  if (!peutFacturer(role)) return { erreur: 'Votre rôle ne permet pas de modifier les clients.' }
  const { donnees, erreurs } = validerClient(lecteur(formData))
  if (Object.keys(erreurs).length > 0) return { erreurs, erreur: 'Certains champs sont à corriger.' }

  const supabase = await creerClientServeur()
  let id = clientId
  if (clientId) {
    const { error } = await supabase.from('clients').update(donnees).eq('id', clientId).eq('organization_id', organisation.id)
    if (error) return { erreur: messageBase(error.message) }
  } else {
    const { data, error } = await supabase
      .from('clients')
      .insert({ ...donnees, organization_id: organisation.id })
      .select('id')
      .single()
    if (error || !data) return { erreur: messageBase(error?.message ?? '') }
    id = data.id

    // Premier contact saisi avec la fiche.
    const contact = String(formData.get('contact_name') ?? '').trim()
    const email = String(formData.get('contact_email') ?? '').trim()
    if (contact || email) {
      await supabase.from('client_contacts').insert({
        organization_id: organisation.id,
        client_id: id,
        name: contact || donnees.name,
        email: email || null,
        receives_invoices: true,
      })
    }
  }
  revalidatePath(`/${slug}/clients`)
  redirect(`/${slug}/clients/${id}`)
}

export async function archiverClient(slug: string, clientId: string, archiver: boolean): Promise<void> {
  const { organisation } = await chargerContexte(slug)
  const supabase = await creerClientServeur()
  await supabase
    .from('clients')
    .update({ archived_at: archiver ? new Date().toISOString() : null })
    .eq('id', clientId)
    .eq('organization_id', organisation.id)
  revalidatePath(`/${slug}/clients`)
  revalidatePath(`/${slug}/clients/${clientId}`)
}

export interface EtatSimple {
  erreur?: string
  succes?: string
}

export async function ajouterContact(slug: string, clientId: string, _: EtatSimple, formData: FormData): Promise<EtatSimple> {
  const { organisation } = await chargerContexte(slug)
  const lire = lecteur(formData)
  const nom = lire('name')
  const email = lire('email')
  if (!nom) return { erreur: 'Indiquez le nom du contact.' }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { erreur: 'Adresse email invalide.' }
  const supabase = await creerClientServeur()
  const { error } = await supabase.from('client_contacts').insert({
    organization_id: organisation.id,
    client_id: clientId,
    name: nom,
    email: email || null,
    phone: lire('phone') || null,
    role: lire('role') || null,
    receives_invoices: lire('receives_invoices') === 'on',
  })
  if (error) return { erreur: messageBase(error.message) }
  revalidatePath(`/${slug}/clients/${clientId}`)
  return { succes: 'Contact ajouté.' }
}

export async function supprimerContact(slug: string, clientId: string, contactId: string): Promise<void> {
  const { organisation } = await chargerContexte(slug)
  const supabase = await creerClientServeur()
  await supabase.from('client_contacts').delete().eq('id', contactId).eq('organization_id', organisation.id)
  revalidatePath(`/${slug}/clients/${clientId}`)
}

export async function definirPrixClient(slug: string, clientId: string, _: EtatSimple, formData: FormData): Promise<EtatSimple> {
  const { organisation } = await chargerContexte(slug)
  const produit = String(formData.get('product_id') ?? '')
  const prix = eurosEnCentimes(String(formData.get('price') ?? ''))
  if (!produit) return { erreur: 'Choisissez un article.' }
  if (prix === null || prix < 0) return { erreur: 'Prix invalide.' }
  const supabase = await creerClientServeur()
  const { error } = await supabase
    .from('client_prices')
    .upsert({ organization_id: organisation.id, client_id: clientId, product_id: produit, unit_price_cents: prix }, { onConflict: 'client_id,product_id' })
  if (error) return { erreur: messageBase(error.message) }
  revalidatePath(`/${slug}/clients/${clientId}`)
  return { succes: 'Prix enregistré.' }
}

export async function supprimerPrixClient(slug: string, clientId: string, produitId: string): Promise<void> {
  const { organisation } = await chargerContexte(slug)
  const supabase = await creerClientServeur()
  await supabase.from('client_prices').delete().eq('client_id', clientId).eq('product_id', produitId).eq('organization_id', organisation.id)
  revalidatePath(`/${slug}/clients/${clientId}`)
}

export interface RapportImport {
  importes: number
  erreurs: Array<{ ligne: number; message: string }>
}

/** Import CSV : chaque ligne est validée comme une fiche saisie à la main. */
export async function importerClients(slug: string, lignes: Array<Record<string, string>>): Promise<RapportImport> {
  const { organisation, role } = await chargerContexte(slug)
  if (!peutFacturer(role)) return { importes: 0, erreurs: [{ ligne: 0, message: 'Votre rôle ne permet pas d’importer des clients.' }] }
  if (lignes.length > 2000) return { importes: 0, erreurs: [{ ligne: 0, message: '2 000 lignes maximum par import.' }] }

  const valides: Array<ReturnType<typeof validerClient>['donnees'] & { organization_id: string }> = []
  const contacts: Array<{ index: number; email: string }> = []
  const erreurs: RapportImport['erreurs'] = []
  lignes.forEach((ligne, i) => {
    const lire = (cle: string) => (ligne[cle] ?? '').trim()
    // Catégorie déduite si absente : SIREN → entreprise France, sinon particulier.
    const kind = lire('kind') || (lire('siren') ? 'b2b' : lire('vat_number') && !lire('vat_number').toUpperCase().startsWith('FR') ? 'ue' : 'b2c')
    const { donnees, erreurs: e } = validerClient((cle) => (cle === 'kind' ? kind : lire(cle)))
    const messages = Object.values(e)
    if (messages.length > 0) erreurs.push({ ligne: i + 2, message: messages.join(' ') })
    else {
      if (lire('email')) contacts.push({ index: valides.length, email: lire('email') })
      valides.push({ ...donnees, organization_id: organisation.id })
    }
  })
  if (valides.length === 0) return { importes: 0, erreurs }

  const supabase = await creerClientServeur()
  const { data, error } = await supabase.from('clients').insert(valides).select('id, name')
  if (error || !data) return { importes: 0, erreurs: [...erreurs, { ligne: 0, message: messageBase(error?.message ?? '') }] }
  const contactsAInserer = contacts.flatMap(({ index, email }) => {
    const c = data[index]
    return c ? [{ organization_id: organisation.id, client_id: c.id, name: c.name, email, receives_invoices: true }] : []
  })
  if (contactsAInserer.length) await supabase.from('client_contacts').insert(contactsAInserer)
  revalidatePath(`/${slug}/clients`)
  return { importes: data.length, erreurs }
}
