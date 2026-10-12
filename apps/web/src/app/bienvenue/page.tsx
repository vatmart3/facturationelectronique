import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Logo } from '@/components/marque/Logo'
import { FormulaireCreation } from '@/components/organisation/FormulaireCreation'
import { Avatar } from '@/components/ui/Avatar'
import { LIBELLES_ROLE } from '@/lib/roles'
import { exigerUtilisateur, listerOrganisations } from '@/lib/session'

export const metadata: Metadata = { title: 'Bienvenue' }

export default async function Bienvenue({ searchParams }: { searchParams: Promise<{ nouvelle?: string }> }) {
  const utilisateur = await exigerUtilisateur()
  const organisations = await listerOrganisations()
  const { nouvelle } = await searchParams
  if (organisations.length > 0 && !nouvelle) redirect(`/${organisations[0]!.slug}/tableau-de-bord`)

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <Logo />
      </div>
      <div className="flex w-full max-w-[440px] flex-col gap-6 rounded-xl border border-trait bg-surface p-6 shadow-douce sm:p-8">
        <div className="flex flex-col gap-1.5">
          <p className="surtitre">{organisations.length === 0 ? 'Première étape' : 'Nouvelle entreprise'}</p>
          <h1 className="text-[24px] font-bold">
            {organisations.length === 0 ? `Bienvenue${utilisateur.nom ? `, ${utilisateur.nom.split(' ')[0]}` : ''}` : 'Ajouter une entreprise'}
          </h1>
          <p className="text-encre-2">Pour quelle entreprise allez-vous facturer ?</p>
        </div>
        <FormulaireCreation />
      </div>
      {organisations.length > 0 && (
        <div className="mt-6 flex w-full max-w-[440px] flex-col gap-2">
          <p className="surtitre px-1">Vos entreprises</p>
          {organisations.map((o) => (
            <Link
              key={o.slug}
              href={`/${o.slug}/tableau-de-bord`}
              className="flex items-center gap-3 rounded-l border border-trait bg-surface px-3 py-2.5 hover:border-trait-fort"
            >
              <Avatar nom={o.nom} />
              <span className="min-w-0 flex-1 truncate font-medium">{o.nom}</span>
              <span className="text-[12.5px] text-encre-3">{LIBELLES_ROLE[o.role]}</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
