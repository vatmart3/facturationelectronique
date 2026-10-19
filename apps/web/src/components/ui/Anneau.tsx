import type { ReactNode } from 'react'

export interface Part {
  libelle: string
  valeur: number
  /** Variable CSS de la couleur, ex. `var(--ok)`. */
  couleur: string
  detail?: ReactNode
}

/** Graphique en anneau avec sa légende chiffrée ; le total s'affiche au centre. La légende porte l'information, le dessin est décoratif. */
export function Anneau({ parts, total, unite }: { parts: Part[]; total: ReactNode; unite: string }) {
  const somme = parts.reduce((s, p) => s + p.valeur, 0)
  let cumul = 0
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
      <div className="relative size-36 shrink-0">
        <svg viewBox="0 0 42 42" className="size-full -rotate-90" aria-hidden="true">
          <circle cx="21" cy="21" r="15.915" fill="none" stroke="var(--fond)" strokeWidth="5" />
          {somme > 0 &&
            parts
              .filter((p) => p.valeur > 0)
              .map((p) => {
                const part = (p.valeur / somme) * 100
                const debut = cumul
                cumul += part
                return (
                  <circle
                    key={p.libelle}
                    cx="21"
                    cy="21"
                    r="15.915"
                    fill="none"
                    stroke={p.couleur}
                    strokeWidth="5"
                    strokeDasharray={`${part} ${100 - part}`}
                    strokeDashoffset={-debut}
                  />
                )
              })}
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <span className="text-[24px] font-bold leading-none tabular-nums">{total}</span>
          <span className="mt-1 text-[11.5px] text-encre-3">{unite}</span>
        </div>
      </div>
      <ul className="m-0 flex min-w-[180px] flex-1 list-none flex-col p-0">
        {parts.map((p) => (
          <li key={p.libelle} className="flex items-center justify-between gap-3 border-b border-trait py-2 text-[13.5px] last:border-b-0">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: p.couleur }} aria-hidden="true" />
              <span className="truncate text-encre-2">{p.libelle}</span>
            </span>
            <span className="flex shrink-0 items-baseline gap-2">
              {p.detail && <span className="text-[12px] text-encre-3">{p.detail}</span>}
              <span className="font-semibold tabular-nums">{p.valeur}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
