import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Tableau({ children, legende, largeurMin = 720 }: { children: ReactNode; legende: string; largeurMin?: number }) {
  return (
    // Zone défilante focusable et nommée : consultable au clavier sur petit écran.
    <div role="region" aria-label={legende} tabIndex={0} className="overflow-x-auto rounded-l border border-trait bg-surface">
      <table className="w-full border-collapse" style={{ minWidth: largeurMin }}>
        <caption className="sr-only">{legende}</caption>
        {children}
      </table>
    </div>
  )
}

export function Th({ numerique, className, ...props }: ThHTMLAttributes<HTMLTableCellElement> & { numerique?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap border-b border-trait bg-surface-2 px-3.5 py-2.5 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-encre-3',
        numerique ? 'text-right' : 'text-left',
        className,
      )}
      {...props}
    />
  )
}

export function Td({ numerique, className, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { numerique?: boolean }) {
  return (
    <td
      className={cn(
        'border-b border-trait px-3.5 py-[11px] align-middle [tr:last-child_&]:border-b-0',
        numerique && 'num text-right',
        className,
      )}
      {...props}
    />
  )
}
