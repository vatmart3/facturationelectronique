'use client'

import { centimesDepuisSaisie, quantiteDepuisSaisie } from '@pastille/moteur'
import { useState, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Base = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'defaultValue'>

function enSaisie(centimes: number): string {
  const signe = centimes < 0 ? '-' : ''
  const abs = Math.abs(centimes)
  return `${signe}${Math.trunc(abs / 100)},${String(abs % 100).padStart(2, '0')}`
}

function quantiteEnSaisie(milli: number): string {
  const signe = milli < 0 ? '-' : ''
  const abs = Math.abs(milli)
  const decimales = String(abs % 1000).padStart(3, '0').replace(/0+$/, '')
  return `${signe}${Math.trunc(abs / 1000)}${decimales ? `,${decimales}` : ''}`
}

const CLASSE =
  'h-8 w-full min-w-0 rounded-s border border-transparent bg-transparent px-1.5 text-right font-chiffre text-[13px] tabular-nums outline-none hover:border-trait focus:border-accent focus:bg-surface'

/** Saisie d'un montant en euros, stocké en centimes ; la valeur n'est validée qu'à la sortie du champ. */
export function SaisieMontant({ valeur, onValeur, className, ...props }: Base & { valeur: number; onValeur: (c: number) => void }) {
  const [texte, setTexte] = useState(enSaisie(valeur))
  const [enCours, setEnCours] = useState(false)
  const affiche = enCours ? texte : enSaisie(valeur)
  return (
    <input
      inputMode="decimal"
      value={affiche}
      onFocus={(e) => {
        setTexte(enSaisie(valeur))
        setEnCours(true)
        e.currentTarget.select()
      }}
      onChange={(e) => {
        setTexte(e.target.value)
        const c = centimesDepuisSaisie(e.target.value)
        if (c !== null) onValeur(c)
      }}
      onBlur={() => setEnCours(false)}
      aria-invalid={enCours && centimesDepuisSaisie(texte) === null ? true : undefined}
      className={cn(CLASSE, className)}
      {...props}
    />
  )
}

export function SaisieQuantite({ valeur, onValeur, className, ...props }: Base & { valeur: number; onValeur: (m: number) => void }) {
  const [texte, setTexte] = useState(quantiteEnSaisie(valeur))
  const [enCours, setEnCours] = useState(false)
  return (
    <input
      inputMode="decimal"
      value={enCours ? texte : quantiteEnSaisie(valeur)}
      onFocus={(e) => {
        setTexte(quantiteEnSaisie(valeur))
        setEnCours(true)
        e.currentTarget.select()
      }}
      onChange={(e) => {
        setTexte(e.target.value)
        const q = quantiteDepuisSaisie(e.target.value)
        if (q !== null) onValeur(q)
      }}
      onBlur={() => setEnCours(false)}
      className={cn(CLASSE, className)}
      {...props}
    />
  )
}

/** Pourcentage saisi « 5,5 » ↔ points de base. */
export function SaisiePourcentage({ valeur, onValeur, className, ...props }: Base & { valeur: number | null; onValeur: (p: number | null) => void }) {
  const versTexte = (v: number | null) => (v == null ? '' : String(v / 100).replace('.', ','))
  const [texte, setTexte] = useState(versTexte(valeur))
  const [enCours, setEnCours] = useState(false)
  return (
    <input
      inputMode="decimal"
      value={enCours ? texte : versTexte(valeur)}
      onFocus={(e) => {
        setTexte(versTexte(valeur))
        setEnCours(true)
        e.currentTarget.select()
      }}
      onChange={(e) => {
        setTexte(e.target.value)
        const t = e.target.value.replace(/[\s%]/g, '')
        if (t === '') return onValeur(null)
        const m = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(t)
        if (m) {
          const p = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'))
          if (p <= 10_000) onValeur(p)
        }
      }}
      onBlur={() => setEnCours(false)}
      className={cn(CLASSE, className)}
      {...props}
    />
  )
}
