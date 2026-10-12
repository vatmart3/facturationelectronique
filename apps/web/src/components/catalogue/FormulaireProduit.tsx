'use client'

import { useActionState } from 'react'
import { enregistrerProduit, type EtatProduit } from '@/app/actions/produits'
import { Bouton, BoutonLien } from '@/components/ui/Bouton'
import { Case, Champ, Selection } from '@/components/ui/Champ'
import { Message } from '@/components/ui/Message'
import { Panneau, PanneauCorps, PanneauPied, PanneauTete } from '@/components/ui/Panneau'
import { centimesEnSaisie } from '@/lib/montant'
import { NATURES, TAUX_TVA, UNITES } from '@/lib/produits'
import type { ProductRow } from '@/lib/supabase/types'

export function FormulaireProduit({ slug, produit, categories }: { slug: string; produit?: ProductRow; categories: string[] }) {
  const [etat, envoyer, enCours] = useActionState<EtatProduit, FormData>(enregistrerProduit.bind(null, slug, produit?.id ?? null), {})
  const e = etat.erreurs ?? {}
  const tvaActuelle = produit ? `${produit.vat_category}:${produit.vat_rate}` : 'S:2000'
  const tvaConnue = TAUX_TVA.some((t) => t.valeur === tvaActuelle)

  return (
    <form action={envoyer} className="flex flex-col gap-[18px]" noValidate>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      <Panneau>
        <PanneauTete titre="Article ou prestation" />
        <PanneauCorps>
          <div className="grid gap-4 sm:grid-cols-2">
            <Champ libelle="Désignation" name="name" defaultValue={produit?.name} required erreur={e.name} classeCadre="sm:col-span-2" />
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="description" className="text-[13px] font-medium">
                Description <span className="font-normal text-encre-3">· facultatif</span>
              </label>
              <textarea
                id="description"
                name="description"
                defaultValue={produit?.description ?? ''}
                rows={3}
                maxLength={2000}
                className="rounded-m border border-trait-fort bg-surface p-3 text-[14px] outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-doux)]"
              />
            </div>
            <Selection libelle="Nature" name="nature" defaultValue={produit?.nature ?? 'service'} options={NATURES} aide="Alimente la mention « catégorie de l’opération »." />
            <Champ libelle="Référence" name="reference" defaultValue={produit?.reference ?? ''} facultatif />
            <Champ
              libelle="Prix unitaire"
              name="price"
              defaultValue={produit ? centimesEnSaisie(produit.unit_price_cents) : ''}
              chiffres
              inputMode="decimal"
              required
              erreur={e.prix}
            />
            <Selection
              libelle="Prix saisi"
              name="price_mode"
              defaultValue="ht"
              options={[
                { valeur: 'ht', libelle: 'Hors taxes' },
                { valeur: 'ttc', libelle: 'Toutes taxes comprises (converti en HT)' },
              ]}
            />
            <Selection
              libelle="TVA"
              name="vat"
              defaultValue={tvaConnue ? tvaActuelle : 'S:2000'}
              options={TAUX_TVA}
              erreur={e.vat_rate}
              aide="Le régime du client (UE, export, franchise) s’applique automatiquement à la facturation."
            />
            <Champ libelle="Unité" name="unit" defaultValue={produit?.unit ?? 'unité'} list="unites" erreur={e.unit} />
            <datalist id="unites">
              {UNITES.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
            <Champ libelle="Catégorie" name="category" defaultValue={produit?.category ?? ''} list="categories" facultatif />
            <datalist id="categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <Champ
              libelle="Compte comptable"
              name="accounting_account"
              defaultValue={produit?.accounting_account ?? ''}
              chiffres
              erreur={e.accounting_account}
              aide="Par exemple 706000 pour les prestations, 707000 pour les ventes de marchandises."
              facultatif
            />
            <Case libelle="Favori" name="favorite" defaultChecked={produit?.favorite ?? false} aide="Proposé en premier dans l’éditeur de factures." />
          </div>
        </PanneauCorps>
        <PanneauPied>
          <BoutonLien href={`/${slug}/catalogue`} variante="fantome">
            Annuler
          </BoutonLien>
          <Bouton type="submit" variante="primaire" chargement={enCours}>
            {produit ? 'Enregistrer' : 'Ajouter au catalogue'}
          </Bouton>
        </PanneauPied>
      </Panneau>
    </form>
  )
}
