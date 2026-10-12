import type { Metadata } from 'next'
import { classesBouton } from '@/components/ui/Bouton'
import { EnTeteVue } from '@/components/ui/EnTeteVue'
import { Panneau, PanneauCorps, PanneauTete } from '@/components/ui/Panneau'
import { Segments } from '@/components/ui/Segments'
import { aujourdHui } from '@/lib/document'
import { ecritures, equilibre } from '@/lib/exports'
import { documentsExport } from '@/lib/exports-serveur'
import { formatDate, formatMontant } from '@/lib/format'
import { chargerContexte } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Exports comptables' }

type Periode = { cle: string; libelle: string; du: string; au: string }

function periodes(jour: string): Periode[] {
  const [a, m] = jour.split('-').map(Number) as [number, number]
  const fin = (an: number, mois: number) => new Date(Date.UTC(an, mois, 0)).toISOString().slice(0, 10)
  const t = Math.ceil(m / 3)
  const tp = t === 1 ? { an: a - 1, t: 4 } : { an: a, t: t - 1 }
  const mp = m === 1 ? { an: a - 1, m: 12 } : { an: a, m: m - 1 }
  const nomMois = (an: number, mois: number) => new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(an, mois - 1, 1)))
  return [
    { cle: 'mois', libelle: nomMois(a, m), du: `${a}-${String(m).padStart(2, '0')}-01`, au: fin(a, m) },
    { cle: 'mois-precedent', libelle: nomMois(mp.an, mp.m), du: `${mp.an}-${String(mp.m).padStart(2, '0')}-01`, au: fin(mp.an, mp.m) },
    { cle: 'trimestre', libelle: `T${t} ${a}`, du: `${a}-${String(t * 3 - 2).padStart(2, '0')}-01`, au: fin(a, t * 3) },
    { cle: 'trimestre-precedent', libelle: `T${tp.t} ${tp.an}`, du: `${tp.an}-${String(tp.t * 3 - 2).padStart(2, '0')}-01`, au: fin(tp.an, tp.t * 3) },
    { cle: 'annee', libelle: String(a), du: `${a}-01-01`, au: `${a}-12-31` },
    { cle: 'annee-precedente', libelle: String(a - 1), du: `${a - 1}-01-01`, au: `${a - 1}-12-31` },
  ]
}

export default async function Exports({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ periode?: string }> }) {
  const { org } = await params
  const { periode } = await searchParams
  const { organisation } = await chargerContexte(org)
  const liste = periodes(aujourdHui())
  const p = liste.find((x) => x.cle === periode) ?? liste[0]!
  const docs = await documentsExport(await creerClientServeur(), organisation.id, p.du, p.au)
  const e = ecritures(docs)
  const ht = docs.reduce((s, d) => s + d.total_ht, 0)
  const tva = docs.reduce((s, d) => s + d.tva.reduce((x, t) => x + t.montant, 0), 0)
  const lien = (type: string) => `/${org}/exports?type=${type}&du=${p.du}&au=${p.au}`

  const fichiers = [
    { type: 'fec', titre: 'Fichier des écritures comptables (FEC)', detail: 'Format officiel, 18 colonnes, accepté par l’administration et les logiciels comptables.' },
    { type: 'journal', titre: 'Journal des ventes', detail: 'Écritures de ventes au format tableur (CSV, Excel).' },
    { type: 'tva', titre: 'État de TVA collectée', detail: 'Base et TVA par mois et par taux, pour préparer la déclaration.' },
    { type: 'archive', titre: 'Archive complète', detail: 'ZIP : PDF Factur-X et XML de chaque document, FEC, journal, état de TVA et empreintes.' },
  ]

  return (
    <>
      <EnTeteVue titre="Exports comptables" description="Pour votre expert-comptable : écritures de ventes, TVA collectée et archive des factures." />
      <Segments libelle="Période" segments={liste.map((x) => ({ href: `/${org}/comptabilite/exports?periode=${x.cle}`, libelle: x.libelle, actif: x.cle === p.cle }))} />
      <p className="text-[13.5px] text-encre-2">
        Du {formatDate(p.du)} au {formatDate(p.au)} · {docs.length} document{docs.length > 1 ? 's' : ''} émis · {formatMontant(ht)} HT · {formatMontant(tva)} de TVA ·{' '}
        {e.length} écritures {equilibre(e) ? 'équilibrées' : 'déséquilibrées'}
      </p>
      <div className="grid gap-[18px] md:grid-cols-2">
        {fichiers.map((f) => (
          <Panneau key={f.type}>
            <PanneauTete titre={f.titre} />
            <PanneauCorps>
              <p className="text-[13.5px] text-encre-2">{f.detail}</p>
              <a href={lien(f.type)} className={`${classesBouton(f.type === 'archive' ? 'primaire' : 'secondaire')} self-start ${docs.length === 0 ? 'pointer-events-none opacity-50' : ''}`} aria-disabled={docs.length === 0}>
                Télécharger
              </a>
            </PanneauCorps>
          </Panneau>
        ))}
      </div>
      <p className="text-[12.5px] text-encre-3">
        Comptes utilisés : 411000 clients (compte auxiliaire par client), 706000 prestations, 707000 marchandises, 467000 débours, 419100 acomptes, 44571x TVA
        collectée par taux. Un compte propre à un article (catalogue) remplace le compte de produit par défaut.
      </p>
    </>
  )
}
