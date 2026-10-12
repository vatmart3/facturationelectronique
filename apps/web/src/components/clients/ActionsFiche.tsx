'use client'

import { useActionState } from 'react'
import { ajouterContact, definirPrixClient, type EtatSimple } from '@/app/actions/clients'
import { Bouton } from '@/components/ui/Bouton'
import { Case, Champ, Selection } from '@/components/ui/Champ'
import { Message } from '@/components/ui/Message'
import { formatMontant } from '@/lib/format'

export function FormulaireContact({ slug, clientId }: { slug: string; clientId: string }) {
  const [etat, action, enCours] = useActionState<EtatSimple, FormData>(ajouterContact.bind(null, slug, clientId), {})
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2" noValidate>
      {etat.erreur && <Message ton="erreur" className="sm:col-span-2">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes" className="sm:col-span-2">{etat.succes}</Message>}
      <Champ libelle="Nom" name="name" required />
      <Champ libelle="Fonction" name="role" facultatif />
      <Champ libelle="Email" name="email" type="email" facultatif />
      <Champ libelle="Téléphone" name="phone" type="tel" facultatif />
      <Case libelle="Reçoit les factures" name="receives_invoices" defaultChecked className="sm:col-span-2" />
      <div className="sm:col-span-2">
        <Bouton type="submit" variante="primaire" taille="s" chargement={enCours} icone="plus">
          Ajouter le contact
        </Bouton>
      </div>
    </form>
  )
}

export function FormulairePrix({
  slug,
  clientId,
  produits,
}: {
  slug: string
  clientId: string
  produits: Array<{ id: string; name: string; unit_price_cents: number }>
}) {
  const [etat, action, enCours] = useActionState<EtatSimple, FormData>(definirPrixClient.bind(null, slug, clientId), {})
  if (produits.length === 0) {
    return <p className="text-[13.5px] text-encre-3">Ajoutez d’abord des articles au catalogue pour leur donner un prix propre à ce client.</p>
  }
  return (
    <form action={action} className="grid items-end gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]" noValidate>
      {etat.erreur && <Message ton="erreur" className="sm:col-span-3">{etat.erreur}</Message>}
      <Selection
        libelle="Article"
        name="product_id"
        options={produits.map((p) => ({ valeur: p.id, libelle: `${p.name} · ${formatMontant(p.unit_price_cents)} HT` }))}
      />
      <Champ libelle="Prix pour ce client" name="price" suffixe="€ HT" chiffres inputMode="decimal" required />
      <Bouton type="submit" variante="primaire" chargement={enCours} className="h-[38px]">
        Enregistrer
      </Bouton>
    </form>
  )
}
