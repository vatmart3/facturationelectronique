import Link from 'next/link'
import { BoutonLien } from '@/components/ui/Bouton'
import { EnTeteVue } from '@/components/ui/EnTeteVue'
import { EtatVide } from '@/components/ui/EtatVide'
import { Icone } from '@/components/ui/Icone'
import { Segments } from '@/components/ui/Segments'
import { Statut } from '@/components/ui/Statut'
import { Tableau, Td, Th } from '@/components/ui/Tableau'
import { ajouterJours, aujourdHui, statutAffiche, type TypeDocument } from '@/lib/document'
import { Kanban } from './Kanban'
import { formatDate, formatMontant } from '@/lib/format'
import { peutFacturer } from '@/lib/roles'
import { chargerContexte } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export type Vue = 'factures' | 'devis' | 'avoirs'

const VUES: Record<Vue, { titre: string; types: TypeDocument[]; nouveau?: { href: string; libelle: string }; vide: string }> = {
  factures: {
    titre: 'Factures',
    types: ['facture', 'acompte'],
    nouveau: { href: 'ventes/factures/nouvelle', libelle: 'Nouvelle facture' },
    vide: 'Créez votre première facture : choisissez un client, ajoutez des lignes, le contrôle de conformité vous guide jusqu’à l’émission.',
  },
  devis: {
    titre: 'Devis',
    types: ['devis'],
    nouveau: { href: 'ventes/devis/nouveau', libelle: 'Nouveau devis' },
    vide: 'Un devis accepté se transforme en facture en un clic, avec ou sans acompte.',
  },
  avoirs: {
    titre: 'Avoirs',
    types: ['avoir'],
    vide: 'Un avoir se crée depuis une facture émise, totalement ou partiellement.',
  },
}

type Filtre = { id: string; libelle: string; garde: (s: ReturnType<typeof statutAffiche>, status: string) => boolean }

const FILTRES: Record<Vue, Filtre[]> = {
  factures: [
    { id: 'brouillons', libelle: 'Brouillons', garde: (_, st) => st === 'brouillon' },
    { id: 'a-encaisser', libelle: 'À encaisser', garde: (s, st) => ['emis', 'envoye', 'partiellement_paye'].includes(st) && s.cle !== 'retard' },
    { id: 'en-retard', libelle: 'En retard', garde: (s) => s.cle === 'retard' },
    { id: 'payees', libelle: 'Payées', garde: (_, st) => st === 'paye' },
    { id: 'annulees', libelle: 'Annulées', garde: (_, st) => st === 'annule' },
  ],
  devis: [
    { id: 'brouillons', libelle: 'Brouillons', garde: (_, st) => st === 'brouillon' },
    { id: 'envoyes', libelle: 'Envoyés', garde: (s, st) => st === 'envoye' && s.libelle !== 'Expiré' },
    { id: 'acceptes', libelle: 'Acceptés', garde: (_, st) => st === 'accepte' || st === 'transforme' },
    { id: 'clos', libelle: 'Refusés ou expirés', garde: (s, st) => st === 'refuse' || s.libelle === 'Expiré' },
  ],
  avoirs: [
    { id: 'brouillons', libelle: 'Brouillons', garde: (_, st) => st === 'brouillon' },
    { id: 'emis', libelle: 'Émis', garde: (_, st) => st !== 'brouillon' },
  ],
}

export async function ListeDocuments({ org, vue, statut, q, affichage }: { org: string; vue: Vue; statut?: string; q?: string; affichage?: string }) {
  const { organisation, role } = await chargerContexte(org)
  const config = VUES[vue]
  const supabase = await creerClientServeur()
  const { data } = await supabase
    .from('documents')
    .select('id, type, status, number, issue_date, due_date, valid_until, total_ht, total_ttc, amount_due, amount_paid, currency, subject, client_id, clients(name)')
    .eq('organization_id', organisation.id)
    .in('type', config.types)
    .order('issue_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500)
  const jour = aujourdHui()
  const documents = (data ?? []).map((d) => ({ ...d, affiche: statutAffiche(d, jour) }))
  const filtre = FILTRES[vue].find((f) => f.id === statut)
  const recherche = (q ?? '').trim().toLowerCase()
  const visibles = documents.filter((d) => {
    if (filtre && !filtre.garde(d.affiche, d.status)) return false
    if (!recherche) return true
    return `${d.number ?? ''} ${d.clients?.name ?? ''} ${d.subject ?? ''}`.toLowerCase().includes(recherche)
  })
  const lien = (s?: string) => {
    const p = new URLSearchParams()
    if (s) p.set('statut', s)
    if (q) p.set('q', q)
    const c = p.toString()
    return `/${org}/ventes/${vue}${c ? `?${c}` : ''}`
  }
  const editable = peutFacturer(role)
  const nouveau = config.nouveau

  return (
    <>
      <EnTeteVue
        titre={config.titre}
        description={`${documents.length} document${documents.length > 1 ? 's' : ''}`}
        actions={
          <>
            {vue === 'factures' && (
              <BoutonLien href={affichage === 'tableau' ? `/${org}/ventes/factures` : `/${org}/ventes/factures?affichage=tableau`}>
                {affichage === 'tableau' ? 'Vue liste' : 'Vue tableau'}
              </BoutonLien>
            )}
            {editable && nouveau && (
              <BoutonLien href={`/${org}/${nouveau.href}`} variante="primaire" icone="plus">
                {nouveau.libelle}
              </BoutonLien>
            )}
          </>
        }
      />
      {vue === 'factures' && affichage === 'tableau' ? (
        <Kanban
          slug={org}
          editable={editable}
          cartes={documents
            .filter((d) => d.status !== 'annule' && !(d.status === 'paye' && d.issue_date < ajouterJours(jour, -90)))
            .map((d) => ({
              id: d.id,
              status: d.status,
              colonne: d.status === 'brouillon' ? 'brouillon' : d.status === 'paye' ? 'payee' : d.affiche.cle === 'retard' ? 'retard' : 'envoyee',
              numero: d.number,
              client: d.clients?.name ?? '—',
              montant: Number(d.total_ttc),
              reste: Math.max(0, Number(d.amount_due) - Number(d.amount_paid)),
              echeance: d.status === 'paye' ? null : d.due_date,
              devise: d.currency,
            }))}
        />
      ) : (
      <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Segments
          libelle={`Filtrer les ${config.titre.toLowerCase()}`}
          segments={[
            { href: lien(), libelle: 'Tous', compte: documents.length, actif: !filtre },
            ...FILTRES[vue].map((f) => ({
              href: lien(f.id),
              libelle: f.libelle,
              compte: documents.filter((d) => f.garde(d.affiche, d.status)).length,
              actif: filtre?.id === f.id,
            })),
          ]}
        />
        <form className="flex items-center gap-2" role="search">
          {statut && <input type="hidden" name="statut" value={statut} />}
          <label className="flex h-[34px] items-center gap-2 rounded-m border border-trait-fort bg-surface px-2.5 focus-within:border-accent">
            <Icone nom="recherche" taille={15} className="text-encre-3" />
            <span className="sr-only">Rechercher</span>
            <input name="q" defaultValue={q} placeholder="Numéro, client, objet" className="w-44 bg-transparent text-[13.5px] outline-none placeholder:text-encre-3" />
          </label>
        </form>
      </div>
      {documents.length === 0 ? (
        <EtatVide
          titre={`Aucun ${vue === 'devis' ? 'devis' : vue === 'avoirs' ? 'avoir' : 'facture'} pour l’instant`}
          action={
            editable &&
            nouveau && (
              <BoutonLien href={`/${org}/${nouveau.href}`} variante="primaire" icone="plus">
                {nouveau.libelle}
              </BoutonLien>
            )
          }
        >
          <p>{config.vide}</p>
        </EtatVide>
      ) : visibles.length === 0 ? (
        <EtatVide titre="Aucun document ne correspond">
          <p>Modifiez la recherche ou choisissez un autre filtre.</p>
        </EtatVide>
      ) : (
        <Tableau legende={`Liste des ${config.titre.toLowerCase()}`}>
          <thead>
            <tr>
              <Th>Numéro</Th>
              <Th>Client</Th>
              <Th>Date</Th>
              <Th>{vue === 'devis' ? 'Validité' : 'Échéance'}</Th>
              <Th numerique>Montant TTC</Th>
              {vue === 'factures' && <Th numerique>Reste dû</Th>}
              <Th>Statut</Th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((d) => (
              <tr key={d.id} className="hover:bg-survol">
                <Td>
                  <Link href={`/${org}/ventes/${vue}/${d.id}`} className="flex flex-col leading-tight">
                    <span className="num font-semibold">{d.number ?? 'Brouillon'}</span>
                    {d.type === 'acompte' && <span className="text-[12px] text-encre-3">Acompte</span>}
                    {d.subject && <span className="max-w-[28ch] truncate text-[12px] text-encre-3">{d.subject}</span>}
                  </Link>
                </Td>
                <Td className="text-encre-2">{d.clients?.name ?? '—'}</Td>
                <Td className="num text-encre-3">{formatDate(d.issue_date)}</Td>
                <Td className="num text-encre-3">{(vue === 'devis' ? d.valid_until : d.due_date) ? formatDate((vue === 'devis' ? d.valid_until : d.due_date)!) : '—'}</Td>
                <Td numerique className="font-semibold">
                  {formatMontant(Number(d.total_ttc), d.currency)}
                </Td>
                {vue === 'factures' && (
                  <Td numerique className="text-encre-2">
                    {d.status === 'brouillon' ? '—' : formatMontant(Math.max(0, Number(d.amount_due) - Number(d.amount_paid)), d.currency)}
                  </Td>
                )}
                <Td>
                  <Statut statut={d.affiche.cle} libelle={d.affiche.libelle} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Tableau>
      )}
      </>
      )}
    </>
  )
}
