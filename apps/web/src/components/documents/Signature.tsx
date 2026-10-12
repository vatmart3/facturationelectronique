'use client'

import { useActionState, useState } from 'react'
import { signerDevis, type EtatSignature } from '@/app/actions/public'
import { Bouton } from '@/components/ui/Bouton'
import { Case, Champ } from '@/components/ui/Champ'
import { Message } from '@/components/ui/Message'

/** Acceptation (« Bon pour accord ») ou refus d'un devis par le client. */
export function FormulaireSignature({ token, montant }: { token: string; montant: string }) {
  const [etat, envoyer, enCours] = useActionState<EtatSignature, FormData>(signerDevis.bind(null, token), null)
  const [refus, setRefus] = useState(false)
  // Champs contrôlés : React vide un formulaire après chaque action, y compris en cas d'erreur.
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [commentaire, setCommentaire] = useState('')
  const [accord, setAccord] = useState(false)
  if (etat?.decision) {
    return (
      <Message ton="succes">
        {etat.decision === 'accepte' ? 'Merci ! Votre accord a bien été enregistré.' : 'Votre réponse a bien été enregistrée.'}
      </Message>
    )
  }
  return (
    <form action={envoyer} className="flex flex-col gap-3 rounded-l border border-trait bg-surface p-4">
      <h2 className="text-[15px] font-semibold">{refus ? 'Refuser le devis' : 'Accepter le devis'}</h2>
      <input type="hidden" name="decision" value={refus ? 'refuse' : 'accepte'} />
      <Champ libelle="Nom et prénom" name="nom" required autoComplete="name" maxLength={120} value={nom} onChange={(e) => setNom(e.target.value)} />
      <Champ libelle="Email" name="email" type="email" autoComplete="email" facultatif value={email} onChange={(e) => setEmail(e.target.value)} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="commentaire" className="text-[13px] font-medium">
          Commentaire <span className="font-normal text-encre-3">· facultatif</span>
        </label>
        <textarea
          id="commentaire"
          name="commentaire"
          rows={2}
          maxLength={1000}
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          className="rounded-m border border-trait-fort bg-surface p-2.5 text-[14px] outline-none focus:border-accent" />
      </div>
      {!refus && (
        <Case
          name="accord"
          checked={accord}
          onChange={(e) => setAccord(e.target.checked)}
          libelle={`Bon pour accord pour ${montant}`}
          aide="Votre nom, la date et la version du devis sont conservés comme preuve."
        />
      )}
      {etat?.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      <Bouton type="submit" variante={refus ? 'danger' : 'primaire'} chargement={enCours}>
        {refus ? 'Confirmer le refus' : 'Accepter le devis'}
      </Bouton>
      <button type="button" onClick={() => setRefus((r) => !r)} className="text-[12.5px] text-encre-3 underline">
        {refus ? 'Revenir à l’acceptation' : 'Je souhaite refuser ce devis'}
      </button>
    </form>
  )
}
