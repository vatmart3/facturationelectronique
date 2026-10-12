import { controler, genererCii, genererUbl } from '@pastille/facturx'
import { chargerImprimable, nomFichier } from '@/lib/documents-serveur'
import { versEn16931 } from '@/lib/en16931'

/** XML EN 16931 d'un document émis : ?format=cii (Factur-X / CII D16B) ou ?format=ubl (UBL 2.1). */
export async function GET(requete: Request, { params }: { params: Promise<{ org: string; id: string }> }) {
  const { org, id } = await params
  const format = new URL(requete.url).searchParams.get('format') === 'ubl' ? 'ubl' : 'cii'
  const r = await chargerImprimable(org, id)
  const facture = r ? versEn16931(r.imprimable) : null
  if (!r || !facture) return new Response('Seules les factures et avoirs émis ont un format électronique.', { status: 404 })
  const bloquantes = controler(facture).filter((a) => a.bloquant)
  if (bloquantes.length) {
    return Response.json({ erreur: 'Données non conformes à la norme EN 16931.', anomalies: bloquantes }, { status: 422 })
  }
  const xml = format === 'ubl' ? genererUbl(facture) : genererCii(facture)
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nomFichier(r.imprimable, `${format}.xml`))}`,
      'Cache-Control': 'private, no-store',
    },
  })
}
