'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { importerClients, type RapportImport } from '@/app/actions/clients'
import { Bouton } from '@/components/ui/Bouton'
import { Message } from '@/components/ui/Message'
import { Panneau, PanneauCorps, PanneauTete } from '@/components/ui/Panneau'
import { Tableau, Td, Th } from '@/components/ui/Tableau'
import { associerColonnes, lireCsv, type TableauCsv } from '@/lib/csv'

const CHAMPS: Array<{ cle: string; libelle: string; synonymes: string[] }> = [
  { cle: 'name', libelle: 'Nom ou raison sociale', synonymes: ['nom', 'raison sociale', 'client', 'societe', 'entreprise', 'name', 'company'] },
  { cle: 'kind', libelle: 'Catégorie (b2b, b2c, b2g, ue, hors_ue)', synonymes: ['categorie', 'type', 'kind'] },
  { cle: 'siren', libelle: 'SIREN', synonymes: ['siren', 'n siren', 'numero siren'] },
  { cle: 'siret', libelle: 'SIRET', synonymes: ['siret'] },
  { cle: 'vat_number', libelle: 'N° de TVA', synonymes: ['tva', 'n tva', 'numero tva', 'tva intracommunautaire', 'vat', 'vat number'] },
  { cle: 'billing_line1', libelle: 'Adresse', synonymes: ['adresse', 'adresse 1', 'rue', 'address'] },
  { cle: 'billing_postal_code', libelle: 'Code postal', synonymes: ['code postal', 'cp', 'postal code', 'zip'] },
  { cle: 'billing_city', libelle: 'Ville', synonymes: ['ville', 'commune', 'city'] },
  { cle: 'billing_country', libelle: 'Pays (code ISO)', synonymes: ['pays', 'country'] },
  { cle: 'email', libelle: 'Email de facturation', synonymes: ['email', 'e-mail', 'mail', 'courriel'] },
  { cle: 'notes', libelle: 'Notes', synonymes: ['notes', 'commentaire', 'remarques'] },
]

export function ImportClients({ slug }: { slug: string }) {
  const [fichier, setFichier] = useState<string>()
  const [tableau, setTableau] = useState<TableauCsv>()
  const [colonnes, setColonnes] = useState<Record<string, number | null>>({})
  const [rapport, setRapport] = useState<RapportImport>()
  const [enCours, demarrer] = useTransition()

  async function charger(f: File | undefined) {
    if (!f) return
    setRapport(undefined)
    const t = lireCsv(await f.text())
    setFichier(f.name)
    setTableau(t)
    setColonnes(associerColonnes(t.entetes, Object.fromEntries(CHAMPS.map((c) => [c.cle, c.synonymes]))))
  }

  const lignes =
    tableau?.lignes.map((l) =>
      Object.fromEntries(CHAMPS.flatMap((c) => (colonnes[c.cle] == null ? [] : [[c.cle, l[colonnes[c.cle]!] ?? '']]))),
    ) ?? []

  return (
    <div className="flex flex-col gap-[18px]">
      <Panneau>
        <PanneauTete titre="1. Choisir le fichier" description="CSV exporté depuis Excel, Google Sheets ou votre ancien logiciel. Séparateur détecté automatiquement." />
        <PanneauCorps>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-l border border-dashed border-trait-fort px-6 py-8 text-center hover:border-accent">
            <span className="font-medium">{fichier ?? 'Glissez un fichier ici ou cliquez pour le choisir'}</span>
            <span className="text-[12.5px] text-encre-3">
              {tableau ? `${tableau.lignes.length} lignes · séparateur « ${tableau.separateur === '\t' ? 'tabulation' : tableau.separateur} »` : 'Format .csv, 2 000 lignes maximum'}
            </span>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => charger(e.target.files?.[0])} />
          </label>
        </PanneauCorps>
      </Panneau>

      {tableau && (
        <Panneau>
          <PanneauTete titre="2. Associer les colonnes" description="Les colonnes reconnues sont pré-associées. Une catégorie absente est déduite : SIREN → entreprise France, sinon particulier." />
          <PanneauCorps>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CHAMPS.map((c) => (
                <label key={c.cle} className="flex flex-col gap-1.5 text-[13px] font-medium">
                  {c.libelle}
                  <select
                    value={colonnes[c.cle] ?? ''}
                    onChange={(e) => setColonnes((col) => ({ ...col, [c.cle]: e.target.value === '' ? null : Number(e.target.value) }))}
                    className="h-[38px] rounded-m border border-trait-fort bg-surface px-2.5 text-[14px] font-normal"
                  >
                    <option value="">Ne pas importer</option>
                    {tableau.entetes.map((e, i) => (
                      <option key={`${e}-${i}`} value={i}>
                        {e || `Colonne ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </PanneauCorps>
        </Panneau>
      )}

      {tableau && colonnes.name != null && (
        <Panneau>
          <PanneauTete titre="3. Vérifier et importer" description={`Aperçu des ${Math.min(5, lignes.length)} premières lignes sur ${lignes.length}.`} />
          <div className="[&>div]:rounded-none [&>div]:border-0">
            <Tableau legende="Aperçu de l’import" largeurMin={640}>
              <thead>
                <tr>
                  {CHAMPS.filter((c) => colonnes[c.cle] != null).map((c) => (
                    <Th key={c.cle}>{c.libelle}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lignes.slice(0, 5).map((l, i) => (
                  <tr key={i}>
                    {CHAMPS.filter((c) => colonnes[c.cle] != null).map((c) => (
                      <Td key={c.cle}>{l[c.cle] || <span className="text-encre-3">—</span>}</Td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Tableau>
          </div>
          <PanneauCorps>
            {rapport && (
              <Message ton={rapport.erreurs.length ? 'info' : 'succes'}>
                {rapport.importes} client{rapport.importes > 1 ? 's' : ''} importé{rapport.importes > 1 ? 's' : ''}.
                {rapport.erreurs.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-[12.5px]">
                    {rapport.erreurs.slice(0, 20).map((e) => (
                      <li key={`${e.ligne}-${e.message}`}>
                        {e.ligne ? `Ligne ${e.ligne} : ` : ''}
                        {e.message}
                      </li>
                    ))}
                    {rapport.erreurs.length > 20 && <li>… et {rapport.erreurs.length - 20} autres lignes ignorées.</li>}
                  </ul>
                )}
              </Message>
            )}
            <div className="flex flex-wrap gap-2">
              <Bouton
                variante="primaire"
                chargement={enCours}
                disabled={lignes.length === 0}
                onClick={() => demarrer(async () => setRapport(await importerClients(slug, lignes)))}
              >
                Importer {lignes.length} client{lignes.length > 1 ? 's' : ''}
              </Bouton>
              {rapport && rapport.importes > 0 && (
                <Link href={`/${slug}/clients`} className="inline-flex h-[34px] items-center px-3 text-[13.5px] font-semibold text-accent">
                  Voir les clients
                </Link>
              )}
            </div>
          </PanneauCorps>
        </Panneau>
      )}
    </div>
  )
}
