import { ErreurPlateforme, type FluxRecu, type FormatFlux, type Plateforme } from './types'

/**
 * Connecteur générique d'une plateforme agréée exposant l'API normalisée AFNOR XP Z12-013
 * (« Flow Service » et « Directory Service »). Chaque plateforme publie son adresse et ses
 * modalités d'authentification : PA_API_URL et PA_API_TOKEN (jeton OAuth2 déjà obtenu).
 * Les chemins suivent la norme ; un écart propre à une plateforme s'ajuste ici, en un seul endroit.
 */

const SYNTAXES: Record<FormatFlux, string> = { 'factur-x': 'Factur-X', cii: 'CII', ubl: 'UBL' }

export function plateformeAfnor(base = process.env.PA_API_URL, jeton = process.env.PA_API_TOKEN, appel: typeof fetch = fetch): Plateforme {
  if (!base || !jeton) throw new ErreurPlateforme('Plateforme non configurée : PA_API_URL et PA_API_TOKEN sont requis.')
  const racine = base.replace(/\/$/, '')

  async function requete<T>(chemin: string, init: RequestInit = {}): Promise<T> {
    const r = await appel(`${racine}${chemin}`, {
      ...init,
      headers: { Authorization: `Bearer ${jeton}`, Accept: 'application/json', ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(20_000),
    })
    if (!r.ok) throw new ErreurPlateforme(`Plateforme : erreur ${r.status} sur ${chemin}`)
    const type = r.headers.get('content-type') ?? ''
    return (type.includes('json') ? await r.json() : new Uint8Array(await r.arrayBuffer())) as T
  }

  return {
    code: 'afnor',
    nom: 'Plateforme agréée (API AFNOR)',
    async transmettre(depot) {
      const corps = new FormData()
      corps.append(
        'flowInfo',
        new Blob(
          [
            JSON.stringify({
              trackingId: depot.numero,
              name: depot.nomFichier,
              flowSyntax: SYNTAXES[depot.format],
              flowProfile: 'EN16931',
              processingRule: 'B2B',
            }),
          ],
          { type: 'application/json' },
        ),
      )
      corps.append('file', new Blob([new Uint8Array(depot.fichier)]), depot.nomFichier)
      const r = await requete<{ flowId: string }>('/v1/flows', { method: 'POST', body: corps })
      return { fluxId: r.flowId, statut: 200 }
    },
    async consulter(fluxId, statutConnu) {
      const r = await requete<{ acknowledgement?: { status?: string }; lifecycle?: Array<{ statusCode: number; reason?: string }> }>(
        `/v1/flows/${encodeURIComponent(fluxId)}`,
      )
      const dernier = r.lifecycle?.at(-1)
      if (r.acknowledgement?.status === 'Error') return { statut: 213, motif: 'Rejeté par la plateforme' }
      return { statut: dernier?.statusCode ?? statutConnu, motif: dernier?.reason ?? null }
    },
    async recevoir(depuis) {
      const r = await requete<{ results?: Array<{ flowId: string; flowSyntax: string }> }>('/v1/flows/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ where: { flowDirection: 'In', ...(depuis ? { updatedAfter: depuis } : {}) }, limit: 100 }),
      })
      const flux: FluxRecu[] = []
      for (const f of r.results ?? []) {
        const fichier = await requete<Uint8Array>(`/v1/flows/${encodeURIComponent(f.flowId)}?docType=Original`)
        const format: FormatFlux = f.flowSyntax === 'UBL' ? 'ubl' : f.flowSyntax === 'CII' ? 'cii' : 'factur-x'
        flux.push({ fluxId: f.flowId, format, fichier })
      }
      return flux
    },
    async repondre(fluxId, statut, motif) {
      await requete(`/v1/flows/${encodeURIComponent(fluxId)}/lifecycle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusCode: statut, reason: motif ?? undefined }),
      })
    },
    async deposerEreporting(lot) {
      const corps = new FormData()
      corps.append('flowInfo', new Blob([JSON.stringify({ trackingId: `${lot.type}-${lot.debut}`, flowSyntax: 'E-REPORTING', processingRule: lot.type })], { type: 'application/json' }))
      corps.append('file', new Blob([JSON.stringify(lot.contenu)], { type: 'application/json' }), `${lot.type}-${lot.debut}-${lot.fin}.json`)
      const r = await requete<{ flowId: string }>('/v1/flows', { method: 'POST', body: corps })
      return { fluxId: r.flowId }
    },
    async annuaire(siren) {
      try {
        const r = await requete<{ results?: Array<{ addressingIdentifier: string; addressingScheme?: string; platformName?: string }> }>(
          `/v1/directory/siren/${encodeURIComponent(siren)}`,
        )
        const e = r.results?.[0]
        return e ? { adresse: e.addressingIdentifier, schema: e.addressingScheme ?? '0225', plateforme: e.platformName ?? '' } : null
      } catch {
        return null
      }
    },
  }
}
