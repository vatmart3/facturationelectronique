/**
 * Validation par les outils officiels, pour les tests et la CI :
 * schémas XSD (xmllint) et règles Schematron EN 16931 / BR-FR compilées en XSLT (Saxon).
 * VALIDATEURS_FACTURX désigne un dossier contenant xsd_and_schematron/ (paquet Python factur-x),
 * saxon.jar et xmlresolver.jar. En leur absence, les tests concernés sont ignorés.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const DOSSIER = process.env.VALIDATEURS_FACTURX ?? ''
export const disponibles = Boolean(DOSSIER) && existsSync(join(DOSSIER, 'saxon.jar')) && existsSync(join(DOSSIER, 'xsd_and_schematron'))

export interface Echec {
  id: string
  gravite: 'fatal' | 'warning' | string
  texte: string
}

function fichier(xml: string): string {
  const dossier = mkdtempSync(join(tmpdir(), 'facturx-'))
  const chemin = join(dossier, 'facture.xml')
  writeFileSync(chemin, xml)
  return chemin
}

/** Erreurs de validation XSD (vide si valide). */
export function validerXsd(xml: string, schema: 'cii' | 'ubl-invoice' | 'ubl-creditnote'): string[] {
  const xsd = {
    cii: 'facturx-en16931/Factur-X_EN16931.xsd',
    'ubl-invoice': 'ubl-2.1/maindoc/UBL-Invoice-2.1.xsd',
    'ubl-creditnote': 'ubl-2.1/maindoc/UBL-CreditNote-2.1.xsd',
  }[schema]
  try {
    execFileSync('xmllint', ['--noout', '--schema', join(DOSSIER, 'xsd_and_schematron', xsd), fichier(xml)], { stdio: 'pipe' })
    return []
  } catch (e) {
    return String((e as { stderr?: Buffer }).stderr ?? e)
      .split('\n')
      .filter((l) => l.includes('error'))
  }
}

/** Assertions Schematron en échec. */
export function validerSchematron(xml: string, regles: 'cii-en16931' | 'ubl-en16931' | 'cii-br-fr' | 'ubl-br-fr'): Echec[] {
  const xslt = {
    'cii-en16931': 'facturx-en16931/FACTUR-X_EN16931.xslt',
    'ubl-en16931': 'ubl-2.1/EN16931-UBL-validation.xslt',
    'cii-br-fr': 'cii-schematron-fr-ctc/BR-FR-Flux2-Schematron-CII.xslt',
    'ubl-br-fr': 'ubl-2.1/BR-FR-Flux2-Schematron-UBL.xslt',
  }[regles]
  const sortie = execFileSync(
    'java',
    [
      '-cp',
      `${join(DOSSIER, 'saxon.jar')}:${join(DOSSIER, 'xmlresolver.jar')}`,
      'net.sf.saxon.Transform',
      `-s:${fichier(xml)}`,
      `-xsl:${join(DOSSIER, 'xsd_and_schematron', xslt)}`,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 },
  ).toString()
  const echecs: Echec[] = []
  for (const m of sortie.matchAll(/<svrl:failed-assert([^>]*)>([\s\S]*?)<\/svrl:failed-assert>/g)) {
    const attrs = m[1] ?? ''
    echecs.push({
      id: /id="([^"]*)"/.exec(attrs)?.[1] ?? '?',
      gravite: /flag="([^"]*)"/.exec(attrs)?.[1] ?? 'fatal',
      texte: (/<svrl:text>([\s\S]*?)<\/svrl:text>/.exec(m[2] ?? '')?.[1] ?? '').replace(/\s+/g, ' ').trim(),
    })
  }
  return echecs
}
