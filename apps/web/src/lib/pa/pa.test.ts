import { describe, expect, it, vi } from 'vitest'
import { plateformeAfnor } from './afnor'
import { DECISIONS, evenement, libelleStatut, STATUTS, suivantSimule } from './cycle'
import { plateformeSimulee } from './simulee'
import { ErreurPlateforme } from './types'

const depot = { numero: 'F-1', format: 'factur-x' as const, fichier: new Uint8Array([1, 2]), nomFichier: 'F-1.pdf', sirenVendeur: '732829320', destinataire: null }

describe('cycle de vie', () => {
  it('statuts obligatoires et libellés', () => {
    expect(Object.entries(STATUTS).filter(([, s]) => s.obligatoire).map(([c]) => Number(c))).toEqual([200, 210, 212, 213])
    expect(libelleStatut(205)).toBe('Approuvée')
    expect(libelleStatut(999)).toBe('Statut 999')
    expect(evenement(207, new Date('2026-10-12T10:00:00Z'), 'Montant erroné')).toEqual({ code: 207, libelle: 'En litige', date: '2026-10-12T10:00:00.000Z', motif: 'Montant erroné' })
    expect(evenement(200, new Date('2026-10-12T10:00:00Z'))).not.toHaveProperty('motif')
    expect(DECISIONS.refusee).toBe(210)
  })

  it('parcours simulé jusqu’à l’approbation', () => {
    expect(suivantSimule(200)).toBe(201)
    expect(suivantSimule(204)).toBe(205)
    expect(suivantSimule(205)).toBeNull()
    expect(suivantSimule(210)).toBeNull()
  })
})

describe('plateforme simulée', () => {
  it('dépose, fait avancer, annuaire, e-reporting', async () => {
    const pa = plateformeSimulee()
    const { fluxId, statut } = await pa.transmettre(depot)
    expect(fluxId).toMatch(/^SIM-/)
    expect(statut).toBe(200)
    expect(await pa.consulter(fluxId, 200)).toEqual({ statut: 201 })
    expect(await pa.consulter(fluxId, 205)).toEqual({ statut: 205 })
    expect(await pa.annuaire('404833048')).toMatchObject({ adresse: '404833048', schema: '0225' })
    expect(await pa.annuaire('x')).toBeNull()
    expect((await pa.deposerEreporting({ type: 'transactions', debut: '2026-10-01', fin: '2026-10-31', contenu: {} })).fluxId).toMatch(/^SIM-ER-/)
    expect(await pa.recevoir(null)).toEqual([])
    await expect(pa.transmettre({ ...depot, fichier: new Uint8Array() })).rejects.toThrow()
    const recu = { fluxId: 'R1', format: 'cii' as const, fichier: new Uint8Array([60]) }
    expect(await plateformeSimulee(async () => [recu]).recevoir(null)).toEqual([recu])
  })
})

describe('connecteur AFNOR', () => {
  it('exige sa configuration', () => {
    expect(() => plateformeAfnor('', '')).toThrow(ErreurPlateforme)
  })

  it('appels normalisés', async () => {
    const appel = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url)
      const json = (corps: unknown) => new Response(JSON.stringify(corps), { headers: { 'content-type': 'application/json' } })
      if (u.endsWith('/v1/flows') && init?.method === 'POST') return json({ flowId: 'FL-1' })
      if (u.endsWith('/v1/flows/FL-1')) return json({ lifecycle: [{ statusCode: 202 }, { statusCode: 207, reason: 'Quantité' }] })
      if (u.endsWith('/v1/flows/FL-2')) return json({ acknowledgement: { status: 'Error' } })
      if (u.endsWith('/v1/flows/search')) return json({ results: [{ flowId: 'IN-1', flowSyntax: 'UBL' }] })
      if (u.includes('/v1/flows/IN-1?docType=Original')) return new Response(new Uint8Array([60, 47]), { headers: { 'content-type': 'application/xml' } })
      if (u.endsWith('/lifecycle')) return json({})
      if (u.includes('/v1/directory/siren/404833048')) return json({ results: [{ addressingIdentifier: '404833048', platformName: 'PA X' }] })
      return new Response('non', { status: 404 })
    })
    const pa = plateformeAfnor('https://pa.exemple/', 'jeton', appel as unknown as typeof fetch)
    expect(await pa.transmettre(depot)).toEqual({ fluxId: 'FL-1', statut: 200 })
    expect(appel.mock.calls[0]![1]!.headers).toMatchObject({ Authorization: 'Bearer jeton' })
    expect(await pa.consulter('FL-1', 200)).toEqual({ statut: 207, motif: 'Quantité' })
    expect(await pa.consulter('FL-2', 200)).toEqual({ statut: 213, motif: 'Rejeté par la plateforme' })
    const recus = await pa.recevoir('2026-10-01')
    expect(recus).toMatchObject([{ fluxId: 'IN-1', format: 'ubl' }])
    await pa.repondre('IN-1', 205, null)
    expect((await pa.deposerEreporting({ type: 'paiements', debut: 'a', fin: 'b', contenu: [] })).fluxId).toBe('FL-1')
    expect(await pa.annuaire('404833048')).toEqual({ adresse: '404833048', schema: '0225', plateforme: 'PA X' })
    expect(await pa.annuaire('000000000')).toBeNull()
    await expect(pa.consulter('INCONNU', 200)).rejects.toThrow(/404/)
  })
})
