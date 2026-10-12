/**
 * Adaptateur de l'API publique « Recherche d'entreprises »
 * (https://recherche-entreprises.api.gouv.fr, données INSEE / RNE, sans clé).
 */

export interface EntrepriseTrouvee {
  siren: string
  siret: string | null
  nom: string
  formeJuridique: string | null
  adresse: string | null
  codePostal: string | null
  ville: string | null
  codeNaf: string | null
  active: boolean
}

/** Codes de catégorie juridique INSEE les plus fréquents. */
const FORMES: Record<string, string> = {
  '1000': 'EI',
  '5202': 'SNC',
  '5306': 'SCS',
  '5385': 'SEL',
  '5498': 'EURL',
  '5499': 'SARL',
  '5505': 'SA',
  '5599': 'SA',
  '5710': 'SAS',
  '5720': 'SASU',
  '5785': 'SELAS',
  '5485': 'SELARL',
  '6540': 'SCI',
  '6541': 'SCI',
  '6599': 'Société civile',
  '9220': 'Association',
  '7210': 'Commune',
  '7220': 'Département',
  '7229': 'Collectivité territoriale',
  '7230': 'Région',
}

export function formeJuridique(code: unknown): string | null {
  if (typeof code !== 'string' && typeof code !== 'number') return null
  return FORMES[String(code)] ?? null
}

function texte(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/** Normalise une réponse brute de l'API ; ignore silencieusement les entrées inexploitables. */
export function normaliserRecherche(json: unknown): EntrepriseTrouvee[] {
  const resultats = (json as { results?: unknown })?.results
  if (!Array.isArray(resultats)) return []
  return resultats.flatMap((brut: unknown) => {
    if (!brut || typeof brut !== 'object') return []
    const r = brut as Record<string, unknown>
    const siren = texte(r.siren)
    if (!siren || !/^\d{9}$/.test(siren)) return []
    const siege = (r.siege ?? {}) as Record<string, unknown>
    const voie = [siege.numero_voie, siege.indice_repetition, siege.type_voie, siege.libelle_voie]
      .map(texte)
      .filter(Boolean)
      .join(' ')
    const naf = texte(r.activite_principale) ?? texte(siege.activite_principale)
    return [
      {
        siren,
        siret: texte(siege.siret),
        nom: texte(r.nom_raison_sociale) ?? texte(r.nom_complet) ?? siren,
        formeJuridique: formeJuridique(r.nature_juridique),
        adresse: voie || texte(siege.adresse),
        codePostal: texte(siege.code_postal),
        ville: texte(siege.libelle_commune),
        codeNaf: naf,
        active: (texte(r.etat_administratif) ?? 'A') === 'A',
      },
    ]
  })
}

export function urlRecherche(requete: string, parPage = 6): string {
  const params = new URLSearchParams({ q: requete.trim(), per_page: String(parPage), page: '1' })
  return `https://recherche-entreprises.api.gouv.fr/search?${params}`
}
