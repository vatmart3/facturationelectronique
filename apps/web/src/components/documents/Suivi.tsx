'use client'

import { useActionState, useState, useTransition, type ReactNode } from 'react'
import { partagerDocument, type EtatSuivi } from '@/app/actions/suivi'
import { Bouton } from '@/components/ui/Bouton'
import { Message } from '@/components/ui/Message'
import { cn } from '@/lib/cn'

const CHAMP =
  'h-[34px] w-full min-w-0 rounded-m border border-trait-fort bg-surface px-2.5 text-[13.5px] outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-doux)]'

export function ChampSuivi({ libelle, children, className }: { libelle: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('flex min-w-0 flex-col gap-1 text-[12.5px] font-medium text-encre-2', className)}>
      {libelle}
      {children}
    </label>
  )
}

/** Formulaire d'action serveur avec message de retour (succès ou erreur). */
export function FormulaireSuivi({
  action,
  bouton,
  children,
  variante = 'primaire',
  className,
}: {
  action: (etat: EtatSuivi, f: FormData) => Promise<EtatSuivi>
  bouton: string
  children?: ReactNode
  variante?: 'primaire' | 'secondaire'
  className?: string
}) {
  const [etat, envoyer, enCours] = useActionState(action, null)
  return (
    <form action={envoyer} className={cn('flex flex-col gap-2.5', className)}>
      {children}
      <Bouton type="submit" variante={variante} chargement={enCours} className="self-start">
        {bouton}
      </Bouton>
      {etat?.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat?.message && <Message ton="succes">{etat.message}</Message>}
    </form>
  )
}

export function ChampsPaiement({ reste, jour }: { reste: string; jour: string }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <ChampSuivi libelle="Montant">
        <input name="montant" defaultValue={reste} inputMode="decimal" required className={cn(CHAMP, 'num')} />
      </ChampSuivi>
      <ChampSuivi libelle="Date">
        <input name="date" type="date" defaultValue={jour} max={jour} required className={CHAMP} />
      </ChampSuivi>
      <ChampSuivi libelle="Moyen">
        <select name="moyen" defaultValue="virement" className={CHAMP}>
          <option value="virement">Virement</option>
          <option value="carte">Carte bancaire</option>
          <option value="prelevement">Prélèvement</option>
          <option value="cheque">Chèque</option>
          <option value="especes">Espèces</option>
          <option value="autre">Autre</option>
        </select>
      </ChampSuivi>
      <ChampSuivi libelle="Référence">
        <input name="reference" maxLength={140} placeholder="Facultatif" className={CHAMP} />
      </ChampSuivi>
    </div>
  )
}

export function ChampsEnvoi({ destinataire }: { destinataire: string | null }) {
  return (
    <>
      <ChampSuivi libelle="Destinataire">
        <input name="destinataire" type="email" defaultValue={destinataire ?? ''} required placeholder="comptabilite@client.fr" className={CHAMP} />
      </ChampSuivi>
      <ChampSuivi libelle="Message (facultatif)">
        <textarea name="message" rows={3} maxLength={2000} placeholder="Un texte standard est utilisé sinon." className={cn(CHAMP, 'h-auto py-2')} />
      </ChampSuivi>
    </>
  )
}

export function ChampsRecurrence({ jour, nom }: { jour: string; nom: string }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <ChampSuivi libelle="Nom" className="col-span-2">
        <input name="nom" defaultValue={nom} maxLength={120} className={CHAMP} />
      </ChampSuivi>
      <ChampSuivi libelle="Fréquence">
        <select name="frequence" defaultValue="mensuelle" className={CHAMP}>
          <option value="mensuelle">Tous les mois</option>
          <option value="trimestrielle">Tous les trimestres</option>
          <option value="semestrielle">Tous les six mois</option>
          <option value="annuelle">Tous les ans</option>
        </select>
      </ChampSuivi>
      <ChampSuivi libelle="Prochaine facture">
        <input name="debut" type="date" defaultValue={jour} min={jour} required className={CHAMP} />
      </ChampSuivi>
      <ChampSuivi libelle="Fin (facultatif)">
        <input name="fin" type="date" min={jour} className={CHAMP} />
      </ChampSuivi>
      <ChampSuivi libelle="À chaque échéance">
        <select name="mode" defaultValue="brouillon" className={CHAMP}>
          <option value="brouillon">Préparer un brouillon</option>
          <option value="emission">Émettre et envoyer</option>
        </select>
      </ChampSuivi>
      <p className="col-span-2 text-[12px] text-encre-3">
        Écrivez {'{periode}'} ou {'{mois}'} dans une désignation : « Maintenance {'{periode}'} » devient « Maintenance novembre 2026 ».
      </p>
    </div>
  )
}

/** Lien public du document (consultation, paiement, signature d'un devis). */
export function Partage({ slug, documentId, token, origine }: { slug: string; documentId: string; token: string | null; origine: string }) {
  const [jeton, setJeton] = useState(token)
  const [copie, setCopie] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, demarrer] = useTransition()
  const lien = jeton ? `${origine}/d/${jeton}` : null
  if (!lien) {
    return (
      <div className="flex flex-col gap-1.5">
        <Bouton
          variante="secondaire"
          chargement={enCours}
          onClick={() =>
            demarrer(async () => {
              const r = await partagerDocument(slug, documentId)
              if (r.ok) setJeton(r.token)
              else setErreur(r.erreur)
            })
          }
        >
          Créer un lien de partage
        </Bouton>
        {erreur && <Message ton="erreur">{erreur}</Message>}
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <input readOnly value={lien} aria-label="Lien de partage" className={cn(CHAMP, 'num text-[12px]')} onFocus={(e) => e.currentTarget.select()} />
      <Bouton
        variante="secondaire"
        taille="s"
        onClick={() => {
          void navigator.clipboard?.writeText(lien)
          setCopie(true)
        }}
      >
        {copie ? 'Copié' : 'Copier'}
      </Bouton>
    </div>
  )
}
