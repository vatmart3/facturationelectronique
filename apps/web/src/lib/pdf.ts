import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import fontkit from '@pdf-lib/fontkit'
import { formatTaux } from '@pastille/moteur'
import { controler, enregistrerFacturX, genererCii, type Anomalie } from '@pastille/facturx'
import { degrees, PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from 'pdf-lib'
import QRCode from 'qrcode'
import { versEn16931 } from './en16931'
import { formatIban, formatMontant } from './format'
import { adresseClient, adresseVendeur, dateCourte, identiteLegale, quantiteTexte, type DocumentImprimable } from './imprimable'

/**
 * Rendu PDF A4 d'un document, fidèle à l'aperçu HTML (modèles Galet, Papeterie, Classique).
 * Une facture ou un avoir émis devient un PDF/A-3 Factur-X (XML CII EN 16931 joint)
 * si ses données passent les contrôles EN 16931.
 */

const L = 595.28
const H = 841.89
const M = 40
const ENCRE = rgb(0.114, 0.122, 0.141)
const GRIS = rgb(0.333, 0.353, 0.392)
const GRIS_CLAIR = rgb(0.478, 0.502, 0.545)
const FOND = rgb(0.957, 0.961, 0.969)
const TRAIT = rgb(0.86, 0.865, 0.875)
const BLANC = rgb(1, 1, 1)

type Polices = { r: Uint8Array; b: Uint8Array }
const cache = new Map<string, Promise<Polices>>()

function polices(serif: boolean): Promise<Polices> {
  const famille = serif ? 'SourceSerif4' : 'Onest'
  let p = cache.get(famille)
  if (!p) {
    const dossier = path.join(process.cwd(), 'ressources', 'polices')
    p = Promise.all([readFile(path.join(dossier, `${famille}-Regular.ttf`)), readFile(path.join(dossier, `${famille}-SemiBold.ttf`))]).then(([r, b]) => ({
      r: new Uint8Array(r),
      b: new Uint8Array(b),
    }))
    cache.set(famille, p)
  }
  return p
}

function couleur(hex: string): RGB {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!m) return rgb(0.12, 0.23, 0.43)
  return rgb(parseInt(m[1]!, 16) / 255, parseInt(m[2]!, 16) / 255, parseInt(m[3]!, 16) / 255)
}

interface Style {
  taille?: number
  gras?: boolean
  couleur?: RGB
  align?: 'gauche' | 'droite' | 'centre'
}

class Rendu {
  page!: PDFPage
  y = 0
  pages: PDFPage[] = []

  constructor(
    readonly pdf: PDFDocument,
    readonly r: PDFFont,
    readonly b: PDFFont,
  ) {
    this.nouvellePage()
  }

  nouvellePage() {
    this.page = this.pdf.addPage([L, H])
    this.pages.push(this.page)
    this.y = H - M
  }

  largeur(t: string, taille: number, gras = false) {
    return (gras ? this.b : this.r).widthOfTextAtSize(t, taille)
  }

  texte(t: string, x: number, y: number, s: Style = {}) {
    const taille = s.taille ?? 9
    const police = s.gras ? this.b : this.r
    const l = police.widthOfTextAtSize(t, taille)
    const px = s.align === 'droite' ? x - l : s.align === 'centre' ? x - l / 2 : x
    this.page.drawText(t, { x: px, y, size: taille, font: police, color: s.couleur ?? ENCRE })
  }

  /** Découpe un texte en lignes tenant dans la largeur donnée (retours à la ligne conservés). */
  envelopper(t: string, taille: number, largeurMax: number, gras = false): string[] {
    const lignes: string[] = []
    for (const paragraphe of t.split('\n')) {
      let courante = ''
      for (const mot of paragraphe.split(/\s+/).filter(Boolean)) {
        const essai = courante ? `${courante} ${mot}` : mot
        if (this.largeur(essai, taille, gras) <= largeurMax || !courante) courante = essai
        else {
          lignes.push(courante)
          courante = mot
        }
      }
      lignes.push(courante)
    }
    return lignes
  }

  rect(x: number, y: number, l: number, h: number, opts: { fond?: RGB; bord?: RGB }) {
    this.page.drawRectangle({ x, y, width: l, height: h, color: opts.fond, borderColor: opts.bord, borderWidth: opts.bord ? 0.6 : 0 })
  }

  trait(x1: number, y: number, x2: number, c: RGB = TRAIT, epaisseur = 0.6) {
    this.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: epaisseur, color: c })
  }
}

const LIBELLES = {
  fr: { date: 'Date', echeance: 'Échéance', validite: 'Valable jusqu’au', periode: 'Période', prestation: 'Prestation', commande: 'Bon de commande', client: 'FACTURÉ À', destinataire: 'DESTINATAIRE', designation: 'DÉSIGNATION', qte: 'QTÉ', pu: 'PU HT', tva: 'TVA', total: 'TOTAL HT', totalLignes: 'Total HT des lignes', remise: 'Remise', acomptes: 'Acompte déduit', totalHt: 'Total HT', totalTtc: 'Total TTC', net: 'Net à payer', sur: 'sur', exonere: 'Exonéré', conditions: 'Conditions', paiement: 'Paiement', enLigne: 'Paiement en ligne', brouillon: 'BROUILLON', paye: 'PAYÉE', empreinte: 'Empreinte SHA-256', page: 'Page' },
  en: { date: 'Date', echeance: 'Due date', validite: 'Valid until', periode: 'Period', prestation: 'Service date', commande: 'Purchase order', client: 'BILL TO', destinataire: 'TO', designation: 'DESCRIPTION', qte: 'QTY', pu: 'UNIT PRICE', tva: 'VAT', total: 'AMOUNT', totalLignes: 'Lines total', remise: 'Discount', acomptes: 'Deposit deducted', totalHt: 'Total excl. VAT', totalTtc: 'Total incl. VAT', net: 'Amount due', sur: 'on', exonere: 'Exempt', conditions: 'Terms', paiement: 'Payment', enLigne: 'Pay online', brouillon: 'DRAFT', paye: 'PAID', empreinte: 'SHA-256 fingerprint', page: 'Page' },
}

/** Charge utile du QR code de virement SEPA (EPC069-12). */
export function charge(doc: DocumentImprimable): string | null {
  const iban = doc.vendeur.iban?.replace(/\s/g, '')
  if (!iban || doc.devise !== 'EUR' || doc.type === 'devis' || doc.type === 'avoir' || doc.totaux.netAPayer <= 0 || doc.brouillon) return null
  const montant = `EUR${(doc.totaux.netAPayer / 100).toFixed(2)}`
  return ['BCD', '002', '1', 'SCT', doc.vendeur.bic ?? '', doc.vendeur.name.slice(0, 70), iban, montant, '', '', (doc.numero ?? '').slice(0, 140)].join('\n')
}

async function dessiner(doc: DocumentImprimable, rendu: Rendu, logo: PDFImage | null) {
  const t = LIBELLES[doc.langue]
  const m = (c: number) => formatMontant(c, doc.devise)
  const accent = couleur(doc.couleur)
  const classique = doc.modele === 'classique'
  const papeterie = doc.modele === 'papeterie'
  const galet = doc.modele === 'galet'
  const v = doc.vendeur
  const droite = L - M

  // En-tête
  let y = rendu.y
  if (logo) {
    const echelle = Math.min(150 / logo.width, 46 / logo.height, 1)
    rendu.page.drawImage(logo, { x: M, y: y - logo.height * echelle, width: logo.width * echelle, height: logo.height * echelle })
    y -= logo.height * echelle + 8
  } else {
    rendu.texte(v.name, M, y - 14, { taille: 14, gras: true })
    y -= 26
  }
  for (const l of adresseVendeur(v)) {
    rendu.texte(l, M, y, { taille: 8.5, couleur: GRIS })
    y -= 11
  }
  const yTitre = rendu.y - (papeterie ? 12 : 18)
  rendu.texte(papeterie ? doc.titre.toUpperCase() : doc.titre, droite, yTitre, {
    taille: papeterie ? 11 : 20,
    gras: true,
    couleur: classique ? ENCRE : accent,
    align: 'droite',
  })
  rendu.texte(doc.numero ? `N° ${doc.numero}` : t.brouillon, droite, yTitre - 16, { taille: 10, gras: true, align: 'droite' })
  y = Math.min(y, yTitre - 26) - 6
  if (galet) rendu.rect(M, y, droite - M, 2, { fond: accent })
  else if (papeterie) rendu.trait(M, y, droite, GRIS_CLAIR, 0.5)
  y -= 22

  // Client et dates
  const largeurClient = 280
  const lignesClient: Array<[string, Style]> = doc.client
    ? [
        [doc.client.name, { taille: 10.5, gras: true }],
        ...adresseClient(doc.client).map((l): [string, Style] => [l, { taille: 9 }]),
        ...(doc.client.siren ? [[`SIREN ${doc.client.siren}`, { taille: 8.5, couleur: GRIS }] as [string, Style]] : []),
        ...(doc.client.vat_number ? [[`TVA ${doc.client.vat_number}`, { taille: 8.5, couleur: GRIS }] as [string, Style]] : []),
        ...(doc.client.service_code ? [[`Code service ${doc.client.service_code}`, { taille: 8.5, couleur: GRIS }] as [string, Style]] : []),
      ]
    : [['—', { taille: 9 }]]
  const hauteurClient = 22 + lignesClient.length * 12.5 + 4
  if (galet) rendu.rect(M, y - hauteurClient, largeurClient, hauteurClient, { fond: FOND })
  if (classique) rendu.rect(M, y - hauteurClient, largeurClient, hauteurClient, { bord: GRIS_CLAIR })
  rendu.texte(doc.type === 'devis' ? t.destinataire : t.client, M + 10, y - 14, { taille: 7, gras: true, couleur: GRIS_CLAIR })
  let yc = y - 28
  for (const [texte, style] of lignesClient) {
    rendu.texte(texte, M + 10, yc, style)
    yc -= 12.5
  }
  const meta: Array<[string, string]> = [
    [t.date, dateCourte(doc.dateEmission)],
    ...(doc.dateEcheance ? [[t.echeance, dateCourte(doc.dateEcheance)] as [string, string]] : []),
    ...(doc.dateValidite ? [[t.validite, dateCourte(doc.dateValidite)] as [string, string]] : []),
    ...(doc.periode ? [[t.periode, `${dateCourte(doc.periode.debut)} – ${dateCourte(doc.periode.fin)}`] as [string, string]] : []),
    ...(doc.datePrestation && !doc.periode ? [[t.prestation, dateCourte(doc.datePrestation)] as [string, string]] : []),
    ...(doc.bonCommande ? [[t.commande, doc.bonCommande] as [string, string]] : []),
  ]
  let ym = y - 12
  for (const [k, val] of meta) {
    rendu.texte(k, droite - 150, ym, { taille: 8.5, couleur: GRIS_CLAIR })
    rendu.texte(val, droite, ym, { taille: 8.5, gras: true, align: 'droite' })
    ym -= 13
  }
  y = Math.min(y - hauteurClient, ym) - 18

  if (doc.objet) {
    for (const l of rendu.envelopper(doc.objet, 10.5, droite - M, true)) {
      rendu.texte(l, M, y, { taille: 10.5, gras: true })
      y -= 14
    }
    y -= 6
  }

  // Lignes
  const colonnes = { qte: droite - 200, pu: droite - 130, tva: droite - 85, total: droite - 6 }
  const largeurDesignation = colonnes.qte - 40 - M - 6
  const entete = () => {
    if (classique) rendu.rect(M, y - 6, droite - M, 18, { fond: ENCRE })
    const c = classique ? BLANC : GRIS_CLAIR
    rendu.texte(t.designation, M + 6, y, { taille: 7, gras: true, couleur: c })
    rendu.texte(t.qte, colonnes.qte, y, { taille: 7, gras: true, couleur: c, align: 'droite' })
    rendu.texte(t.pu, colonnes.pu, y, { taille: 7, gras: true, couleur: c, align: 'droite' })
    rendu.texte(t.tva, colonnes.tva, y, { taille: 7, gras: true, couleur: c, align: 'droite' })
    rendu.texte(t.total, colonnes.total, y, { taille: 7, gras: true, couleur: c, align: 'droite' })
    if (!classique) rendu.trait(M, y - 6, droite, galet ? accent : GRIS_CLAIR, galet ? 1 : 0.6)
    y -= 22
  }
  entete()
  for (const l of doc.lignes) {
    const designation = rendu.envelopper(l.designation || '—', 9, largeurDesignation, true)
    const description = l.description ? rendu.envelopper(l.description, 8, largeurDesignation) : []
    const remise = l.remise ? [`${t.remise} ${l.remise.type === 'pourcentage' ? formatTaux(l.remise.valeur) : m(Math.abs(l.remise.valeur))}`] : []
    const hauteur = designation.length * 11.5 + description.length * 10 + remise.length * 10 + 14
    if (y - hauteur < M + 60) {
      rendu.nouvellePage()
      y = rendu.y - 10
      entete()
    }
    let yl = y
    for (const d of designation) {
      rendu.texte(d, M + 6, yl, { taille: 9, gras: true })
      yl -= 11.5
    }
    for (const d of description) {
      rendu.texte(d, M + 6, yl, { taille: 8, couleur: GRIS })
      yl -= 10
    }
    for (const d of remise) {
      rendu.texte(d, M + 6, yl, { taille: 7.5, couleur: GRIS_CLAIR })
      yl -= 10
    }
    rendu.texte(quantiteTexte(l.quantite), colonnes.qte, y, { taille: 9, align: 'droite' })
    if (l.unite && l.unite !== 'unité') rendu.texte(l.unite, colonnes.qte, y - 10, { taille: 7, couleur: GRIS_CLAIR, align: 'droite' })
    rendu.texte(m(l.prixUnitaireHt), colonnes.pu, y, { taille: 9, align: 'droite' })
    rendu.texte(l.categorie === 'S' || l.categorie === 'Z' ? formatTaux(l.taux) : l.categorie, colonnes.tva, y, { taille: 9, align: 'droite' })
    rendu.texte(m(l.montantNet), colonnes.total, y, { taille: 9, gras: true, align: 'droite' })
    y -= hauteur
    rendu.trait(M, y + 11, droite, classique ? GRIS_CLAIR : TRAIT)
  }
  y -= 8

  // Totaux (à droite) et paiement (à gauche)
  const lignesTotaux: Array<{ k: string; v: string; fort?: boolean; discret?: boolean }> = [
    ...(doc.totaux.totalLignesHt !== doc.totaux.totalHt ? [{ k: t.totalLignes, v: m(doc.totaux.totalLignesHt) }] : []),
    ...(doc.totaux.remiseGlobale !== 0 ? [{ k: t.remise, v: `− ${m(Math.abs(doc.totaux.remiseGlobale))}` }] : []),
    ...doc.acomptes.map((a) => ({ k: `${t.acomptes} ${a.numero}`, v: `− ${m(a.montantHt)}` })),
    { k: t.totalHt, v: m(doc.totaux.totalHt), fort: true },
    ...doc.ventilation.map((g) => ({
      k: g.categorie === 'S' || g.categorie === 'Z' ? `TVA ${formatTaux(g.taux)} ${t.sur} ${m(g.baseHt)}` : `${t.exonere} (${g.categorie}) ${t.sur} ${m(g.baseHt)}`,
      v: m(g.tva),
      discret: true,
    })),
    { k: t.totalTtc, v: m(doc.totaux.totalTtc), fort: true },
  ]
  const largeurTotaux = 215
  const hauteurTotaux = lignesTotaux.length * 14 + 34
  const qr = charge(doc)
  const gauche: Array<[string, Style]> = []
  const largeurGauche = droite - largeurTotaux - M - 24 - (qr ? 80 : 0)
  if (doc.notes) for (const l of rendu.envelopper(doc.notes, 9, largeurGauche)) gauche.push([l, { taille: 9 }])
  if (doc.conditions) for (const l of rendu.envelopper(`${t.conditions} : ${doc.conditions}`, 8, largeurGauche)) gauche.push([l, { taille: 8, couleur: GRIS }])
  if (doc.type !== 'devis' && doc.type !== 'avoir' && v.iban) {
    const texte = `${t.paiement} : virement · IBAN ${formatIban(v.iban)}${v.bic ? ` · BIC ${v.bic}` : ''}${doc.numero ? ` · référence ${doc.numero}` : ''}`
    for (const l of rendu.envelopper(texte, 8, largeurGauche)) gauche.push([l, { taille: 8, couleur: GRIS }])
  }
  if (doc.lienPaiement) {
    for (const l of rendu.envelopper(`${t.enLigne} : ${doc.lienPaiement}`, 8, largeurGauche)) gauche.push([l, { taille: 8, couleur: ENCRE }])
  }
  const besoin = Math.max(hauteurTotaux, gauche.length * 11, qr ? 80 : 0) + 10
  if (y - besoin < M + 70) {
    rendu.nouvellePage()
    y = rendu.y - 10
  }
  const xT = droite - largeurTotaux
  if (galet) rendu.rect(xT - 8, y - hauteurTotaux + 6, largeurTotaux + 8, hauteurTotaux + 4, { fond: FOND })
  if (classique) rendu.rect(xT - 8, y - hauteurTotaux + 6, largeurTotaux + 8, hauteurTotaux + 4, { bord: GRIS_CLAIR })
  let yt = y - 6
  for (const l of lignesTotaux) {
    if (l.fort) rendu.trait(xT, yt + 10, droite - 4, TRAIT)
    const taille = l.discret ? 8 : 9
    rendu.texte(l.k, xT, yt, { taille, gras: l.fort, couleur: l.discret ? GRIS : ENCRE })
    rendu.texte(l.v, droite - 6, yt, { taille, gras: l.fort, couleur: l.discret ? GRIS : ENCRE, align: 'droite' })
    yt -= 14
  }
  rendu.rect(xT - 2, yt - 8, largeurTotaux - 2, 20, { fond: classique ? ENCRE : accent })
  rendu.texte(doc.type === 'devis' ? t.totalTtc : t.net, xT + 4, yt - 1, { taille: 10.5, gras: true, couleur: BLANC })
  rendu.texte(m(doc.totaux.netAPayer), droite - 10, yt - 1, { taille: 10.5, gras: true, couleur: BLANC, align: 'droite' })

  let yg = y - 6
  for (const [texte, style] of gauche) {
    rendu.texte(texte, M, yg, style)
    yg -= 11
  }
  if (qr) {
    const code = QRCode.create(qr, { errorCorrectionLevel: 'M' })
    const n = code.modules.size
    const cote = 72
    const pas = cote / n
    const x0 = xT - 24 - cote
    const y0 = y - cote
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (code.modules.get(i, j)) rendu.page.drawRectangle({ x: x0 + j * pas, y: y0 + (n - 1 - i) * pas, width: pas, height: pas, color: ENCRE })
      }
    }
    rendu.texte('Payer par virement', x0 + cote / 2, y0 - 9, { taille: 6.5, couleur: GRIS_CLAIR, align: 'centre' })
  }
  y = Math.min(yt - 16, yg, qr ? y - 100 : y) - 14

  // Mentions puis pied de page légal
  const mentions = [...doc.mentions, ...(v.terms_text ? [v.terms_text] : [])].flatMap((x) => rendu.envelopper(x, 7.5, droite - M))
  const legal = [...identiteLegale(v), ...(v.footer_text ? [v.footer_text] : [])]
  const hauteurPied = mentions.length * 9.5 + legal.length * 9 + (doc.empreinte ? 10 : 0) + 20
  if (y - hauteurPied < M) {
    rendu.nouvellePage()
    y = rendu.y
  }
  let yp = Math.min(y, M + hauteurPied)
  for (const l of mentions) {
    rendu.texte(l, M, yp, { taille: 7.5, couleur: GRIS })
    yp -= 9.5
  }
  yp -= 4
  rendu.trait(M, yp + 4, droite, TRAIT)
  yp -= 8
  for (const l of legal) {
    rendu.texte(l, L / 2, yp, { taille: 7, couleur: GRIS_CLAIR, align: 'centre' })
    yp -= 9
  }
  if (doc.empreinte) rendu.texte(`${t.empreinte} ${doc.empreinte}`, L / 2, yp, { taille: 5.5, couleur: GRIS_CLAIR, align: 'centre' })

  // Filigrane, tampon, pagination
  rendu.pages.forEach((page, i) => {
    rendu.page = page
    if (doc.brouillon) {
      page.drawText(t.brouillon, { x: 120, y: 330, size: 80, font: rendu.b, color: rgb(0.93, 0.93, 0.94), rotate: degrees(30) })
    }
    if (rendu.pages.length > 1) rendu.texte(`${t.page} ${i + 1} / ${rendu.pages.length}`, droite, 22, { taille: 7, couleur: GRIS_CLAIR, align: 'droite' })
  })
  if (doc.paye) {
    const p = rendu.pages[0]!
    p.drawRectangle({ x: droite - 120, y: H - 175, width: 96, height: 30, borderColor: rgb(0.12, 0.54, 0.36), borderWidth: 1.6, rotate: degrees(8) })
    p.drawText(t.paye, { x: droite - 104, y: H - 165, size: 15, font: rendu.b, color: rgb(0.12, 0.54, 0.36), rotate: degrees(8) })
  }
}

export interface ResultatPdf {
  octets: Uint8Array
  /** Vrai si le PDF est un Factur-X (XML joint). */
  facturx: boolean
  anomalies: Anomalie[]
}

export async function genererPdf(doc: DocumentImprimable, options: { logo?: { octets: Uint8Array; type: string } | null } = {}): Promise<ResultatPdf> {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const p = await polices(doc.police === 'serif')
  const [r, b] = await Promise.all([pdf.embedFont(p.r, { subset: true }), pdf.embedFont(p.b, { subset: true })])
  let logo: PDFImage | null = null
  if (options.logo) {
    try {
      logo = options.logo.type.includes('png') ? await pdf.embedPng(options.logo.octets) : options.logo.type.includes('jpeg') || options.logo.type.includes('jpg') ? await pdf.embedJpg(options.logo.octets) : null
    } catch {
      logo = null
    }
  }
  await dessiner(doc, new Rendu(pdf, r, b), logo)

  const titre = `${doc.titre} ${doc.numero ?? ''}`.trim()
  const facture = versEn16931(doc)
  const anomalies = facture ? controler(facture) : []
  if (facture && !anomalies.some((a) => a.bloquant)) {
    const octets = await enregistrerFacturX(pdf, genererCii(facture), {
      titre,
      auteur: doc.vendeur.name,
      sujet: `${doc.titre} ${doc.numero} · ${doc.client?.name ?? ''}`,
      date: new Date(`${doc.dateEmission}T12:00:00Z`),
    })
    return { octets, facturx: true, anomalies }
  }
  pdf.setTitle(titre)
  pdf.setAuthor(doc.vendeur.name)
  pdf.setProducer('Pastille')
  pdf.setCreator('Pastille')
  return { octets: await pdf.save(), facturx: false, anomalies }
}

/** Document texte simple (DPA, conditions) : titre, sous-titre, sections paginées. */
export async function pdfTexte(titre: string, sousTitre: string, sections: ReadonlyArray<{ titre: string; paragraphes: string[] }>): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const p = await polices(false)
  const rendu = new Rendu(pdf, await pdf.embedFont(p.r, { subset: true }), await pdf.embedFont(p.b, { subset: true }))
  let y = rendu.y
  const ligne = (t: string, taille: number, gras = false, couleur = ENCRE, apres = 4) => {
    for (const l of rendu.envelopper(t, taille, L - 2 * M, gras)) {
      if (y < M + 20) {
        rendu.nouvellePage()
        y = rendu.y
      }
      rendu.texte(l, M, y, { taille, gras, couleur })
      y -= taille * 1.45
    }
    y -= apres
  }
  ligne(titre, 18, true, ENCRE, 2)
  ligne(sousTitre, 9, false, GRIS_CLAIR, 14)
  for (const s of sections) {
    ligne(s.titre, 11.5, true, ENCRE, 3)
    for (const par of s.paragraphes) ligne(par, 9.5, false, GRIS, 6)
    y -= 6
  }
  rendu.pages.forEach((page, i) => {
    rendu.page = page
    rendu.texte(`${i + 1} / ${rendu.pages.length}`, L - M, 22, { taille: 7, couleur: GRIS_CLAIR, align: 'droite' })
  })
  pdf.setTitle(titre)
  pdf.setProducer('Pastille')
  return pdf.save()
}
