import { describe, expect, it } from 'vitest'
import { formeJuridique, normaliserRecherche, urlRecherche } from './entreprises'

const reponse = {
  results: [
    {
      siren: '404833048',
      nom_complet: 'ATELIER DUPONT (ATELIER DUPONT)',
      nom_raison_sociale: 'ATELIER DUPONT',
      nature_juridique: '5499',
      activite_principale: '74.10Z',
      etat_administratif: 'A',
      siege: {
        siret: '40483304800006',
        numero_voie: '14',
        type_voie: 'RUE',
        libelle_voie: 'DE LA FOSSE',
        code_postal: '44000',
        libelle_commune: 'NANTES',
        adresse: '14 RUE DE LA FOSSE 44000 NANTES',
      },
    },
    { siren: '732829320', nom_complet: 'ANCIENNE SOCIETE', etat_administratif: 'C', siege: { adresse: 'LIEU-DIT LE BOURG' } },
    { siren: 'invalide' },
    null,
  ],
  total_results: 4,
}

describe('normaliserRecherche', () => {
  it('extrait les informations utiles', () => {
    const [premiere, seconde] = normaliserRecherche(reponse)
    expect(premiere).toEqual({
      siren: '404833048',
      siret: '40483304800006',
      nom: 'ATELIER DUPONT',
      formeJuridique: 'SARL',
      adresse: '14 RUE DE LA FOSSE',
      codePostal: '44000',
      ville: 'NANTES',
      codeNaf: '74.10Z',
      active: true,
    })
    expect(seconde).toMatchObject({ nom: 'ANCIENNE SOCIETE', active: false, adresse: 'LIEU-DIT LE BOURG', siret: null, formeJuridique: null })
  })
  it('ignore les réponses inattendues', () => {
    expect(normaliserRecherche(null)).toEqual([])
    expect(normaliserRecherche({ results: 'x' })).toEqual([])
    expect(normaliserRecherche({})).toEqual([])
  })
})

describe('utilitaires', () => {
  it('traduit les catégories juridiques', () => {
    expect(formeJuridique('5710')).toBe('SAS')
    expect(formeJuridique(5720)).toBe('SASU')
    expect(formeJuridique('0000')).toBeNull()
    expect(formeJuridique(undefined)).toBeNull()
  })
  it('construit l’URL de recherche', () => {
    expect(urlRecherche(' atelier dupont ')).toBe('https://recherche-entreprises.api.gouv.fr/search?q=atelier+dupont&per_page=6&page=1')
  })
})
