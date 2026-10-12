import { BoutonLien } from '@/components/ui/Bouton'

export default function Introuvable() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <p className="surtitre">Erreur 404</p>
        <h1 className="text-[26px] font-bold">Page introuvable</h1>
        <p className="text-encre-2">
          Cette page n’existe pas, ou vous n’avez pas accès à l’entreprise demandée.
        </p>
        <BoutonLien href="/" variante="primaire" className="mt-2">
          Revenir à l’accueil
        </BoutonLien>
      </div>
    </main>
  )
}
