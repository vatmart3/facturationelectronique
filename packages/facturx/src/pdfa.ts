/**
 * Transforme un PDF (polices incorporées, sans transparence) en PDF/A-3b Factur-X :
 * XML joint (AFRelationship Data), métadonnées XMP avec le schéma d'extension fx,
 * profil de sortie sRGB, identifiant de document.
 */

import { createHash } from 'node:crypto'
import { AFRelationship, PDFArray, PDFDocument, PDFHexString, PDFName, PDFString } from 'pdf-lib'
import { SRGB_ICC_BASE64 } from './icc'
import { echapper } from './modele'

const ICC = Buffer.from(SRGB_ICC_BASE64, 'base64')

export interface MetaFacturX {
  titre: string
  auteur: string
  sujet: string
  /** Date de création du document (celle de l'émission, pour un rendu reproductible). */
  date: Date
  /** « EN 16931 » pour le profil utilisé ici. */
  profil?: string
  /** Type Factur-X : INVOICE pour les factures et avoirs. */
  typeDocument?: 'INVOICE' | 'ORDER'
}

const PRODUCTEUR = 'Pastille'

function dateXmp(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function propriete(nom: string, description: string): string {
  return `<rdf:li rdf:parseType="Resource"><pdfaProperty:name>${nom}</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>${description}</pdfaProperty:description></rdf:li>`
}

export function xmp(meta: MetaFacturX, fichier = 'factur-x.xml'): string {
  const date = dateXmp(meta.date)
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"><pdfaid:part>3</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance></rdf:Description>
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${echapper(meta.titre)}</rdf:li></rdf:Alt></dc:title>
<dc:creator><rdf:Seq><rdf:li>${echapper(meta.auteur)}</rdf:li></rdf:Seq></dc:creator>
<dc:description><rdf:Alt><rdf:li xml:lang="x-default">${echapper(meta.sujet)}</rdf:li></rdf:Alt></dc:description>
</rdf:Description>
<rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/"><pdf:Producer>${PRODUCTEUR}</pdf:Producer></rdf:Description>
<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/"><xmp:CreatorTool>${PRODUCTEUR}</xmp:CreatorTool><xmp:CreateDate>${date}</xmp:CreateDate><xmp:ModifyDate>${date}</xmp:ModifyDate><xmp:MetadataDate>${date}</xmp:MetadataDate></rdf:Description>
<rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
<pdfaExtension:schemas><rdf:Bag><rdf:li rdf:parseType="Resource">
<pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
<pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>
<pdfaSchema:prefix>fx</pdfaSchema:prefix>
<pdfaSchema:property><rdf:Seq>
${propriete('DocumentFileName', 'The name of the embedded XML document')}
${propriete('DocumentType', 'The type of the hybrid document in capital letters, e.g. INVOICE or ORDER')}
${propriete('Version', 'The actual version of the standard applying to the embedded XML document')}
${propriete('ConformanceLevel', 'The conformance level of the embedded XML document')}
</rdf:Seq></pdfaSchema:property>
</rdf:li></rdf:Bag></pdfaExtension:schemas>
</rdf:Description>
<rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#"><fx:DocumentType>${meta.typeDocument ?? 'INVOICE'}</fx:DocumentType><fx:DocumentFileName>${fichier}</fx:DocumentFileName><fx:Version>1.0</fx:Version><fx:ConformanceLevel>${meta.profil ?? 'EN 16931'}</fx:ConformanceLevel></rdf:Description>
</rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`
}

/** Incorpore le XML et les marques PDF/A-3 dans un document pdf-lib, puis l'enregistre. */
export async function enregistrerFacturX(pdf: PDFDocument, xml: string, meta: MetaFacturX): Promise<Uint8Array> {
  const contexte = pdf.context
  const catalogue = pdf.catalog

  // Informations du document, identiques au XMP.
  pdf.setTitle(meta.titre, { showInWindowTitleBar: true })
  pdf.setAuthor(meta.auteur)
  pdf.setSubject(meta.sujet)
  pdf.setProducer(PRODUCTEUR)
  pdf.setCreator(PRODUCTEUR)
  pdf.setCreationDate(meta.date)
  pdf.setModificationDate(meta.date)
  pdf.setLanguage('fr-FR')

  // XML joint, relation « Data » (profil EN 16931).
  await pdf.attach(new TextEncoder().encode(xml), 'factur-x.xml', {
    mimeType: 'text/xml',
    description: 'Factur-X',
    creationDate: meta.date,
    modificationDate: meta.date,
    afRelationship: AFRelationship.Data,
  })

  // Métadonnées XMP (non compressées).
  const flux = contexte.stream(new TextEncoder().encode(xmp(meta)), { Type: 'Metadata', Subtype: 'XML' })
  catalogue.set(PDFName.of('Metadata'), contexte.register(flux))

  // Profil de sortie sRGB.
  const icc = contexte.register(contexte.flateStream(ICC, { N: 3 }))
  const intention = contexte.obj({
    Type: 'OutputIntent',
    S: 'GTS_PDFA1',
    OutputConditionIdentifier: PDFString.of('sRGB'),
    Info: PDFString.of('sRGB IEC61966-2.1'),
    DestOutputProfile: icc,
  })
  catalogue.set(PDFName.of('OutputIntents'), contexte.obj([contexte.register(intention)]))

  // Identifiant de document (obligatoire en PDF/A), stable pour un même contenu.
  const empreinte = createHash('md5').update(xml).digest('hex')
  contexte.trailerInfo.ID = PDFArray.withContext(contexte)
  ;(contexte.trailerInfo.ID as PDFArray).push(PDFHexString.of(empreinte))
  ;(contexte.trailerInfo.ID as PDFArray).push(PDFHexString.of(empreinte))

  return pdf.save({ useObjectStreams: false, updateFieldAppearances: false })
}
