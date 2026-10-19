import type { ReactNode } from 'react'
import { SessionDepuisLien } from '@/components/auth/SessionDepuisLien'
import { Logo } from '@/components/marque/Logo'

export default function LayoutAuth({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="zone-nuit fond-nuit hidden flex-col justify-between p-10 lg:flex">
        <Logo />
        <div className="flex max-w-md flex-col gap-5">
          <p className="surtitre text-accent">Facturation électronique · réforme 2026-2027</p>
          <p className="font-titre text-[30px] font-bold leading-[1.15] tracking-[-0.02em]">
            Des factures conformes, un suivi client clair, prêts pour le 1er septembre 2027.
          </p>
          <ul className="flex flex-col gap-2.5 text-[14px] text-encre-2">
            <li className="flex gap-2.5">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
              Factur-X, UBL et CII, transmis via une plateforme agréée.
            </li>
            <li className="flex gap-2.5">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
              Numérotation continue, factures émises inaltérables, archivage 10 ans.
            </li>
            <li className="flex gap-2.5">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
              Données hébergées dans l’Union européenne.
            </li>
          </ul>
        </div>
        <p className="text-[12.5px] text-encre-3">© {new Date().getFullYear()} Pastille · Données hébergées dans l’Union européenne</p>
      </aside>
      <main className="flex flex-col items-center justify-center px-4 py-12 sm:px-8">
        <SessionDepuisLien />
        <div className="mb-8 lg:hidden">
          <Logo />
        </div>
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
    </div>
  )
}
