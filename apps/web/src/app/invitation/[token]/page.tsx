import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { accepterInvitation } from '@/app/actions/compte'
import { BoutonAction } from '@/components/documents/Actions'
import { Logo } from '@/components/marque/Logo'
import { classesBouton } from '@/components/ui/Bouton'
import { Message } from '@/components/ui/Message'
import { LIBELLES_ROLE, estRole } from '@/lib/roles'
import { lireUtilisateur } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Invitation', robots: { index: false } }

export default async function Invitation({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound()
  const supabase = await creerClientServeur()
  const { data } = await supabase.rpc('invitation', { p_token: token })
  const i = data as { organisation: string; email: string; role: string; expiree: boolean; acceptee: boolean } | null
  if (!i) notFound()
  const utilisateur = await lireUtilisateur()
  const suite = encodeURIComponent(`/invitation/${token}`)
  const bonCompte = utilisateur && utilisateur.email.toLowerCase() === i.email.toLowerCase()

  return (
    <main className="grid min-h-dvh place-items-center bg-fond px-4 py-10">
      <div className="flex w-full max-w-[440px] flex-col gap-5 rounded-l border border-trait bg-surface p-7 shadow-douce">
        <Logo />
        <div>
          <h1 className="text-[22px] font-bold">Rejoindre {i.organisation}</h1>
          <p className="mt-1 text-[14px] text-encre-2">
            Invitation pour {i.email}, rôle « {estRole(i.role) ? LIBELLES_ROLE[i.role] : i.role} ».
          </p>
        </div>
        {i.acceptee ? (
          <Message ton="info">Cette invitation a déjà été utilisée.</Message>
        ) : i.expiree ? (
          <Message ton="erreur">Cette invitation a expiré : demandez-en une nouvelle.</Message>
        ) : bonCompte ? (
          <BoutonAction action={accepterInvitation.bind(null, token) as () => Promise<{ ok: false; erreur: string }>} variante="primaire">
            {`Rejoindre ${i.organisation}`}
          </BoutonAction>
        ) : utilisateur ? (
          <Message ton="erreur">
            Vous êtes connecté avec {utilisateur.email}. Déconnectez-vous puis connectez-vous avec {i.email}.
          </Message>
        ) : (
          <div className="flex flex-col gap-2">
            <Link href={`/inscription?suite=${suite}&email=${encodeURIComponent(i.email)}`} className={classesBouton('primaire')}>
              Créer mon compte
            </Link>
            <Link href={`/connexion?suite=${suite}`} className={classesBouton('secondaire')}>
              J’ai déjà un compte
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
