'use client'

import { useEffect, useRef, useState } from 'react'
import { simuler } from '@/lib/simulateur'

/** Combien de temps perdez-vous sur vos factures ? */
export function Simulateur() {
  const [factures, setFactures] = useState(15)
  const [minutes, setMinutes] = useState(12)
  const [taux, setTaux] = useState(50)
  const r = simuler({ facturesParMois: factures, minutesParFacture: minutes, tauxHoraire: taux })
  return (
    <div className="grid gap-6 rounded-l border border-trait bg-surface p-6 shadow-douce md:grid-cols-[minmax(0,1fr)_280px]">
      <div className="flex flex-col gap-5">
        <Curseur libelle="Factures par mois" valeur={factures} min={1} max={150} onChange={setFactures} />
        <Curseur libelle="Minutes par facture aujourd’hui" valeur={minutes} min={2} max={45} onChange={setMinutes} />
        <Curseur libelle="Valeur de votre heure (€ HT)" valeur={taux} min={15} max={200} pas={5} onChange={setTaux} />
      </div>
      <output aria-live="polite" className="flex flex-col justify-center gap-1 rounded-m bg-accent-doux p-5">
        <span className="text-[13px] text-encre-2">Chaque mois, Pastille vous rend</span>
        <span className="font-titre text-[40px] font-bold leading-none tabular-nums">{r.heuresGagnees.toLocaleString('fr-FR')} h</span>
        <span className="text-[15px] font-semibold text-accent">soit {r.euros.toLocaleString('fr-FR')} € de temps facturable</span>
        <span className="mt-2 text-[12.5px] text-encre-2">Sur la base de 30 secondes par facture pour un client existant.</span>
      </output>
    </div>
  )
}

function Curseur({ libelle, valeur, min, max, pas = 1, onChange }: { libelle: string; valeur: number; min: number; max: number; pas?: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-2 text-[14px] font-medium">
      <span className="flex justify-between">
        {libelle}
        <span className="num text-[15px]">{valeur}</span>
      </span>
      <input type="range" min={min} max={max} step={pas} value={valeur} onChange={(e) => onChange(Number(e.target.value))} className="accent-[var(--accent)]" />
    </label>
  )
}

/** Chronomètre « facture créée en 27 s », lancé quand il devient visible. */
export function Chronometre({ cible = 27 }: { cible?: number }) {
  const [valeur, setValeur] = useState(0)
  const zone = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = zone.current
    if (!el) return
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let minuterie: ReturnType<typeof setInterval> | undefined
    const observateur = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return
      observateur.disconnect()
      if (reduit) return setValeur(cible)
      let v = 0
      minuterie = setInterval(() => {
        v += 1
        setValeur(v)
        if (v >= cible) clearInterval(minuterie)
      }, 55)
    })
    observateur.observe(el)
    return () => {
      observateur.disconnect()
      clearInterval(minuterie)
    }
  }, [cible])
  return (
    <span ref={zone} className="inline-block min-w-[2ch] text-right tabular-nums" aria-label={`${cible} secondes`}>
      {valeur}
    </span>
  )
}
