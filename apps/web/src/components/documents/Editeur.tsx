'use client'

import Link from 'next/link'
import { formatTaux, type LigneCalculee, type Totaux as TotauxMoteur } from '@pastille/moteur'
import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react'
import { dupliquerDocument, enregistrerDocument, lignesDerniereFacture, supprimerBrouillon } from '@/app/actions/documents'
import { Bouton } from '@/components/ui/Bouton'
import { Categorie } from '@/components/ui/Categorie'
import { Icone } from '@/components/ui/Icone'
import { Kbd, Message } from '@/components/ui/Message'
import { CONDITIONS_PAIEMENT } from '@/lib/clients'
import { cn } from '@/lib/cn'
import { verifierConformite, type Controle } from '@/lib/conformite'
import { calculer, copierLignes, echeance, LIBELLES_TYPE, ligneSignificative, type DocumentEdition, type LigneEdition } from '@/lib/document'
import { appliquerClient, contexteEditeur, ligneDepuisProduit, ligneLibre, type DonneesEditeur, type ProduitEditeur } from '@/lib/editeur'
import { formatDate, formatMontant, grouperChiffres } from '@/lib/format'
import { LignesDocument, ListeUnites } from './LignesDocument'
import { SaisieMontant, SaisiePourcentage } from './Saisies'

const CHEMINS = { facture: 'ventes/factures', acompte: 'ventes/factures', devis: 'ventes/devis', avoir: 'ventes/avoirs' } as const
const DEVISES = ['EUR', 'USD', 'GBP', 'CHF', 'CAD']

interface Props {
  slug: string
  initial: DocumentEdition
  id: string | null
  donnees: DonneesEditeur
  /** Rôle sans droit d'écriture : tout est désactivé. */
  lecture?: boolean
  /** Actions supplémentaires (émission, phase 5). */
  actions?: (etat: { id: string | null; peutEmettre: boolean; enregistre: boolean; doc: DocumentEdition }) => ReactNode
}

export function Editeur({ slug, initial, id: idInitial, donnees, lecture = false, actions }: Props) {
  const ctx = useMemo(() => contexteEditeur(donnees), [donnees])
  const [doc, setDoc] = useState(initial)
  const [id, setId] = useState(idInitial)
  const [version, setVersion] = useState(0)
  const [versionSauvee, setVersionSauvee] = useState(0)
  const [versionEchec, setVersionEchec] = useState<number | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enregistreLe, setEnregistreLe] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [transition, demarrer] = useTransition()

  const client = donnees.clients.find((c) => c.id === doc.clientId) ?? null
  const calcul = calculer(doc)
  const totaux = calcul.ok ? calcul.totaux : null
  const calculees = useMemo(() => new Map<string, LigneCalculee>((totaux?.lignes ?? []).map((l) => [l.id, l])), [totaux])
  const conformite = verifierConformite(doc, donnees.organisation, client, totaux, donnees.textes)
  const libelles = LIBELLES_TYPE[doc.type]
  const modifie = version > versionSauvee

  function modifier(f: (d: DocumentEdition) => DocumentEdition) {
    if (lecture) return
    setDoc(f)
    setVersion((v) => v + 1)
  }
  const changerLigne = (cle: string, f: (l: LigneEdition) => LigneEdition) =>
    modifier((d) => ({ ...d, lignes: d.lignes.map((l) => (l.cle === cle ? f(l) : l)) }))

  async function sauver(etat: DocumentEdition, v: number) {
    setEnCours(true)
    const r = await enregistrerDocument(slug, etat, id)
    setEnCours(false)
    if (r.ok) {
      if (!id) {
        setId(r.id)
        window.history.replaceState(null, '', `/${slug}/${CHEMINS[etat.type]}/${r.id}`)
      }
      setErreur(null)
      setVersionEchec(null)
      setEnregistreLe(r.le)
      setVersionSauvee((s) => Math.max(s, v))
    } else {
      setErreur(r.erreur)
      setVersionEchec(v)
    }
  }

  // Enregistrement automatique 800 ms après la dernière frappe, jamais deux à la fois.
  useEffect(() => {
    if (lecture || enCours || version <= versionSauvee || version === versionEchec) return
    const t = setTimeout(() => void sauver(doc, version), 800)
    return () => clearTimeout(t)
  })

  useEffect(() => {
    if (!modifie) return
    const avertir = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', avertir)
    return () => window.removeEventListener('beforeunload', avertir)
  }, [modifie])

  // Ctrl+S enregistre tout de suite.
  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (!enCours && version > versionSauvee) void sauver(doc, version)
      }
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  })

  function choisirClient(clientId: string) {
    const c = donnees.clients.find((x) => x.id === clientId) ?? null
    modifier((d) => appliquerClient(d, c, ctx))
  }

  function ajouterLigne(apres?: string): string {
    const nouvelle = ligneLibre(client, ctx.regime)
    modifier((d) => {
      const i = apres ? d.lignes.findIndex((l) => l.cle === apres) : -1
      const lignes = [...d.lignes]
      lignes.splice(i === -1 ? lignes.length : i + 1, 0, nouvelle)
      return { ...d, lignes }
    })
    return nouvelle.cle
  }

  function commeLaDerniereFois() {
    if (!doc.clientId) return
    const clientId = doc.clientId
    demarrer(async () => {
      const r = await lignesDerniereFacture(slug, clientId)
      if (!r || r.lignes.length === 0) {
        setInfo('Aucune facture précédente pour ce client.')
        return
      }
      modifier((d) => ({ ...d, lignes: [...d.lignes.filter(ligneSignificative), ...copierLignes(r.lignes)] }))
      setInfo(`Lignes reprises de la facture ${r.numero ?? 'précédente'}.`)
    })
  }

  const etatSauvegarde = lecture
    ? 'Lecture seule'
    : enCours
      ? 'Enregistrement…'
      : erreur && version === versionEchec
        ? 'Non enregistré'
        : modifie
          ? 'Modifications en cours'
          : id
            ? `Enregistré${enregistreLe ? ` à ${new Date(enregistreLe).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}`
            : 'Pas encore enregistré'

  const bloquants = conformite.controles.filter((c) => !c.ok && c.bloquant)

  return (
    <div className="flex flex-col gap-5">
      <ListeUnites />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/${slug}/${CHEMINS[doc.type]}`} className="inline-flex items-center gap-1 text-[12.5px] text-encre-3 hover:text-encre">
            <Icone nom="chevron-gauche" taille={13} />
            {doc.type === 'devis' ? 'Devis' : doc.type === 'avoir' ? 'Avoirs' : 'Factures'}
          </Link>
          <h1 className="mt-1 text-[24px] font-bold leading-tight">{id ? `${libelles.titre} · brouillon` : libelles.nouveau}</h1>
        </div>
        <p
          role="status"
          className={cn(
            'flex items-center gap-1.5 text-[12.5px]',
            erreur && version === versionEchec ? 'text-alerte' : 'text-encre-3',
          )}
        >
          <span
            className={cn('size-1.5 rounded-full', erreur && version === versionEchec ? 'bg-alerte' : modifie || enCours ? 'bg-attente' : 'bg-ok')}
            aria-hidden="true"
          />
          {etatSauvegarde}
        </p>
      </div>

      {erreur && version === versionEchec && (
        <Message ton="erreur">
          {erreur}{' '}
          <button type="button" className="font-semibold underline" onClick={() => void sauver(doc, version)}>
            Réessayer
          </button>
        </Message>
      )}
      {info && (
        <Message ton="info">
          {info}{' '}
          <button type="button" className="text-encre-3 underline" onClick={() => setInfo(null)}>
            Fermer
          </button>
        </Message>
      )}

      <fieldset disabled={lecture} className="m-0 grid min-w-0 gap-5 border-0 p-0 xl:grid-cols-[minmax(0,1fr)_320px]">
        <legend className="sr-only">{libelles.titre}</legend>

        {/* Feuille */}
        <article className="min-w-0 rounded-l border border-trait bg-surface shadow-douce">
          <div className="flex flex-col gap-7 p-5 sm:p-8">
            <header className="flex flex-wrap items-start justify-between gap-6">
              <div className="flex min-w-0 flex-col gap-0.5 text-[13px] text-encre-2">
                <span className="text-[15px] font-semibold text-encre">{donnees.organisation.name}</span>
                {donnees.organisation.address_line1 && <span>{donnees.organisation.address_line1}</span>}
                {(donnees.organisation.postal_code || donnees.organisation.city) && (
                  <span>{[donnees.organisation.postal_code, donnees.organisation.city].filter(Boolean).join(' ')}</span>
                )}
                {donnees.organisation.siren && <span className="num text-encre-3">SIREN {grouperChiffres(donnees.organisation.siren)}</span>}
              </div>
              <div className="text-right">
                <p className="text-[22px] font-bold tracking-tight" style={{ color: donnees.organisation.accent_color }}>
                  {libelles.titre}
                </p>
                <p className="text-[12.5px] text-encre-3">{doc.type === 'devis' ? 'Numéro attribué à l’envoi' : 'Numéro attribué à l’émission'}</p>
              </div>
            </header>

            <section aria-labelledby="titre-client" className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 id="titre-client" className="surtitre">
                    {doc.type === 'devis' ? 'Destinataire' : 'Facturer à'}
                  </h2>
                  <Link href={`/${slug}/clients/nouveau`} className="text-[12px] text-accent hover:underline">
                    Nouveau client
                  </Link>
                </div>
                <label className="sr-only" htmlFor="client">
                  Client
                </label>
                <select
                  id="client"
                  value={doc.clientId ?? ''}
                  onChange={(e) => choisirClient(e.target.value)}
                  className="h-[38px] w-full rounded-m border border-trait-fort bg-surface px-2.5 text-[14px] outline-none focus:border-accent"
                >
                  <option value="">Choisir un client…</option>
                  {donnees.clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.billing_city ? ` · ${c.billing_city}` : ''}
                    </option>
                  ))}
                </select>
                {client && (
                  <div className="flex flex-col gap-0.5 rounded-m bg-surface-2 px-3 py-2.5 text-[13px] text-encre-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-encre">{client.name}</span>
                      <Categorie categorie={client.kind} />
                    </div>
                    {client.billing_line1 && <span>{client.billing_line1}</span>}
                    {client.billing_line2 && <span>{client.billing_line2}</span>}
                    <span>{[client.billing_postal_code, client.billing_city, client.billing_country !== 'FR' ? client.billing_country : null].filter(Boolean).join(' ')}</span>
                    {client.siren && <span className="num text-encre-3">SIREN {grouperChiffres(client.siren)}</span>}
                    {client.vat_number && <span className="num text-encre-3">TVA {client.vat_number}</span>}
                    <span className="mt-1.5 flex flex-wrap gap-3">
                      <Link href={`/${slug}/clients/${client.id}`} className="text-[12px] text-accent hover:underline">
                        Fiche client
                      </Link>
                      {doc.type !== 'avoir' && (
                        <button type="button" onClick={commeLaDerniereFois} disabled={transition} className="text-[12px] font-semibold text-accent hover:underline">
                          {transition ? 'Recherche…' : 'Comme la dernière fois'}
                        </button>
                      )}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 self-start">
                <ChampFeuille libelle="Date d’émission">
                  <input type="date" required value={doc.issueDate} onChange={(e) => e.target.value && modifier((d) => ({ ...d, issueDate: e.target.value }))} />
                </ChampFeuille>
                {doc.type === 'devis' ? (
                  <ChampFeuille libelle="Valable jusqu’au">
                    <input type="date" value={doc.validUntil ?? ''} onChange={(e) => modifier((d) => ({ ...d, validUntil: e.target.value || null }))} />
                  </ChampFeuille>
                ) : (
                  <ChampFeuille libelle="Échéance">
                    <output className="num flex h-8 items-center px-2 text-[13px]">{formatDate(echeance(doc) ?? doc.issueDate)}</output>
                  </ChampFeuille>
                )}
                <ChampFeuille libelle="Prestation ou livraison">
                  <input type="date" value={doc.serviceDate ?? ''} onChange={(e) => modifier((d) => ({ ...d, serviceDate: e.target.value || null }))} />
                </ChampFeuille>
                <ChampFeuille libelle="Bon de commande" requis={client?.purchase_order_required}>
                  <input value={doc.purchaseOrder} maxLength={100} onChange={(e) => modifier((d) => ({ ...d, purchaseOrder: e.target.value }))} />
                </ChampFeuille>
                <ChampFeuille libelle="Période du">
                  <input type="date" value={doc.servicePeriodStart ?? ''} onChange={(e) => modifier((d) => ({ ...d, servicePeriodStart: e.target.value || null }))} />
                </ChampFeuille>
                <ChampFeuille libelle="au">
                  <input type="date" value={doc.servicePeriodEnd ?? ''} onChange={(e) => modifier((d) => ({ ...d, servicePeriodEnd: e.target.value || null }))} />
                </ChampFeuille>
              </div>
            </section>

            <ChampFeuille libelle="Objet">
              <input
                value={doc.subject}
                maxLength={200}
                placeholder="Ex. Refonte du site, octobre 2026"
                onChange={(e) => modifier((d) => ({ ...d, subject: e.target.value }))}
              />
            </ChampFeuille>

            <LignesDocument
              lignes={doc.lignes}
              calculees={calculees}
              produits={donnees.produits}
              regime={ctx.regime}
              devise={doc.currency}
              onChanger={changerLigne}
              onProduit={(cle, p: ProduitEditeur) =>
                changerLigne(cle, (l) => ligneDepuisProduit(p, client, ctx, { cle: l.cle, quantite: l.quantite, remise: l.remise }))
              }
              onAjouter={ajouterLigne}
              onSupprimer={(cle) => modifier((d) => ({ ...d, lignes: d.lignes.filter((l) => l.cle !== cle) }))}
              onDeplacer={(cle, sens) =>
                modifier((d) => {
                  const i = d.lignes.findIndex((l) => l.cle === cle)
                  const j = i + sens
                  if (i < 0 || j < 0 || j >= d.lignes.length) return d
                  const lignes = [...d.lignes]
                  ;[lignes[i], lignes[j]] = [lignes[j]!, lignes[i]!]
                  return { ...d, lignes }
                })
              }
            />

            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_300px]">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="notes" className="surtitre">
                  Note au client
                </label>
                <textarea
                  id="notes"
                  value={doc.publicNotes}
                  maxLength={2000}
                  rows={3}
                  placeholder="Merci pour votre confiance."
                  onChange={(e) => modifier((d) => ({ ...d, publicNotes: e.target.value }))}
                  className="rounded-m border border-trait bg-surface p-2.5 text-[13px] outline-none focus:border-accent"
                />
              </div>
              <Totaux doc={doc} totaux={totaux} erreurCalcul={calcul.ok ? null : calcul.erreur} />
            </div>

            {conformite.mentions.length > 0 && (
              <footer className="flex flex-col gap-1 border-t border-trait pt-4 text-[11.5px] leading-relaxed text-encre-3">
                {conformite.mentions.map((m) => (
                  <p key={m}>{m}</p>
                ))}
              </footer>
            )}
          </div>
        </article>

        {/* Panneau latéral */}
        <aside className="flex min-w-0 flex-col gap-4 self-start xl:sticky xl:top-[76px]">
          <section className="rounded-l border border-trait bg-surface p-4">
            <p className="surtitre">{doc.type === 'devis' ? 'Montant du devis' : 'Net à payer'}</p>
            <p className="num mt-1 text-[28px] font-semibold leading-none tracking-tight" style={{ fontSize: 28 }}>
              {totaux ? formatMontant(totaux.netAPayer, doc.currency) : '—'}
            </p>
            {totaux && (
              <p className="mt-1.5 text-[12.5px] text-encre-3">
                dont TVA {formatMontant(totaux.totalTva, doc.currency)} · HT {formatMontant(totaux.totalHt, doc.currency)}
              </p>
            )}
            <div className="mt-4 flex flex-col gap-2">
              {actions?.({ id, peutEmettre: conformite.peutEmettre && !modifie && !enCours, enregistre: !modifie && !enCours && Boolean(id), doc })}
              {!lecture && (
                <Bouton
                  variante={actions ? 'secondaire' : 'primaire'}
                  chargement={enCours}
                  disabled={!modifie}
                  onClick={() => void sauver(doc, version)}
                >
                  {modifie ? 'Enregistrer' : 'Brouillon enregistré'}
                </Bouton>
              )}
              <p className="text-center text-[11.5px] text-encre-3">
                <Kbd>Ctrl</Kbd> <Kbd>S</Kbd> enregistre · <Kbd>Entrée</Kbd> ajoute une ligne
              </p>
            </div>
          </section>

          <section className="rounded-l border border-trait bg-surface" aria-labelledby="titre-conformite">
            <div className="flex items-center justify-between gap-2 border-b border-trait px-4 py-3">
              <h2 id="titre-conformite" className="text-[14px] font-semibold">
                Conformité
              </h2>
              <span className={cn('text-[12px] font-medium', bloquants.length ? 'text-attente' : 'text-ok')}>
                {bloquants.length ? `${bloquants.length} point${bloquants.length > 1 ? 's' : ''} à régler` : 'Prête à émettre'}
              </span>
            </div>
            <ul className="m-0 flex list-none flex-col gap-0.5 p-2">
              {conformite.controles.map((c) => (
                <LigneControle key={c.cle} controle={c} slug={slug} clientId={doc.clientId} />
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-3 rounded-l border border-trait bg-surface p-4" aria-labelledby="titre-parametres">
            <h2 id="titre-parametres" className="text-[14px] font-semibold">
              Paramètres
            </h2>
            {doc.type !== 'devis' && (
              <ChampPanneau libelle="Conditions de paiement">
                <select value={doc.paymentTerms} onChange={(e) => modifier((d) => ({ ...d, paymentTerms: e.target.value as DocumentEdition['paymentTerms'] }))}>
                  {CONDITIONS_PAIEMENT.map((c) => (
                    <option key={c.valeur} value={c.valeur}>
                      {c.libelle}
                    </option>
                  ))}
                </select>
              </ChampPanneau>
            )}
            <ChampPanneau libelle="Remise globale">
              <div className="flex gap-1.5">
                <select
                  aria-label="Type de remise globale"
                  value={doc.remise?.type ?? ''}
                  onChange={(e) => {
                    const t = e.target.value
                    modifier((d) => ({ ...d, remise: t === 'pourcentage' || t === 'montant' ? { type: t, valeur: 0 } : null }))
                  }}
                  className="w-28 shrink-0"
                >
                  <option value="">Aucune</option>
                  <option value="pourcentage">En %</option>
                  <option value="montant">En montant</option>
                </select>
                {doc.remise?.type === 'pourcentage' && (
                  <SaisiePourcentage
                    aria-label="Remise globale en pourcentage"
                    valeur={doc.remise.valeur}
                    onValeur={(p) => modifier((d) => ({ ...d, remise: { type: 'pourcentage', valeur: p ?? 0 } }))}
                    className="border-trait-fort"
                  />
                )}
                {doc.remise?.type === 'montant' && (
                  <SaisieMontant
                    aria-label="Remise globale en montant HT"
                    valeur={doc.remise.valeur}
                    onValeur={(c) => modifier((d) => ({ ...d, remise: { type: 'montant', valeur: Math.abs(c) } }))}
                    className="border-trait-fort"
                  />
                )}
              </div>
            </ChampPanneau>
            {doc.type !== 'devis' && (
              <ChampPanneau libelle="Escompte pour paiement anticipé">
                <input value={doc.earlyPaymentDiscount} maxLength={300} onChange={(e) => modifier((d) => ({ ...d, earlyPaymentDiscount: e.target.value }))} />
              </ChampPanneau>
            )}
            <div className="grid grid-cols-2 gap-2">
              <ChampPanneau libelle="Devise">
                <select value={doc.currency} onChange={(e) => modifier((d) => ({ ...d, currency: e.target.value }))}>
                  {DEVISES.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </ChampPanneau>
              <ChampPanneau libelle="Langue">
                <select value={doc.language} onChange={(e) => modifier((d) => ({ ...d, language: e.target.value as 'fr' | 'en' }))}>
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </ChampPanneau>
            </div>
            <ChampPanneau libelle="Note interne (jamais imprimée)">
              <textarea rows={2} value={doc.internalNotes} maxLength={2000} onChange={(e) => modifier((d) => ({ ...d, internalNotes: e.target.value }))} />
            </ChampPanneau>
          </section>

          {id && !lecture && (
            <section className="flex flex-col gap-2 rounded-l border border-trait bg-surface p-4">
              <h2 className="text-[14px] font-semibold">Autres actions</h2>
              {doc.type === 'devis' && (
                <form action={dupliquerDocument.bind(null, slug, id, 'facture')}>
                  <Bouton type="submit" className="w-full" disabled={modifie}>
                    Transformer en facture
                  </Bouton>
                </form>
              )}
              <form action={dupliquerDocument.bind(null, slug, id, undefined)}>
                <Bouton type="submit" variante="fantome" className="w-full" disabled={modifie}>
                  Dupliquer
                </Bouton>
              </form>
              <form
                action={supprimerBrouillon.bind(null, slug, id, doc.type)}
                onSubmit={(e) => {
                  if (!window.confirm('Supprimer ce brouillon ? Cette action est définitive.')) e.preventDefault()
                }}
              >
                <Bouton type="submit" variante="fantome" className="w-full text-alerte hover:text-alerte">
                  Supprimer le brouillon
                </Bouton>
              </form>
            </section>
          )}
        </aside>
      </fieldset>
    </div>
  )
}

function ChampFeuille({ libelle, requis, children }: { libelle: string; requis?: boolean; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="surtitre">
        {libelle}
        {requis && <span className="text-attente"> · requis</span>}
      </span>
      <span className="contents [&>input]:h-8 [&>input]:w-full [&>input]:min-w-0 [&>input]:rounded-s [&>input]:border [&>input]:border-trait [&>input]:bg-surface [&>input]:px-2 [&>input]:text-[13px] [&>input]:outline-none [&>input:focus]:border-accent">
        {children}
      </span>
    </label>
  )
}

function ChampPanneau({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[12.5px] font-medium text-encre-2">
      {libelle}
      <span className="contents [&_input]:h-8 [&_input]:w-full [&_input]:rounded-s [&_input]:border [&_input]:border-trait-fort [&_input]:bg-surface [&_input]:px-2 [&_input]:text-[13px] [&_input]:font-normal [&_input]:text-encre [&_input]:outline-none [&_select]:h-8 [&_select]:w-full [&_select]:rounded-s [&_select]:border [&_select]:border-trait-fort [&_select]:bg-surface [&_select]:px-1.5 [&_select]:text-[13px] [&_select]:font-normal [&_select]:text-encre [&_textarea]:rounded-s [&_textarea]:border [&_textarea]:border-trait-fort [&_textarea]:bg-surface [&_textarea]:p-2 [&_textarea]:text-[13px] [&_textarea]:font-normal [&_textarea]:text-encre [&_textarea]:outline-none">
        {children}
      </span>
    </label>
  )
}

function LigneControle({ controle: c, slug, clientId }: { controle: Controle; slug: string; clientId: string | null }) {
  const lien = c.ok ? null : c.ou === 'entreprise' ? `/${slug}/reglages` : c.ou === 'client' && clientId ? `/${slug}/clients/${clientId}/modifier` : null
  return (
    <li className="flex items-start gap-2 rounded-s px-2 py-1.5 text-[12.5px]">
      <span
        className={cn(
          'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full',
          c.ok ? 'bg-ok-doux text-ok' : c.bloquant ? 'bg-attente-doux text-attente' : 'bg-neutre-doux text-neutre',
        )}
        aria-hidden="true"
      >
        <Icone nom={c.ok ? 'coche' : 'alerte'} taille={10} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className={c.ok ? 'text-encre-2' : 'font-medium text-encre'}>
          {c.libelle}
          <span className="sr-only">{c.ok ? ' : conforme' : c.bloquant ? ' : à compléter, bloquant' : ' : conseillé'}</span>
        </span>
        {!c.ok && c.aide && <span className="text-encre-3">{c.aide}</span>}
        {lien && (
          <Link href={lien} className="text-accent hover:underline">
            Compléter
          </Link>
        )}
      </span>
    </li>
  )
}

function Totaux({ doc, totaux, erreurCalcul }: { doc: DocumentEdition; totaux: TotauxMoteur | null; erreurCalcul: string | null }) {
  if (!totaux) return <p className="text-[13px] text-alerte">{erreurCalcul ?? 'Calcul impossible.'}</p>
  const m = (c: number) => formatMontant(c, doc.currency)
  return (
    <dl className="m-0 flex flex-col text-[13px]">
      <Ligne cle="Total HT des lignes" valeur={m(totaux.totalLignesHt)} />
      {totaux.remiseGlobale !== 0 && <Ligne cle="Remise globale" valeur={`− ${m(totaux.remiseGlobale)}`} />}
      {totaux.acomptesHt !== 0 && <Ligne cle="Acomptes déduits (HT)" valeur={`− ${m(totaux.acomptesHt)}`} />}
      <Ligne cle="Total HT" valeur={m(totaux.totalHt)} fort />
      {totaux.ventilation.map((v) => (
        <Ligne
          key={`${v.categorie}:${v.taux}`}
          cle={v.categorie === 'S' ? `TVA ${formatTaux(v.taux)} sur ${m(v.baseHt)}` : `${v.categorie === 'Z' ? 'TVA 0 %' : 'Sans TVA'} sur ${m(v.baseHt)}`}
          valeur={m(v.tva)}
          discret
        />
      ))}
      <Ligne cle="Total TTC" valeur={m(totaux.totalTtc)} fort />
      {totaux.netAPayer !== totaux.totalTtc && <Ligne cle="Net à payer" valeur={m(totaux.netAPayer)} fort />}
    </dl>
  )
}

function Ligne({ cle, valeur, fort, discret }: { cle: string; valeur: string; fort?: boolean; discret?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-3 py-1', fort && 'border-t border-trait pt-2 font-semibold', discret && 'text-encre-3')}>
      <dt>{cle}</dt>
      <dd className="num m-0 text-right">{valeur}</dd>
    </div>
  )
}
