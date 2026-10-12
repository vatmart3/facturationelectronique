import { describe, expect, it } from 'vitest'
import { associerColonnes, deviner, lireCsv } from './csv'

describe('lireCsv', () => {
  it('lit un export Excel français (point-virgule, BOM, CRLF)', () => {
    const t = lireCsv('﻿Nom;SIREN;Ville\r\nAtelier Dupont;404833048;Nantes\r\nKerlann;;Quimper\r\n')
    expect(t.separateur).toBe(';')
    expect(t.entetes).toEqual(['Nom', 'SIREN', 'Ville'])
    expect(t.lignes).toEqual([
      ['Atelier Dupont', '404833048', 'Nantes'],
      ['Kerlann', '', 'Quimper'],
    ])
  })
  it('gère les guillemets, séparateurs et retours à la ligne dans les champs', () => {
    const t = lireCsv('nom,adresse\n"Dupont, Fils","14 rue ""Haute""\nBât. B"\nSeul,"x"')
    expect(t.lignes).toEqual([
      ['Dupont, Fils', '14 rue "Haute"\nBât. B'],
      ['Seul', 'x'],
    ])
  })
  it('ignore les lignes vides et accepte un séparateur imposé', () => {
    expect(lireCsv('a|b\n\n1|2\n', '|').lignes).toEqual([['1', '2']])
    expect(lireCsv('').entetes).toEqual([])
  })
  it('devine la tabulation', () => {
    expect(deviner('nom\tville\tsiren')).toBe('\t')
    expect(deviner('"a;b",c,d')).toBe(',')
  })
})

describe('associerColonnes', () => {
  it('rapproche les intitulés sans tenir compte des accents ni de la casse', () => {
    const r = associerColonnes(['Raison sociale', 'N° SIREN', 'E-mail', 'Ville'], {
      name: ['raison sociale', 'nom', 'client'],
      siren: ['siren', 'n° siren'],
      email: ['email', 'e-mail', 'courriel'],
      phone: ['téléphone'],
    })
    expect(r).toEqual({ name: 0, siren: 1, email: 2, phone: null })
  })
})
