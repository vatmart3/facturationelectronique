import { NextResponse, type NextRequest } from 'next/server'
import { normaliserRecherche, urlRecherche } from '@/lib/entreprises'
import { lireUtilisateur } from '@/lib/session'

/** Recherche d'entreprises (nom ou SIREN) pour pré-remplir une fiche. Réservé aux utilisateurs connectés. */
export async function GET(request: NextRequest) {
  if (!(await lireUtilisateur())) return NextResponse.json({ erreur: 'Connexion requise.' }, { status: 401 })
  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.replace(/\s/g, '').length < 3) return NextResponse.json({ resultats: [] })

  try {
    const reponse = await fetch(urlRecherche(q.slice(0, 120)), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 86_400 },
    })
    if (!reponse.ok) {
      return NextResponse.json({ resultats: [], erreur: 'Le service de recherche est momentanément indisponible.' }, { status: 502 })
    }
    return NextResponse.json({ resultats: normaliserRecherche(await reponse.json()) })
  } catch {
    return NextResponse.json({ resultats: [], erreur: 'Le service de recherche ne répond pas. Saisissez les informations à la main.' }, { status: 504 })
  }
}
