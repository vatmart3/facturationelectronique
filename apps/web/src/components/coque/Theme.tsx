'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'

type Theme = 'systeme' | 'clair' | 'sombre'

function appliquer(t: Theme) {
  const racine = document.documentElement
  if (t === 'clair') racine.dataset.theme = 'light'
  else if (t === 'sombre') racine.dataset.theme = 'dark'
  else delete racine.dataset.theme
  try {
    if (t === 'systeme') localStorage.removeItem('pastille-theme')
    else localStorage.setItem('pastille-theme', t)
  } catch {
    // Stockage indisponible (navigation privée) : le choix vaut pour la page en cours.
  }
}

export function ChoixTheme({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('systeme')
  useEffect(() => {
    try {
      const t = localStorage.getItem('pastille-theme')
      // Lecture unique au montage d'une préférence stockée hors de React.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (t === 'clair' || t === 'sombre') setTheme(t)
    } catch {}
  }, [])
  const options: Array<{ v: Theme; l: string }> = [
    { v: 'systeme', l: 'Auto' },
    { v: 'clair', l: 'Clair' },
    { v: 'sombre', l: 'Sombre' },
  ]
  return (
    <div role="group" aria-label="Thème" className={cn('flex rounded-m border border-trait bg-surface p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          aria-pressed={theme === o.v}
          onClick={() => {
            setTheme(o.v)
            appliquer(o.v)
          }}
          className={cn('h-6 flex-1 rounded-[5px] px-2 text-[11.5px] font-medium', theme === o.v ? 'bg-encre text-surface' : 'text-encre-2 hover:bg-survol')}
        >
          {o.l}
        </button>
      ))}
    </div>
  )
}
