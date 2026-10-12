import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Icone } from './Icone'

const TONS = {
  erreur: { classes: 'border-alerte/30 bg-alerte-doux text-alerte', icone: 'alerte' as const },
  succes: { classes: 'border-ok/30 bg-ok-doux text-ok', icone: 'coche' as const },
  info: { classes: 'border-info/30 bg-info-doux text-info', icone: 'aide' as const },
}

export function Message({ ton, children, className }: { ton: keyof typeof TONS; children: ReactNode; className?: string }) {
  const t = TONS[ton]
  return (
    <div
      role={ton === 'erreur' ? 'alert' : 'status'}
      className={cn('flex items-start gap-2 rounded-m border px-3 py-2.5 text-[13.5px]', t.classes, className)}
    >
      <Icone nom={t.icone} taille={15} className="mt-0.5 shrink-0" />
      <div className="min-w-0 text-encre">{children}</div>
    </div>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-[5px] border border-trait bg-surface-2 px-1.5 py-px font-chiffre text-[11px] text-encre-2">{children}</kbd>
  )
}
