import { cn } from '@/lib/cn'

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-titre text-[17px] font-bold tracking-[-0.02em]', className)}>
      <span className="size-2.5 rounded-full bg-marque" aria-hidden="true" />
      pastille
    </span>
  )
}
