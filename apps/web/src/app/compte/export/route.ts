import { strToU8, zipSync } from 'fflate'
import { exigerUtilisateur, listerOrganisations } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

/** Export RGPD : toutes les données accessibles à l'utilisateur, en JSON, dans une archive ZIP. */
export async function GET() {
  const utilisateur = await exigerUtilisateur()
  const supabase = await creerClientServeur()
  const organisations = await listerOrganisations()
  const json = (v: unknown) => strToU8(JSON.stringify(v, null, 2))
  const { data: profil } = await supabase.from('profiles').select('*').eq('id', utilisateur.id).maybeSingle()
  const contenu: Record<string, Uint8Array> = {
    'LISEZMOI.txt': strToU8(
      [
        `Export des données de ${utilisateur.email}, ${new Date().toISOString()}.`,
        'Un dossier par entreprise : identité, clients, contacts, catalogue, documents (avec lignes et TVA), paiements, envois, récurrences.',
        'Les PDF Factur-X se téléchargent depuis Comptabilité · Exports comptables (archive complète).',
      ].join('\r\n'),
    ),
    'profil.json': json({ ...profil, email: utilisateur.email }),
    'entreprises.json': json(organisations),
  }
  const tables = ['clients', 'client_contacts', 'products', 'client_prices', 'documents', 'document_lines', 'document_vat_summary', 'payments', 'reminders', 'recurring_invoices', 'received_invoices', 'einvoice_transmissions', 'ereporting_reports'] as const
  for (const o of organisations) {
    const dossier = `${o.slug}/`
    const { data: org } = await supabase.from('organizations').select('*').eq('id', o.id).maybeSingle()
    contenu[`${dossier}entreprise.json`] = json(org)
    for (const t of tables) {
      const { data } = await supabase.from(t).select('*').eq('organization_id', o.id).limit(50_000)
      contenu[`${dossier}${t}.json`] = json(data ?? [])
    }
  }
  return new Response(Buffer.from(zipSync(contenu, { level: 6 })), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="pastille-export-${new Date().toISOString().slice(0, 10)}.zip"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
