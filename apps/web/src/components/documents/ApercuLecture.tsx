import Link from 'next/link'
import { controler } from '@pastille/facturx'
import { changerStatut, creerAcompte, creerAvoir, dupliquerDocument, facturerDevis } from '@/app/actions/documents'
import { actualiser, transmettre } from '@/app/actions/plateforme'
import { creerRecurrence, enregistrerPaiement, envoyerParEmail, relancer, supprimerPaiement } from '@/app/actions/suivi'
import { StatutPa } from '@/components/plateforme/StatutPa'
import { STATUTS, type Evenement } from '@/lib/pa/cycle'
import { classesBouton } from '@/components/ui/Bouton'
import { Icone } from '@/components/ui/Icone'
import { IconeObjet } from '@/components/ui/IconeObjet'
import { ListeCles } from '@/components/ui/Panneau'
import { Parcours } from '@/components/ui/Parcours'
import { Statut } from '@/components/ui/Statut'
import { aujourdHui, LIBELLES_TYPE, statutAffiche } from '@/lib/document'
import { versEn16931 } from '@/lib/en16931'
import { formatDate, formatMontant } from '@/lib/format'
import { centimesEnSaisie } from '@/lib/montant'
import { origineSite } from '@/lib/site'
import { etapesParcours } from '@/lib/parcours'
import { libelleMoyen } from '@/lib/suivi'
import { destinataireClient } from '@/lib/taches'
import type { DocumentImprimable } from '@/lib/imprimable'
import { peutFacturer, type Role } from '@/lib/roles'
import { urlPublique } from '@/lib/supabase/stockage'
import { creerClientServeur } from '@/lib/supabase/serveur'
import type { DocumentRow } from '@/lib/supabase/types'
import { BoutonAction, BoutonSupprimerPaiement, FormulaireAcompte } from './Actions'
import { ChampsEnvoi, ChampsPaiement, ChampsRecurrence, FormulaireSuivi, Partage } from './Suivi'
import { DocumentImprime } from './DocumentImprime'
import { BoutonImprimer } from './Imprimer'

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
  const en16931 = versEn16931(imprimable)
  const anomalies = en16931 ? controler(en16931) : []
  const bloquantes = anomalies.filter((a) => a.bloquant)
  const base = `/${org}/documents/${d.id}`
  const jour = aujourdHui()
  const reste = Math.max(0, Number(d.amount_due) - Number(d.amount_paid))
  const [{ data: paiements }, { data: envois }, { data: signature }, destinataire, origine, { data: transmissions }] = await Promise.all([
    facture ? supabase.from('payments').select('*').eq('document_id', d.id).order('paid_on') : Promise.resolve({ data: [] }),
    supabase.from('reminders').select('*').eq('document_id', d.id).order('sent_at', { ascending: false }).limit(20),
    d.type === 'devis' ? supabase.from('quote_signatures').select('*').eq('document_id', d.id).maybeSingle() : Promise.resolve({ data: null }),
    d.client_id ? destinataireClient(supabase, d.organization_id, d.client_id) : Promise.resolve(null),
    origineSite(),
    d.type === 'devis' ? Promise.resolve({ data: [] }) : supabase.from('einvoice_transmissions').select('*').eq('document_id', d.id).order('sent_at', { ascending: false }),
  ])
  const transmission = transmissions?.[0] ?? null
  const enRetard = statut.cle === 'retard'

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3.5 rounded-l border border-trait bg-surface px-4 py-3.5 shadow-douce">
        <div className="flex min-w-0 items-center gap-3">
          <IconeObjet icone={d.type === 'acompte' ? 'facture' : d.type} taille="l" />
          <div className="min-w-0">
            <Link href={`/${org}/ventes/${CHEMINS[d.type]}`} className="inline-flex items-center gap-1 text-[12.5px] text-encre-3 hover:text-encre">
              <Icone nom="chevron-gauche" taille={13} />
              {d.type === 'devis' ? 'Devis' : d.type === 'avoir' ? 'Avoirs' : 'Factures'}
            </Link>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-[20px] font-bold leading-tight sm:text-[22px]">
                {LIBELLES_TYPE[d.type].titre} <span className="num text-[19px] sm:text-[20px]">{d.number}</span>
              </h1>
              <Statut statut={statut.cle} libelle={statut.libelle} />
            </div>
            <p className="mt-0.5 text-[13px] text-encre-2">
              {imprimable.client?.name ?? '—'} · {formatDate(d.issue_date)} · {formatMontant(Number(d.total_ttc), d.currency)} TTC
            </p>
          </div>
        </div>
        <Parcours etapes={etapesParcours(d, jour)} />
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

          <section className="flex flex-col gap-2 rounded-l border border-trait bg-surface p-4" aria-labelledby="titre-fichiers">
            <h2 id="titre-fichiers" className="text-[14px] font-semibold">
              Fichiers
            </h2>
            <div className="flex flex-wrap gap-2">
              <a href={`${base}/pdf`} target="_blank" rel="noopener" className={classesBouton('secondaire', 's')}>
                Ouvrir le PDF
              </a>
              <a href={`${base}/pdf?telecharger`} className={classesBouton('fantome', 's')}>
                Télécharger
              </a>
              <BoutonImprimer />
            </div>
            {en16931 && (
              <>
                <p className={bloquantes.length ? 'text-[12.5px] text-attente' : 'text-[12.5px] text-ok'}>
                  {bloquantes.length
                    ? 'PDF simple : les données ne permettent pas un Factur-X conforme.'
                    : 'PDF/A-3 Factur-X, profil EN 16931 : le XML est joint au PDF.'}
                </p>
                {anomalies.length > 0 && (
                  <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[12px]">
                    {anomalies.map((a) => (
                      <li key={a.regle} className={a.bloquant ? 'text-alerte' : 'text-encre-3'}>
                        <span className="num text-[11px]">{a.regle}</span> · {a.message}
                      </li>
                    ))}
                  </ul>
                )}
                {!bloquantes.length && (
                  <p className="flex flex-wrap gap-3 text-[12.5px]">
                    <a href={`${base}/xml?format=cii`} className="text-accent hover:underline">
                      XML CII
                    </a>
                    <a href={`${base}/xml?format=ubl`} className="text-accent hover:underline">
                      XML UBL
                    </a>
                  </p>
                )}
              </>
            )}
          </section>

          {facture && d.status !== 'annule' && (
            <section className="flex flex-col gap-3 rounded-l border border-trait bg-surface p-4" aria-labelledby="titre-paiements">
              <div className="flex items-center justify-between gap-2">
                <h2 id="titre-paiements" className="text-[14px] font-semibold">
                  Paiements
                </h2>
                <span className="num text-[12.5px] text-encre-3">
                  {formatMontant(Number(d.amount_paid), d.currency)} / {formatMontant(Number(d.amount_due), d.currency)}
                </span>
              </div>
              {(paiements ?? []).length > 0 && (
                <ul className="m-0 flex list-none flex-col p-0">
                  {(paiements ?? []).map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 border-b border-trait py-1.5 text-[13px] last:border-b-0">
                      <span className="min-w-0">
                        <span className="num">{formatDate(p.paid_on)}</span> · {libelleMoyen(p.method)}
                        {p.reference && <span className="text-encre-3"> · {p.reference}</span>}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="num font-semibold">{formatMontant(Number(p.amount_cents), d.currency)}</span>
                        {editable && <BoutonSupprimerPaiement action={supprimerPaiement.bind(null, org, p.id)} />}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {reste === 0 && (paiements ?? []).length > 0 && (
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-ok">
                  <Icone nom="coche" taille={14} />
                  Soldée le {formatDate((paiements ?? []).at(-1)!.paid_on)}
                </p>
              )}
              {editable && reste > 0 && (
                <FormulaireSuivi action={enregistrerPaiement.bind(null, org, d.id)} bouton="Enregistrer le paiement" variante="secondaire">
                  <ChampsPaiement reste={centimesEnSaisie(reste)} jour={jour} />
                </FormulaireSuivi>
              )}
            </section>
          )}

          {signature && (
            <section className="flex flex-col gap-1 rounded-l border border-trait bg-surface p-4">
              <h2 className="text-[14px] font-semibold">{signature.decision === 'accepte' ? 'Accepté en ligne' : 'Refusé en ligne'}</h2>
              <p className="text-[13px] text-encre-2">
                Par {signature.signer_name}
                {signature.signer_email ? ` (${signature.signer_email})` : ''}, le {new Date(signature.signed_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
              {signature.comment && <p className="text-[13px] italic text-encre-2">« {signature.comment} »</p>}
              <p className="num text-[11px] text-encre-3" title={signature.content_hash}>
                Version signée {signature.content_hash.slice(0, 12)}…
              </p>
            </section>
          )}

          {d.type !== 'devis' && (editable || transmission) && (
            <section className="flex flex-col gap-3 rounded-l border border-trait bg-surface p-4" aria-labelledby="titre-pa">
              <div className="flex items-center justify-between gap-2">
                <h2 id="titre-pa" className="text-[14px] font-semibold">
                  Plateforme agréée
                </h2>
                {transmission && <StatutPa code={transmission.status_code} />}
              </div>
              {transmission ? (
                <>
                  <ol className="m-0 flex list-none flex-col gap-1.5 border-l border-trait p-0 pl-3">
                    {(transmission.history as Evenement[]).map((e, i) => (
                      <li key={i} className="text-[12.5px]">
                        <span className="font-medium">{e.libelle}</span>{' '}
                        <span className="num text-encre-3">{new Date(e.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                        {e.motif && <span className="block text-encre-2">« {e.motif} »</span>}
                      </li>
                    ))}
                  </ol>
                  <p className="num text-[11px] text-encre-3">
                    Flux {transmission.flow_id} · {transmission.provider === 'simulee' ? 'plateforme simulée' : 'API AFNOR'}
                  </p>
                  {editable && !STATUTS[transmission.status_code]?.final && (
                    <BoutonAction action={actualiser.bind(null, org, transmission.id)} variante="secondaire">
                      Actualiser le statut
                    </BoutonAction>
                  )}
                </>
              ) : (
                <>
                  <p className="text-[12.5px] text-encre-2">
                    {imprimable.client?.kind === 'b2b' || imprimable.client?.kind === 'b2g'
                      ? 'Client professionnel français : la facture électronique passe par votre plateforme agréée.'
                      : 'Client hors facturation électronique : la vente sera déclarée en e-reporting.'}
                  </p>
                  {bloquantes.length === 0 && (
                    <BoutonAction action={transmettre.bind(null, org, d.id)} variante="secondaire">
                      Transmettre via la plateforme
                    </BoutonAction>
                  )}
                </>
              )}
            </section>
          )}

          {editable && (
            <section className="flex flex-col gap-3 rounded-l border border-trait bg-surface p-4" aria-labelledby="titre-envoi">
              <h2 id="titre-envoi" className="text-[14px] font-semibold">
                Envoi au client
              </h2>
              <Partage slug={org} documentId={d.id} token={d.public_token} origine={origine} />
              <FormulaireSuivi action={envoyerParEmail.bind(null, org, d.id)} bouton={envois?.some((e) => e.kind === 'envoi') ? 'Renvoyer par email' : 'Envoyer par email'} variante="secondaire">
                <ChampsEnvoi destinataire={destinataire} />
              </FormulaireSuivi>
              {facture && ouverte && enRetard && (
                <BoutonAction action={relancer.bind(null, org, d.id)}>Relancer maintenant</BoutonAction>
              )}
              {(envois ?? []).length > 0 && (
                <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[12px] text-encre-3">
                  {(envois ?? []).map((e) => (
                    <li key={e.id}>
                      <span className="num">{new Date(e.sent_at).toLocaleDateString('fr-FR')}</span> · {e.kind === 'relance' ? 'Relance' : 'Envoi'} à {e.recipient}
                      {e.status === 'simule' && ' (simulé)'}
                      {e.status === 'echec' && <span className="text-alerte"> (échec)</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {editable && d.type === 'facture' && (
            <details className="rounded-l border border-trait bg-surface p-4">
              <summary className="cursor-pointer text-[14px] font-semibold">Rendre récurrente</summary>
              <FormulaireSuivi action={creerRecurrence.bind(null, org, d.id)} bouton="Créer la récurrence" variante="secondaire" className="mt-3">
                <ChampsRecurrence jour={jour} nom={d.subject ?? imprimable.client?.name ?? ''} />
              </FormulaireSuivi>
            </details>
          )}

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
