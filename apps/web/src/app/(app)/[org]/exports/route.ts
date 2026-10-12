import { genererCii } from '@pastille/facturx'
import { strToU8, zipSync } from 'fflate'
import { imprimableDepuis, lireDocument, chargerLogo, nomFichier } from '@/lib/documents-serveur'
import { versEn16931 } from '@/lib/en16931'
import { ecritures, etatTvaCsv, fec, journalCsv } from '@/lib/exports'
import { documentsExport } from '@/lib/exports-serveur'
import { genererPdf } from '@/lib/pdf'
import { chargerContexte } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** Exports comptables d'une période : ?type=fec|journal|tva|archive&du=AAAA-MM-JJ&au=AAAA-MM-JJ */
export async function GET(requete: Request, { params }: { params: Promise<{ org: string }> }) {
  const { org } = await params
  const { organisation } = await chargerContexte(org)
  const q = new URL(requete.url).searchParams
  const type = q.get('type') ?? 'fec'
  const du = q.get('du') ?? ''
  const au = q.get('au') ?? ''
  if (!DATE.test(du) || !DATE.test(au) || au < du) return new Response('Période invalide.', { status: 400 })
  const supabase = await creerClientServeur()
  const docs = await documentsExport(supabase, organisation.id, du, au)
  const e = ecritures(docs)
  const suffixe = `${du.replace(/-/g, '')}-${au.replace(/-/g, '')}`
  const fichier = (nom: string, contenu: string | Uint8Array, typeMime: string) =>
    new Response(typeof contenu === 'string' ? contenu : Buffer.from(contenu), {
      headers: { 'Content-Type': typeMime, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nom)}`, 'Cache-Control': 'private, no-store' },
    })
  const nomFec = `${organisation.siren ?? 'SIREN'}FEC${au.replace(/-/g, '')}.txt`

  if (type === 'fec') return fichier(nomFec, fec(e), 'text/plain; charset=utf-8')
  if (type === 'journal') return fichier(`journal-ventes-${suffixe}.csv`, journalCsv(e), 'text/csv; charset=utf-8')
  if (type === 'tva') return fichier(`etat-tva-${suffixe}.csv`, etatTvaCsv(docs), 'text/csv; charset=utf-8')
  if (type !== 'archive') return new Response('Type d’export inconnu.', { status: 400 })

  if (docs.length > 300) return new Response('Plus de 300 documents : réduisez la période de l’archive.', { status: 413 })
  const contenu: Record<string, Uint8Array> = {
    [nomFec]: strToU8(fec(e)),
    [`journal-ventes-${suffixe}.csv`]: strToU8(journalCsv(e)),
    [`etat-tva-${suffixe}.csv`]: strToU8(etatTvaCsv(docs)),
  }
  const logo = await chargerLogo(organisation.logo_path)
  const empreintes: string[] = ['Document;Empreinte SHA-256']
  for (const d of docs) {
    const charge = await lireDocument(supabase, organisation, d.id)
    const imprimable = charge ? await imprimableDepuis(supabase, organisation, charge) : null
    if (!imprimable) continue
    const pdf = await genererPdf(imprimable, { logo })
    contenu[`documents/${nomFichier(imprimable, 'pdf')}`] = pdf.octets
    const facture = versEn16931(imprimable)
    if (facture) contenu[`documents/${nomFichier(imprimable, 'xml')}`] = strToU8(genererCii(facture))
    empreintes.push(`${d.number};${d.content_hash ?? ''}`)
  }
  contenu['empreintes.csv'] = strToU8(empreintes.join('\r\n') + '\r\n')
  return fichier(`archive-${organisation.slug}-${suffixe}.zip`, zipSync(contenu, { level: 6 }), 'application/zip')
}
