import { chargerLogo, nomFichier } from '@/lib/documents-serveur'
import { genererPdf } from '@/lib/pdf'
import { chargerPublic } from '@/lib/public'

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const p = await chargerPublic(token)
  if (!p) return new Response('Document introuvable.', { status: 404 })
  const pdf = await genererPdf(p.imprimable, { logo: await chargerLogo(p.imprimable.vendeur.logo_path) })
  return new Response(Buffer.from(pdf.octets), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nomFichier(p.imprimable, 'pdf'))}`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  })
}
