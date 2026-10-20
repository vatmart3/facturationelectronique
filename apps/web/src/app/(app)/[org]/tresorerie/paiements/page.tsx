import type { Metadata } from 'next'
import Link from 'next/link'
import { BoutonLien } from '@/components/ui/Bouton'
import { EnTeteVue } from '@/components/ui/EnTeteVue'
import { EtatVide } from '@/components/ui/EtatVide'
import { Indicateurs } from '@/components/ui/Indicateurs'
import { Segments } from '@/components/ui/Segments'
import { Tableau, Td, Th } from '@/components/ui/Tableau'
import { aujourdHui } from '@/lib/document'
import { formatDate, formatMontant } from '@/lib/format'
import { chargerContexte } from '@/lib/session'
import { libelleMoyen } from '@/lib/suivi'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Paiements' }

export default async function Paiements({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ mois?: string }> }) {
  const { org } = await params
  const { mois: demande } = await searchParams
  const { organisation } = await chargerContexte(org)
  const jour = aujourdHui()
  const mois = demande && /^\d{4}-\d{2}$/.test(demande) ? demande : jour.slice(0, 7)
  const [a, m] = mois.split('-').map(Number) as [number, number]
  const debut = `${mois}-01`
  const fin = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10)
  const supabase = await creerClientServeur()
  const [{ data: paiements }, { data: ouvertes }] = await Promise.all([
    supabase
      .from('payments')
      .select('*, documents(id, number, currency, clients(name))')
      .eq('organization_id', organisation.id)
      .gte('paid_on', debut)
      .lte('paid_on', fin)
      .order('paid_on', { ascending: false }),
    supabase.from('documents').select('amount_due, amount_paid, due_date').eq('organization_id', organisation.id).in('status', ['emis', 'envoye', 'partiellement_paye']).neq('type', 'avoir'),
  ])
  const total = (paiements ?? []).reduce((s, p) => s + Number(p.amount_cents), 0)
  const aEncaisser = (ouvertes ?? []).reduce((s, d) => s + Number(d.amount_due) - Number(d.amount_paid), 0)
  const enRetard = (ouvertes ?? []).filter((d) => d.due_date && d.due_date < jour).reduce((s, d) => s + Number(d.amount_due) - Number(d.amount_paid), 0)
  const moisListe = Array.from({ length: 6 }, (_, i) => new Date(Date.UTC(Number(jour.slice(0, 4)), Number(jour.slice(5, 7)) - 1 - i, 1)).toISOString().slice(0, 7))
  const libelle = (x: string) => new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${x}-01T00:00:00Z`))

  return (
    <>
      <EnTeteVue
        titre="Paiements"
        description="Encaissements enregistrés sur les factures, depuis la facture ou par import du relevé bancaire."
        actions={
          <BoutonLien href={`/${org}/tresorerie/rapprochement`} icone="banque">
            Importer un relevé
          </BoutonLien>
        }
      />
      <Indicateurs
        indicateurs={[
          { libelle: `Encaissé · ${libelle(mois)}`, valeur: formatMontant(total), detail: `${(paiements ?? []).length} paiement(s)`, ton: 'ok' },
          { libelle: 'Reste à encaisser', valeur: formatMontant(aEncaisser), detail: `${(ouvertes ?? []).length} facture(s) ouverte(s)`, ton: 'info' },
          { libelle: 'Dont en retard', valeur: formatMontant(enRetard), ton: 'alerte' },
          { libelle: 'Moyen principal', valeur: (paiements ?? []).length ? libelleMoyen(principal(paiements ?? [])) : '—' },
        ]}
      />
      <Segments libelle="Mois" segments={moisListe.map((x) => ({ href: `/${org}/tresorerie/paiements?mois=${x}`, libelle: libelle(x), actif: x === mois }))} />
      {(paiements ?? []).length === 0 ? (
        <EtatVide titre="Aucun paiement ce mois-ci" />
      ) : (
        <Tableau legende="Paiements du mois">
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Facture</Th>
              <Th>Client</Th>
              <Th>Moyen</Th>
              <Th>Référence</Th>
              <Th numerique>Montant</Th>
            </tr>
          </thead>
          <tbody>
            {(paiements ?? []).map((p) => (
              <tr key={p.id}>
                <Td className="num text-encre-3">{formatDate(p.paid_on)}</Td>
                <Td>
                  <Link href={`/${org}/ventes/factures/${p.document_id}`} className="num font-semibold hover:underline">
                    {p.documents?.number}
                  </Link>
                </Td>
                <Td className="text-encre-2">{p.documents?.clients?.name}</Td>
                <Td className="text-encre-2">{libelleMoyen(p.method)}</Td>
                <Td className="text-encre-3">{p.reference ?? '—'}</Td>
                <Td numerique className="font-semibold">
                  {formatMontant(Number(p.amount_cents), p.documents?.currency ?? 'EUR')}
                </Td>
              </tr>
            ))}
          </tbody>
        </Tableau>
      )}
    </>
  )
}

function principal(paiements: ReadonlyArray<{ method: Parameters<typeof libelleMoyen>[0]; amount_cents: number }>) {
  const totaux = new Map<Parameters<typeof libelleMoyen>[0], number>()
  for (const p of paiements) totaux.set(p.method, (totaux.get(p.method) ?? 0) + Number(p.amount_cents))
  return [...totaux.entries()].sort((a, b) => b[1] - a[1])[0]![0]
}
