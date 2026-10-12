import { pdfTexte } from '@/lib/pdf'
import { texte } from '@/lib/legal'

/** DPA au format PDF, généré depuis le même texte que la page. */
export async function GET() {
  const t = texte('dpa')!
  const octets = await pdfTexte(t.titre, `Mise à jour : ${t.maj}`, t.sections)
  return new Response(Buffer.from(octets), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="pastille-dpa.pdf"', 'Cache-Control': 'public, max-age=3600' },
  })
}
