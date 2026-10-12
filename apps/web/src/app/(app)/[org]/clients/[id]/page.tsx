import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { archiverClient, supprimerContact, supprimerPrixClient } from '@/app/actions/clients'
import { FormulaireContact, FormulairePrix } from '@/components/clients/ActionsFiche'
import { Avatar } from '@/components/ui/Avatar'
import { Bouton, BoutonLien } from '@/components/ui/Bouton'
import { Categorie, Etiquette } from '@/components/ui/Categorie'
import { EtatVide } from '@/components/ui/EtatVide'
import { Icone } from '@/components/ui/Icone'
import { Indicateurs } from '@/components/ui/Indicateurs'
import { Message } from '@/components/ui/Message'
import { ListeCles, Panneau, PanneauCorps, PanneauTete } from '@/components/ui/Panneau'
import { Segments } from '@/components/ui/Segments'
import { Statut } from '@/components/ui/Statut'
import { Tableau, Td, Th } from '@/components/ui/Tableau'
import { libelleConditions, libelleTypeClient } from '@/lib/clients'
import { ajouterJours, aujourdHui, LIBELLES_TYPE, statutAffiche } from '@/lib/document'
import { canalTransmission, resoudreTva } from '@/lib/fiscalite'
import { formatDate, formatMontant, grouperChiffres } from '@/lib/format'
import { peutFacturer } from '@/lib/roles'
import { chargerContexte } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import { formatTaux } from '@pastille/moteur'

type Params = Promise<{ org: string; id: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { org, id } = await params
  const { organisation } = await chargerContexte(org)
  const supabase = await creerClientServeur()
  const { data } = await supabase.from('clients').select('name').eq('id', id).eq('organization_id', organisation.id).maybeSingle()
  return { title: data?.name ?? 'Client' }
}

export default async function FicheClient({ params, searchParams }: { params: Params; searchParams: Promise<{ onglet?: string }> }) {
  const { org, id } = await params
  const { onglet = 'apercu' } = await searchParams
  const { organisation, role } = await chargerContexte(org)
  const supabase = await creerClientServeur()
  const { data: client } = await supabase.from('clients').select('*').eq('id', id).eq('organization_id', organisation.id).maybeSingle()
  if (!client) notFound()

  const [{ data: contacts }, { data: prix }, { data: produits }, { data: docs }] = await Promise.all([
    supabase.from('client_contacts').select('*').eq('client_id', id).eq('organization_id', organisation.id).order('created_at'),
    supabase.from('client_prices').select('product_id, unit_price_cents').eq('client_id', id).eq('organization_id', organisation.id),
    supabase.from('products').select('id, name, unit_price_cents, unit').eq('organization_id', organisation.id).is('archived_at', null).order('name'),
    supabase
      .from('documents')
      .select('id, type, status, number, issue_date, due_date, valid_until, total_ht, total_ttc, amount_due, amount_paid, currency')
      .eq('client_id', id)
      .eq('organization_id', organisation.id)
      .order('issue_date', { ascending: false })
      .order('created_at', { ascending: false }),
  ])
  const jour = aujourdHui()
  const documents = (docs ?? []).map((d) => ({ ...d, affiche: statutAffiche(d, jour) }))
  const emis = documents.filter((d) => d.type !== 'devis' && d.status !== 'brouillon')
  const ilYAUnAn = ajouterJours(jour, -365)
  const ca = emis.filter((d) => d.issue_date >= ilYAUnAn && d.status !== 'annule').reduce((s, d) => s + Number(d.total_ht), 0)
  const ouvertes = emis.filter((d) => d.type !== 'avoir' && ['emis', 'envoye', 'partiellement_paye'].includes(d.status))
  const encours = ouvertes.reduce((s, d) => s + Number(d.amount_due) - Number(d.amount_paid), 0)
  const enRetard = ouvertes.filter((d) => d.affiche.cle === 'retard').length
  const parProduit = new Map((produits ?? []).map((p) => [p.id, p]))
  const editable = peutFacturer(role)
  const tvaService = resoudreTva({
    regimeEntreprise: organisation.vat_regime,
    client: {
      kind: client.kind,
      defaultVatCategory: client.default_vat_category,
      defaultVatRate: client.default_vat_rate,
      exemptionReason: client.exemption_reason,
    },
    article: { nature: 'service', categorie: 'S', taux: 2000 },
  })
  const tvaTexte = tvaService.categorie === 'S' ? formatTaux(tvaService.taux) : (tvaService.motif ?? 'Sans TVA')
  const adresse = [client.billing_line1, client.billing_line2, [client.billing_postal_code, client.billing_city].filter(Boolean).join(' '), client.billing_country !== 'FR' ? client.billing_country : null]
    .filter(Boolean)
    .join(', ')
  const base = `/${org}/clients/${id}`

  return (
    <>
      <Link href={`/${org}/clients`} className="inline-flex w-max items-center gap-1.5 text-[13px] text-encre-2 hover:text-encre">
        <Icone nom="chevron-gauche" taille={14} />
        Tous les clients
      </Link>

      {client.archived_at && <Message ton="info">Client archivé le {formatDate(client.archived_at)}. Il n’apparaît plus dans les listes de saisie.</Message>}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar nom={client.name} taille="l" />
          <div className="min-w-0">
            <h1 className="text-[24px] font-bold">{client.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[13px] text-encre-2">
              <Categorie categorie={client.kind} />
              {client.legal_form && <span>{client.legal_form}</span>}
              {client.billing_city && <span>{client.billing_city}</span>}
            </div>
          </div>
        </div>
        {editable && (
          <div className="flex flex-wrap gap-2">
            <form action={archiverClient.bind(null, org, id, !client.archived_at)}>
              <Bouton type="submit" variante="fantome">
                {client.archived_at ? 'Désarchiver' : 'Archiver'}
              </Bouton>
            </form>
            <BoutonLien href={`${base}/modifier`}>Modifier</BoutonLien>
            <BoutonLien href={`/${org}/ventes/factures/nouvelle?client=${id}`} variante="primaire" icone="plus">
              Nouvelle facture
            </BoutonLien>
          </div>
        )}
      </div>

      <Indicateurs
        indicateurs={[
          { libelle: 'CA 12 mois', valeur: formatMontant(ca), detail: 'HT, factures émises' },
          {
            libelle: 'Encours',
            valeur: formatMontant(encours),
            detail: ouvertes.length ? `${ouvertes.length} facture${ouvertes.length > 1 ? 's' : ''} ouverte${ouvertes.length > 1 ? 's' : ''}${enRetard ? `, ${enRetard} en retard` : ''}` : 'Rien en attente',
            ton: enRetard ? 'alerte' : 'info',
          },
          { libelle: 'Délai moyen de paiement', valeur: '—', detail: 'Calculé dès le premier paiement', ton: 'ok' },
          { libelle: 'Client depuis', valeur: formatDate(client.created_at) },
        ]}
      />

      <Segments
        libelle="Sections de la fiche"
        segments={[
          { href: base, libelle: 'Aperçu', actif: onglet === 'apercu' },
          { href: `${base}?onglet=contacts`, libelle: 'Contacts', compte: contacts?.length ?? 0, actif: onglet === 'contacts' },
          { href: `${base}?onglet=tarifs`, libelle: 'Tarifs spécifiques', compte: prix?.length ?? 0, actif: onglet === 'tarifs' },
          { href: `${base}?onglet=documents`, libelle: 'Documents', compte: documents.length, actif: onglet === 'documents' },
        ]}
      />

      {onglet === 'contacts' ? (
        <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Panneau>
            <PanneauTete titre="Contacts" />
            {contacts?.length ? (
              <ul className="m-0 list-none p-0">
                {contacts.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 border-b border-trait px-[18px] py-3 last:border-b-0">
                    <Avatar nom={c.name} />
                    <div className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="font-medium">{c.name}</span>
                      <span className="truncate text-[12.5px] text-encre-3">{[c.role, c.email, c.phone].filter(Boolean).join(' · ') || '—'}</span>
                    </div>
                    {c.receives_invoices && <Etiquette>Reçoit les factures</Etiquette>}
                    {editable && (
                      <form action={supprimerContact.bind(null, org, id, c.id)}>
                        <Bouton type="submit" variante="fantome" taille="s" aria-label={`Supprimer le contact ${c.name}`}>
                          Supprimer
                        </Bouton>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <PanneauCorps>
                <p className="text-encre-3">Aucun contact enregistré.</p>
              </PanneauCorps>
            )}
          </Panneau>
          {editable && (
            <Panneau>
              <PanneauTete titre="Ajouter un contact" />
              <PanneauCorps>
                <FormulaireContact slug={org} clientId={id} />
              </PanneauCorps>
            </Panneau>
          )}
        </div>
      ) : onglet === 'tarifs' ? (
        <div className="flex flex-col gap-[18px]">
          {prix?.length ? (
            <Tableau legende="Tarifs spécifiques du client" largeurMin={560}>
              <thead>
                <tr>
                  <Th>Article</Th>
                  <Th numerique>Prix catalogue HT</Th>
                  <Th numerique>Prix client HT</Th>
                  <Th numerique>Écart</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {prix.map((p) => {
                  const produit = parProduit.get(p.product_id)
                  if (!produit) return null
                  const ecart = produit.unit_price_cents ? ((p.unit_price_cents - produit.unit_price_cents) / produit.unit_price_cents) * 100 : 0
                  return (
                    <tr key={p.product_id}>
                      <Td>
                        {produit.name} <span className="text-encre-3">/ {produit.unit}</span>
                      </Td>
                      <Td numerique>{formatMontant(produit.unit_price_cents)}</Td>
                      <Td numerique className="font-semibold">
                        {formatMontant(p.unit_price_cents)}
                      </Td>
                      <Td numerique className="text-encre-3">
                        {ecart === 0 ? '—' : `${ecart > 0 ? '+' : ''}${ecart.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`}
                      </Td>
                      <Td className="text-right">
                        {editable && (
                          <form action={supprimerPrixClient.bind(null, org, id, p.product_id)}>
                            <Bouton type="submit" variante="fantome" taille="s">
                              Retirer
                            </Bouton>
                          </form>
                        )}
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </Tableau>
          ) : (
            <EtatVide titre="Aucun tarif spécifique">
              <p>Les prix du catalogue s’appliquent. Définissez ici un prix propre à ce client pour un article.</p>
            </EtatVide>
          )}
          {editable && (
            <Panneau>
              <PanneauTete titre="Définir un prix pour ce client" />
              <PanneauCorps>
                <FormulairePrix slug={org} clientId={id} produits={produits ?? []} />
              </PanneauCorps>
            </Panneau>
          )}
        </div>
      ) : onglet === 'documents' ? (
        documents.length === 0 ? (
          <EtatVide
            titre="Aucun document"
            action={
              editable && (
                <div className="flex flex-wrap justify-center gap-2">
                  <BoutonLien href={`/${org}/ventes/factures/nouvelle?client=${id}`} variante="primaire" icone="plus">
                    Nouvelle facture
                  </BoutonLien>
                  <BoutonLien href={`/${org}/ventes/devis/nouveau?client=${id}`}>Nouveau devis</BoutonLien>
                </div>
              )
            }
          >
            <p>Les devis, factures et avoirs de ce client apparaîtront ici.</p>
          </EtatVide>
        ) : (
          <Tableau legende={`Documents de ${client.name}`}>
            <thead>
              <tr>
                <Th>Document</Th>
                <Th>Date</Th>
                <Th>Échéance</Th>
                <Th numerique>Montant TTC</Th>
                <Th>Statut</Th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id} className="hover:bg-survol">
                  <Td>
                    <Link href={`/${org}/ventes/${d.type === 'devis' ? 'devis' : d.type === 'avoir' ? 'avoirs' : 'factures'}/${d.id}`} className="flex flex-col leading-tight">
                      <span className="font-semibold">{LIBELLES_TYPE[d.type].titre}</span>
                      <span className="num text-[12px] text-encre-3">{d.number ?? 'Brouillon'}</span>
                    </Link>
                  </Td>
                  <Td className="num text-encre-3">{formatDate(d.issue_date)}</Td>
                  <Td className="num text-encre-3">{d.due_date ? formatDate(d.due_date) : '—'}</Td>
                  <Td numerique className="font-semibold">
                    {formatMontant(Number(d.total_ttc), d.currency)}
                  </Td>
                  <Td>
                    <Statut statut={d.affiche.cle} libelle={d.affiche.libelle} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tableau>
        )
      ) : (
        <div className="grid gap-[18px] lg:grid-cols-2">
          <Panneau>
            <PanneauTete titre="Identité" />
            <PanneauCorps>
              <ListeCles
                lignes={[
                  ['Catégorie', libelleTypeClient(client.kind)],
                  ...(client.siren ? [['SIREN', <span key="s" className="num">{grouperChiffres(client.siren)}</span>] as [string, React.ReactNode]] : []),
                  ...(client.siret ? [['SIRET', <span key="t" className="num">{grouperChiffres(client.siret)}</span>] as [string, React.ReactNode]] : []),
                  ...(client.vat_number ? [['N° TVA', <span key="v" className="num">{client.vat_number}</span>] as [string, React.ReactNode]] : []),
                  ['Adresse de facturation', adresse || '—'],
                  ...(client.shipping_different
                    ? [['Adresse de livraison', [client.shipping_line1, [client.shipping_postal_code, client.shipping_city].filter(Boolean).join(' ')].filter(Boolean).join(', ')] as [string, React.ReactNode]]
                    : []),
                  ...(client.einvoice_address ? [['Adresse électronique', <span key="e" className="num">{client.einvoice_address}</span>] as [string, React.ReactNode]] : []),
                ]}
              />
            </PanneauCorps>
          </Panneau>
          <Panneau>
            <PanneauTete titre="Réglages commerciaux" />
            <PanneauCorps>
              <ListeCles
                lignes={[
                  ['TVA appliquée (prestations)', tvaTexte],
                  ['Canal de transmission', canalTransmission(client.kind)],
                  ['Conditions de paiement', libelleConditions(client.payment_terms ?? organisation.default_payment_terms)],
                  [
                    'Remise par défaut',
                    client.default_discount_value == null
                      ? '—'
                      : client.default_discount_kind === 'montant'
                        ? formatMontant(client.default_discount_value)
                        : `${(client.default_discount_value / 100).toLocaleString('fr-FR')} %`,
                  ],
                  ['Langue · devise', `${client.language === 'en' ? 'Anglais' : 'Français'} · ${client.currency}`],
                  ['Bon de commande', client.purchase_order_required ? 'Obligatoire' : 'Facultatif'],
                  ['Relances automatiques', client.reminders_enabled ? 'Activées' : 'Désactivées'],
                ]}
              />
              {client.custom_mentions && <p className="rounded-m border border-dashed border-trait-fort bg-surface-2 p-3 text-[12.5px] text-encre-2">{client.custom_mentions}</p>}
            </PanneauCorps>
          </Panneau>
          {client.notes && (
            <Panneau className="lg:col-span-2">
              <PanneauTete titre="Notes internes" />
              <PanneauCorps>
                <p className="whitespace-pre-wrap text-[14px]">{client.notes}</p>
              </PanneauCorps>
            </Panneau>
          )}
        </div>
      )}
    </>
  )
}
