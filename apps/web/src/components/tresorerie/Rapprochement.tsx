'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { rapprocher, type BilanRapprochement } from '@/app/actions/rapprochement'
import { Bouton } from '@/components/ui/Bouton'
import { Message } from '@/components/ui/Message'
import { Panneau, PanneauCorps, PanneauTete } from '@/components/ui/Panneau'
import { Tableau, Td, Th } from '@/components/ui/Tableau'
import { cn } from '@/lib/cn'
import { formatDate, formatMontant } from '@/lib/format'
import { lireReleve, proposer, type FactureOuverte, type LigneReleve } from '@/lib/rapprochement'

interface Facture extends FactureOuverte {
  echeance: string | null
}

/** Décode le fichier en UTF-8, ou en Windows-1252 (exports Excel et de nombreuses banques). */
async function lireTexte(f: File): Promise<string> {
  const octets = await f.arrayBuffer()
  const utf8 = new TextDecoder('utf-8').decode(octets)
  return utf8.includes('�') ? new TextDecoder('windows-1252').decode(octets) : utf8
}

export function Rapprochement({ slug, factures, dejaImportes }: { slug: string; factures: Facture[]; dejaImportes: string[] }) {
  const [fichier, setFichier] = useState<string>()
  const [lignes, setLignes] = useState<LigneReleve[]>()
  const [infos, setInfos] = useState<{ debits: number; ignorees: number }>()
  const [erreur, setErreur] = useState<string>()
  const [choix, setChoix] = useState<Record<number, string>>({})
  const [bilan, setBilan] = useState<BilanRapprochement>()
  const [enCours, demarrer] = useTransition()

  const propositions = useMemo(() => (lignes ? proposer(lignes, factures, new Set(dejaImportes)) : []), [lignes, factures, dejaImportes])
  const parId = useMemo(() => new Map(factures.map((f) => [f.id, f])), [factures])

  async function charger(f: File | undefined) {
    if (!f) return
    setBilan(undefined)
    setFichier(f.name)
    const r = lireReleve(await lireTexte(f))
    if ('erreur' in r) {
      setErreur(r.erreur)
      setLignes(undefined)
      return
    }
    setErreur(undefined)
    setLignes(r.lignes)
    setInfos({ debits: r.lignes.filter((l) => l.montant <= 0).length, ignorees: r.ignorees })
    const initial: Record<number, string> = {}
    for (const p of proposer(r.lignes, factures, new Set(dejaImportes))) if (p.factureId) initial[p.ligne.index] = p.factureId
    setChoix(initial)
  }

  const retenues = propositions.filter((p) => !p.dejaRapproche && choix[p.ligne.index])
  const total = retenues.reduce((s, p) => s + p.ligne.montant, 0)

  function enregistrer() {
    demarrer(async () => {
      const r = await rapprocher(
        slug,
        retenues.map((p) => ({ documentId: choix[p.ligne.index]!, montant: p.ligne.montant, date: p.ligne.date, libelle: p.ligne.libelle })),
      )
      setBilan(r)
      if (r.ok) {
        setLignes(undefined)
        setFichier(undefined)
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {bilan && !bilan.ok && <Message ton="erreur">{bilan.erreur}</Message>}
      {bilan?.ok && (
        <Message ton="succes">
          {bilan.enregistres} paiement{bilan.enregistres > 1 ? 's' : ''} enregistré{bilan.enregistres > 1 ? 's' : ''}.{' '}
          <Link href={`/${slug}/tresorerie/paiements`} className="underline">
            Voir les paiements
          </Link>
          {bilan.ignores.length > 0 && (
            <ul className="mt-1.5 list-disc pl-5 text-encre-2">
              {bilan.ignores.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
        </Message>
      )}

      <Panneau>
        <PanneauTete titre="1. Relevé bancaire" description="Dans l’espace client de votre banque, exportez les opérations au format CSV (ou Excel enregistré en CSV)." />
        <PanneauCorps>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-l border border-dashed border-trait-fort px-6 py-8 text-center hover:border-accent">
            <span className="font-medium">{fichier ?? 'Glissez le relevé ici ou cliquez pour le choisir'}</span>
            <span className="text-[12.5px] text-encre-3">
              {lignes && infos
                ? `${propositions.length} crédit${propositions.length > 1 ? 's' : ''} · ${infos.debits} débit${infos.debits > 1 ? 's' : ''} ignoré${infos.debits > 1 ? 's' : ''}${infos.ignorees ? ` · ${infos.ignorees} ligne${infos.ignorees > 1 ? 's' : ''} illisible${infos.ignorees > 1 ? 's' : ''}` : ''}`
                : 'Colonnes reconnues : date, libellé, montant ou crédit et débit'}
            </span>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => {
                charger(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
          {erreur && <Message ton="erreur">{erreur}</Message>}
          {factures.length === 0 && <Message ton="info">Aucune facture n’attend de paiement : il n’y a rien à rapprocher pour l’instant.</Message>}
        </PanneauCorps>
      </Panneau>

      {lignes && propositions.length > 0 && (
        <Panneau>
          <PanneauTete titre="2. Vérifier les associations" description="Les propositions sûres sont pré-cochées. Corrigez la facture si besoin, ou laissez « Ne pas rapprocher »." />
          <Tableau legende="Crédits du relevé et factures proposées" largeurMin={760}>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Libellé</Th>
                <Th numerique>Montant</Th>
                <Th>Facture</Th>
              </tr>
            </thead>
            <tbody>
              {propositions.map((p) => {
                const choisie = choix[p.ligne.index]
                const f = choisie ? parId.get(choisie) : undefined
                return (
                  <tr key={p.ligne.index} className={cn(p.dejaRapproche && 'opacity-60')}>
                    <Td className="num whitespace-nowrap text-encre-3">{formatDate(p.ligne.date)}</Td>
                    <Td className="max-w-[34ch]">
                      <span className="line-clamp-2 text-[13px]">{p.ligne.libelle || '—'}</span>
                    </Td>
                    <Td numerique className="font-semibold">
                      {formatMontant(p.ligne.montant)}
                    </Td>
                    <Td>
                      {p.dejaRapproche ? (
                        <span className="text-[12.5px] text-encre-3">{p.raison}</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <select
                            aria-label={`Facture réglée par le virement du ${formatDate(p.ligne.date)} de ${formatMontant(p.ligne.montant)}`}
                            value={choisie ?? ''}
                            onChange={(e) => setChoix((c) => ({ ...c, [p.ligne.index]: e.target.value }))}
                            className="h-8 w-full max-w-[380px] rounded-m border border-trait-fort bg-surface px-2 text-[13px]"
                          >
                            <option value="">Ne pas rapprocher</option>
                            {factures.map((x) => (
                              <option key={x.id} value={x.id} disabled={x.reste < p.ligne.montant}>
                                {x.numero} · {x.client ?? '—'} · reste {formatMontant(x.reste)}
                              </option>
                            ))}
                          </select>
                          <span className={cn('text-[12px]', p.confiance === 'forte' && choisie === p.factureId ? 'text-ok' : 'text-encre-3')}>
                            {choisie && choisie !== p.factureId
                              ? f && f.reste !== p.ligne.montant
                                ? 'Choix manuel · paiement partiel'
                                : 'Choix manuel'
                              : p.raison}
                          </span>
                        </div>
                      )}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Tableau>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-trait px-[18px] py-3">
            <span className="text-[13px] text-encre-2">
              {retenues.length} paiement{retenues.length > 1 ? 's' : ''} · <span className="num font-semibold">{formatMontant(total)}</span>
            </span>
            <Bouton variante="primaire" onClick={enregistrer} chargement={enCours} disabled={retenues.length === 0}>
              Enregistrer les paiements
            </Bouton>
          </div>
        </Panneau>
      )}
    </div>
  )
}
