import type { ReactNode } from 'react'

export function EnTeteVue({ titre, description, actions }: { titre: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3.5">
      <div className="min-w-0">
        <h1 className="text-[24px] font-bold leading-tight">{titre}</h1>
        {description && <p className="mt-1 text-[13.5px] text-encre-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
