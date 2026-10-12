import { STATUTS } from '@/lib/pa/cycle'
import { Statut } from '@/components/ui/Statut'

const CLES = { neutre: 'annulee', info: 'envoyee', ok: 'payee', attente: 'brouillon', alerte: 'retard' } as const

/** Statut du cycle de vie d'une facture électronique. */
export function StatutPa({ code }: { code: number }) {
  const s = STATUTS[code]
  return <Statut statut={CLES[s?.ton ?? 'neutre']} libelle={s?.libelle ?? `Statut ${code}`} />
}
