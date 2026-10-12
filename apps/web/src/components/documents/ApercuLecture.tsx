import Link from 'next/link'
import { changerStatut, creerAcompte, creerAvoir, dupliquerDocument, facturerDevis } from '@/app/actions/documents'
import { Icone } from '@/components/ui/Icone'
import { ListeCles } from '@/components/ui/Panneau'
import { Statut } from '@/components/ui/Statut'
import { aujourdHui, LIBELLES_TYPE, statutAffiche } from '@/lib/document'
import { formatDate, formatMontant } from '@/lib/format'
import type { DocumentImprimable } from '@/lib/imprimable'
import { peutFacturer, type Role } from '@/lib/roles'
import { urlPublique } from '@/lib/supabase/navigateur'
import { creerClientServeur } from '@/lib/supabase/serveur'
import type { DocumentRow } from '@/lib/supabase/types'
import { BoutonAction, FormulaireAcompte } from './Actions'
import { DocumentImprime } from './DocumentImprime'

const CHEMINS = { facture: 'factures', acompte: 'factures', devis: 'devis', avoir: 'avoirs' } as const

/** Document émis : consultation seule (contenu figé), suivi et documents dérivés. */
export async function ApercuLecture({ org, document: d, imprimable, role }: { org: string; document: DocumentRow; imprimable: DocumentImprimable; role: Role }) {
  const statut = statutAffiche(d, aujourdHui())
  const editable = peutFacturer(role)
  const supabase = await creerClientServeur()
  const { data: lies } = await supabase
    .from('documents')
    .select('id, type, number, status, issue_date, total_ttc, currency')
    .eq('organization_id', d.organization_id)
    .or(`origin_document_id.eq.${d.id}${d.origin_document_id ? `,id.eq.${d.origin_document_id}` : ''}`)
    .order('issue_date')
  const facture = d.type === 'facture' || d.type === 'acompte'
  const ouverte = ['emis', 'envoye', 'partiellement_paye'].includes(d.status)
  const logo = imprimable.vendeur.logo_path ? urlPublique('logos', imprimable.vendeur.logo_path) : null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/${org}/ventes/${CHEMINS[d.type]}`} className="inline-flex items-center gap-1 text-[12.5px] text-encre-3 hover:text-encre">
            <Icone nom="chevron-gauche" taille={13} />
            {d.type === 'devis' ? 'Devis' : d.type === 'avoir' ? 'Avoirs' : 'Factures'}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-[24px] font-bold leading-tight">
              {LIBELLES_TYPE[d.type].titre} <span className="num text-[21px]">{d.number}</span>
            </h1>
            <Statut statut={statut.cle} libelle={statut.libelle} />
          </div>
          <p className="mt-1 text-[13.5px] text-encre-2">
            {imprimable.client?.name ?? '—'} · {formatDate(d.issue_date)} · {formatMontant(Number(d.total_ttc), d.currency)} TTC
          </p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 overflow-x-auto rounded-l border border-trait bg-surface-2 p-3 sm:p-6">
          <div className="min-w-[560px]">
            <DocumentImprime doc={imprimable} logoUrl={logo} />
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-4 self-start xl:sticky xl:top-[76px]">
          <section className="flex flex-col gap-2 rounded-l border border-trait bg-surface p-4">
            <p className="surtitre">{d.type === 'devis' ? 'Montant du devis' : d.type === 'avoir' ? 'Montant de l’avoir' : 'Reste à payer'}</p>
            <p className="num text-[28px] font-semibold leading-none tracking-tight" style={{ fontSize: 28 }}>
              {formatMontant(facture ? Math.max(0, Number(d.amount_due) - Number(d.amount_paid)) : Number(d.amount_due), d.currency)}
            </p>
            {facture && d.due_date && <p className="text-[12.5px] text-encre-3">Échéance le {formatDate(d.due_date)}</p>}

            {editable && (
              <div className="mt-2 flex flex-col gap-2">
                {facture && d.status === 'emis' && (
                  <BoutonAction action={changerStatut.bind(null, org, d.id, 'envoye')} variante="primaire">
                    Marquer comme envoyée
                  </BoutonAction>
                )}
                {d.type === 'devis' && d.status === 'envoye' && (
                  <div className="grid grid-cols-2 gap-2">
                    <BoutonAction action={changerStatut.bind(null, org, d.id, 'accepte')} variante="primaire">
                      Accepté
                    </BoutonAction>
                    <BoutonAction action={changerStatut.bind(null, org, d.id, 'refuse')}>Refusé</BoutonAction>
                  </div>
                )}
                {d.type === 'devis' && (d.status === 'envoye' || d.status === 'accepte') && (
                  <>
                    <BoutonAction action={facturerDevis.bind(null, org, d.id)} variante={d.status === 'accepte' ? 'primaire' : 'secondaire'}>
                      Transformer en facture
                    </BoutonAction>
                    <FormulaireAcompte action={creerAcompte.bind(null, org, d.id)} />
                  </>
                )}
                {d.type === 'devis' && (d.status === 'refuse' || d.status === 'expire') && (
                  <BoutonAction action={changerStatut.bind(null, org, d.id, d.status === 'expire' ? 'accepte' : 'envoye')}>
                    {d.status === 'expire' ? 'Accepté malgré l’expiration' : 'Rouvrir le devis'}
                  </BoutonAction>
                )}
                {facture && (ouverte || d.status === 'paye') && (
                  <BoutonAction
                    action={creerAvoir.bind(null, org, d.id)}
                    confirmation="Créer un avoir pour cette facture ? Il est préparé en brouillon : vous pourrez retirer des lignes pour un avoir partiel avant de l’émettre."
                  >
                    Créer un avoir
                  </BoutonAction>
                )}
                <BoutonAction action={dupliquerDocument.bind(null, org, d.id)} variante="fantome">
                  Dupliquer
                </BoutonAction>
              </div>
            )}
          </section>

          {(lies ?? []).length > 0 && (
            <section className="flex flex-col gap-1 rounded-l border border-trait bg-surface p-4">
              <h2 className="mb-1 text-[14px] font-semibold">Documents liés</h2>
              {(lies ?? []).map((x) => (
                <Link
                  key={x.id}
                  href={`/${org}/ventes/${CHEMINS[x.type]}/${x.id}`}
                  className="flex items-center justify-between gap-2 rounded-s px-2 py-1.5 text-[13px] hover:bg-survol"
                >
                  <span className="min-w-0">
                    <span className="font-medium">{LIBELLES_TYPE[x.type].titre}</span> <span className="num text-encre-3">{x.number ?? 'brouillon'}</span>
                  </span>
                  <span className="num shrink-0">{formatMontant(Number(x.total_ttc), x.currency)}</span>
                </Link>
              ))}
            </section>
          )}

          <section className="flex flex-col gap-2 rounded-l border border-trait bg-surface p-4" aria-labelledby="titre-integrite">
            <h2 id="titre-integrite" className="flex items-center gap-2 text-[14px] font-semibold">
              <Icone nom="reforme" taille={15} className="text-ok" />
              Intégrité
            </h2>
            <p className="text-[12.5px] text-encre-2">
              Contenu figé à l’émission. Son empreinte est chaînée à celle du document précédent : toute modification serait détectée.
            </p>
            <ListeCles
              lignes={[
                ['Émis le', d.issued_at ? new Date(d.issued_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'],
                ['Rang dans la chaîne', <span key="r" className="num">{d.chain_position ?? '—'}</span>],
                ['Empreinte', <span key="e" className="num text-[11px]" title={d.content_hash ?? ''}>{d.content_hash ? `${d.content_hash.slice(0, 12)}…` : '—'}</span>],
                ['Précédente', <span key="p" className="num text-[11px]">{d.previous_hash ? `${d.previous_hash.slice(0, 12)}…` : 'première'}</span>],
              ]}
            />
          </section>
        </aside>
      </div>
    </div>
  )
}
