import Link from 'next/link'
import { Icone } from '@/components/ui/Icone'
import { Statut } from '@/components/ui/Statut'
import { aujourdHui, calculer, LIBELLES_TYPE, statutAffiche, type DocumentEdition } from '@/lib/document'
import type { DonneesEditeur } from '@/lib/editeur'
import { formatDate, formatMontant } from '@/lib/format'
import type { Role } from '@/lib/roles'
import type { DocumentRow } from '@/lib/supabase/types'

const CHEMINS = { facture: 'factures', acompte: 'factures', devis: 'devis', avoir: 'avoirs' } as const

/** Document émis : consultation seule (le contenu est figé). */
export function ApercuLecture({ org, document: d, edition, donnees }: { org: string; document: DocumentRow; edition: DocumentEdition; donnees: DonneesEditeur; role: Role }) {
  const statut = statutAffiche(d, aujourdHui())
  const calcul = calculer(edition)
  const client = donnees.clients.find((c) => c.id === d.client_id)
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href={`/${org}/ventes/${CHEMINS[d.type]}`} className="inline-flex items-center gap-1 text-[12.5px] text-encre-3 hover:text-encre">
          <Icone nom="chevron-gauche" taille={13} />
          {LIBELLES_TYPE[d.type].titre}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-[24px] font-bold leading-tight">
            {LIBELLES_TYPE[d.type].titre} <span className="num text-[22px]">{d.number}</span>
          </h1>
          <Statut statut={statut.cle} libelle={statut.libelle} />
        </div>
        <p className="mt-1 text-[13.5px] text-encre-2">
          {client?.name ?? '—'} · émise le {formatDate(d.issue_date)} · {formatMontant(Number(d.total_ttc), d.currency)} TTC
        </p>
      </div>
      <ol className="m-0 flex list-none flex-col rounded-l border border-trait bg-surface p-0">
        {edition.lignes.map((l, i) => (
          <li key={l.cle} className="flex justify-between gap-3 border-b border-trait px-4 py-2.5 text-[13.5px] last:border-b-0">
            <span>{l.designation}</span>
            <span className="num">{calcul.ok ? formatMontant(calcul.totaux.lignes[i]?.montantNet ?? 0, d.currency) : '—'}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
