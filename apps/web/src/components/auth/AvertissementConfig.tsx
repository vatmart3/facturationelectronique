import { Message } from '@/components/ui/Message'

export function AvertissementConfig() {
  return (
    <Message ton="info">
      Supabase n’est pas encore configuré. Renseignez <code className="font-chiffre text-[12px]">NEXT_PUBLIC_SUPABASE_URL</code>{' '}
      et <code className="font-chiffre text-[12px]">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> dans{' '}
      <code className="font-chiffre text-[12px]">apps/web/.env.local</code>, puis relancez l’application.
    </Message>
  )
}
