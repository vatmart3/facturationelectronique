import { initiales, teinteAvatar, type TeinteAvatar } from '@/lib/avatar'
import { cn } from '@/lib/cn'

const TEINTES: Record<TeinteAvatar, string> = {
  info: 'bg-info-doux text-info',
  ok: 'bg-ok-doux text-ok',
  attente: 'bg-attente-doux text-attente',
  avoir: 'bg-avoir-doux text-avoir',
  alerte: 'bg-alerte-doux text-alerte',
  neutre: 'bg-neutre-doux text-neutre',
}

const TAILLES = {
  s: 'size-6 text-[10px]',
  m: 'size-8 text-[12px]',
  l: 'size-14 text-[19px]',
}

/** Avatar décoratif : le nom est toujours affiché à côté, l'avatar est donc masqué aux lecteurs d'écran. */
export function Avatar({ nom, taille = 'm', className }: { nom: string; taille?: keyof typeof TAILLES; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full font-titre font-semibold',
        TEINTES[teinteAvatar(nom)],
        TAILLES[taille],
        className,
      )}
    >
      {initiales(nom)}
    </span>
  )
}
