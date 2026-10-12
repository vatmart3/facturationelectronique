import type { ReactNode } from 'react'

export function EtatVide({ titre, children, action }: { titre: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-l border border-dashed border-trait-fort px-6 py-12 text-center text-encre-2">
      <h2 className="text-[17px] font-semibold text-encre">{titre}</h2>
      {children && <div className="max-w-[52ch] text-[14px]">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
