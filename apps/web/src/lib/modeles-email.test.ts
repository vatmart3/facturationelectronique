import { describe, expect, it } from 'vitest'
import { emailEnvoi, emailRelance, emailRemerciement } from './modeles-email'

const c = {
  entreprise: 'Atelier <Lumen>',
  type: 'facture' as const,
  numero: 'F-2026-0042',
  montant: 69600,
  devise: 'EUR',
  echeance: '2026-11-11',
  lien: 'https://pastille.app/d/abc',
  signature: null,
}

describe('emails', () => {
  it('envoi d’une facture : montant, échéance, lien, HTML échappé', () => {
    const e = emailEnvoi(c, null)
    expect(e.sujet).toBe('Facture F-2026-0042 · Atelier <Lumen>')
    expect(e.texte).toMatch(/696,00\s€, à régler au plus tard le 11\/11\/2026/)
    expect(e.texte).toContain('Consulter la facture : https://pastille.app/d/abc')
    expect(e.html).toContain('Atelier &lt;Lumen&gt;')
    expect(e.html).not.toContain('<Lumen>')
  })

  it('devis, avoir, message personnalisé', () => {
    expect(emailEnvoi({ ...c, type: 'devis' }, null).texte).toContain('accepter en ligne')
    expect(emailEnvoi({ ...c, type: 'avoir', lien: null }, null).texte).toContain('l’avoir n° F-2026-0042')
    expect(emailEnvoi({ ...c, signature: 'Camille' }, 'Voici la facture du mois.').texte).toMatch(/Voici la facture du mois\.[\s\S]*Camille$/)
  })

  it('relances : ton gradué selon le retard', () => {
    expect(emailRelance(c, -3).sujet).toContain('à échéance le 11/11/2026')
    expect(emailRelance(c, 7).sujet).toContain('en attente de règlement')
    const ferme = emailRelance({ ...c, lien: null }, 30)
    expect(ferme.sujet).toContain('échue depuis 30 jours')
    expect(ferme.texte).toContain('indemnité forfaitaire de 40 €')
    expect(emailRemerciement(c).sujet).toBe('Paiement reçu · facture F-2026-0042')
  })
})
