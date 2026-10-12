import { chargerImprimable, chargerLogo, nomFichier } from '@/lib/documents-serveur'
import { genererPdf } from '@/lib/pdf'

/** PDF d'un document : Factur-X (PDF/A-3 + XML CII) pour une facture ou un avoir émis. */
export async function GET(requete: Request, { params }: { params: Promise<{ org: string; id: string }> }) {
  const { org, id } = await params
  const r = await chargerImprimable(org, id)
  if (!r) return new Response('Document introuvable ou incalculable.', { status: 404 })
  const pdf = await genererPdf(r.imprimable, { logo: await chargerLogo(r.imprimable.vendeur.logo_path) })
  const telechargement = new URL(requete.url).searchParams.has('telecharger')
  return new Response(Buffer.from(pdf.octets), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${telechargement ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(nomFichier(r.imprimable, 'pdf'))}`,
      'Cache-Control': 'private, no-store',
      'X-Factur-X': pdf.facturx ? 'EN16931' : 'non',
    },
  })
}
