/** Lecture de fichiers CSV exportés par Excel, Google Sheets ou un autre logiciel. */

export interface TableauCsv {
  entetes: string[]
  lignes: string[][]
  separateur: string
}

/** Devine le séparateur le plus fréquent sur la première ligne (hors guillemets). */
export function deviner(texte: string): string {
  const premiere = texte.split(/\r?\n/, 1)[0] ?? ''
  const candidats = [';', ',', '\t', '|']
  let meilleur = ','
  let max = -1
  for (const c of candidats) {
    let n = 0
    let entreGuillemets = false
    for (const ch of premiere) {
      if (ch === '"') entreGuillemets = !entreGuillemets
      else if (ch === c && !entreGuillemets) n++
    }
    if (n > max) {
      max = n
      meilleur = c
    }
  }
  return meilleur
}

export function lireCsv(contenu: string, separateur?: string): TableauCsv {
  const texte = contenu.replace(/^﻿/, '')
  const sep = separateur ?? deviner(texte)
  const lignes: string[][] = []
  let ligne: string[] = []
  let champ = ''
  let guillemets = false

  for (let i = 0; i < texte.length; i++) {
    const ch = texte[i]!
    if (guillemets) {
      if (ch === '"' && texte[i + 1] === '"') {
        champ += '"'
        i++
      } else if (ch === '"') guillemets = false
      else champ += ch
    } else if (ch === '"') guillemets = true
    else if (ch === sep) {
      ligne.push(champ)
      champ = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texte[i + 1] === '\n') i++
      ligne.push(champ)
      lignes.push(ligne)
      ligne = []
      champ = ''
    } else champ += ch
  }
  if (champ !== '' || ligne.length > 0) {
    ligne.push(champ)
    lignes.push(ligne)
  }

  const nonVides = lignes.filter((l) => l.some((c) => c.trim() !== ''))
  const [entetes = [], ...reste] = nonVides
  return { entetes: entetes.map((e) => e.trim()), lignes: reste.map((l) => l.map((c) => c.trim())), separateur: sep }
}

/** Associe automatiquement des colonnes du fichier à des champs, d'après leur intitulé. */
export function associerColonnes(entetes: string[], champs: Record<string, string[]>): Record<string, number | null> {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const entetesNorm = entetes.map(norm)
  const resultat: Record<string, number | null> = {}
  const pris = new Set<number>()
  for (const [champ, synonymes] of Object.entries(champs)) {
    const i = entetesNorm.findIndex((e, idx) => !pris.has(idx) && synonymes.map(norm).includes(e))
    resultat[champ] = i >= 0 ? i : null
    if (i >= 0) pris.add(i)
  }
  return resultat
}
