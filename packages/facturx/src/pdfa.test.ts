import { PDFDocument, StandardFonts } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { genererCii } from './cii'
import { factureMultiTaux } from './exemples'
import { enregistrerFacturX, extraireXml, xmp } from './pdfa'

describe('PDF/A-3 Factur-X', () => {
  it('incorpore puis relit le XML', async () => {
    const pdf = await PDFDocument.create()
    const page = pdf.addPage()
    page.drawText('Facture', { font: await pdf.embedFont(StandardFonts.Helvetica) })
    const xml = genererCii(factureMultiTaux())
    const octets = await enregistrerFacturX(pdf, xml, { titre: 'Facture F-1', auteur: 'Atelier', sujet: 'Test', date: new Date('2026-10-12T12:00:00Z') })
    expect(await extraireXml(octets)).toBe(xml)
    const relu = await PDFDocument.load(octets, { updateMetadata: false })
    expect(relu.getProducer()).toBe('Pastille')
    expect(relu.getCreationDate()?.toISOString()).toBe('2026-10-12T12:00:00.000Z')
  })

  it('PDF sans pièce jointe', async () => {
    const pdf = await PDFDocument.create()
    pdf.addPage()
    expect(await extraireXml(await pdf.save())).toBeNull()
  })

  it('métadonnées XMP échappées', () => {
    const x = xmp({ titre: 'A & B', auteur: '<moi>', sujet: 's', date: new Date('2026-10-12T12:00:00.123Z') })
    expect(x).toContain('A &amp; B')
    expect(x).toContain('&lt;moi&gt;')
    expect(x).toContain('<xmp:CreateDate>2026-10-12T12:00:00Z</xmp:CreateDate>')
    expect(x).toContain('<fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>')
  })
})
