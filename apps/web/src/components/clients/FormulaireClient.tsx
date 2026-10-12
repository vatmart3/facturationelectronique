'use client'

import { useActionState, useState, type ReactNode } from 'react'
import { enregistrerClient, type EtatClient } from '@/app/actions/clients'
import { Bouton, BoutonLien } from '@/components/ui/Bouton'
import { Case, Champ, Selection } from '@/components/ui/Champ'
import { Message } from '@/components/ui/Message'
import { Panneau, PanneauCorps, PanneauPied, PanneauTete } from '@/components/ui/Panneau'
import { CONDITIONS_PAIEMENT, TYPES_CLIENT } from '@/lib/clients'
import { cn } from '@/lib/cn'
import type { EntrepriseTrouvee } from '@/lib/entreprises'
import { MENTIONS, type TypeClient } from '@/lib/fiscalite'
import { grouperChiffres } from '@/lib/format'
import { centimesEnSaisie } from '@/lib/montant'
import type { ClientRow } from '@/lib/supabase/types'
import { RechercheEntreprise } from './RechercheEntreprise'

function Section({ titre, description, children }: { titre: string; description?: string; children: ReactNode }) {
  return (
    <Panneau>
      <PanneauTete titre={titre} description={description} />
      <PanneauCorps>
        <div className="grid gap-4 sm:grid-cols-2">{children}</div>
      </PanneauCorps>
    </Panneau>
  )
}

const pourcentage = (points: number | null) => (points === null ? '' : String(points / 100).replace('.', ','))

export function FormulaireClient({ slug, client }: { slug: string; client?: ClientRow }) {
  const action = enregistrerClient.bind(null, slug, client?.id ?? null)
  const [etat, envoyer, enCours] = useActionState<EtatClient, FormData>(action, {})
  const e = etat.erreurs ?? {}
  const [kind, setKind] = useState<TypeClient>(client?.kind ?? 'b2b')
  const [livraison, setLivraison] = useState(client?.shipping_different ?? false)
  const [identite, setIdentite] = useState({
    name: client?.name ?? '',
    legal_form: client?.legal_form ?? '',
    siren: client?.siren ? grouperChiffres(client.siren) : '',
    siret: client?.siret ?? '',
    vat_number: client?.vat_number ?? '',
    billing_line1: client?.billing_line1 ?? '',
    billing_postal_code: client?.billing_postal_code ?? '',
    billing_city: client?.billing_city ?? '',
  })
  const champ = (cle: keyof typeof identite) => ({
    name: cle,
    value: identite[cle],
    onChange: (ev: React.ChangeEvent<HTMLInputElement>) => setIdentite((i) => ({ ...i, [cle]: ev.target.value })),
  })

  function remplir(ent: EntrepriseTrouvee) {
    setIdentite((i) => ({
      ...i,
      name: ent.nom,
      legal_form: ent.formeJuridique ?? i.legal_form,
      siren: grouperChiffres(ent.siren),
      siret: ent.siret ?? '',
      vat_number: '',
      billing_line1: ent.adresse ?? '',
      billing_postal_code: ent.codePostal ?? '',
      billing_city: ent.ville ?? '',
    }))
  }

  const francaise = kind === 'b2b' || kind === 'b2g'
  const motifParDefaut = kind === 'ue' ? MENTIONS.autoliquidationUe : kind === 'hors_ue' ? MENTIONS.export : ''

  return (
    <form action={envoyer} className="flex flex-col gap-[18px]" noValidate>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}

      <Panneau>
        <PanneauTete titre="Catégorie" description="Elle détermine la TVA appliquée, les mentions et le canal de transmission." />
        <PanneauCorps>
          <fieldset className="m-0 grid gap-2 border-0 p-0 sm:grid-cols-5">
            <legend className="sr-only">Catégorie du client</legend>
            {TYPES_CLIENT.map((t) => (
              <label
                key={t.valeur}
                className={cn(
                  'flex cursor-pointer flex-col gap-1 rounded-m border p-3 text-[13px] transition-colors',
                  kind === t.valeur ? 'border-accent bg-accent-doux' : 'border-trait hover:border-trait-fort',
                )}
              >
                <span className="flex items-center gap-2 font-semibold">
                  <input type="radio" name="kind" value={t.valeur} checked={kind === t.valeur} onChange={() => setKind(t.valeur)} className="accent-[var(--accent)]" />
                  {t.libelle}
                </span>
                <span className="text-[12px] leading-snug text-encre-3">{t.aide}</span>
              </label>
            ))}
          </fieldset>
          {e.kind && <p className="text-[12.5px] text-alerte">{e.kind}</p>}
        </PanneauCorps>
      </Panneau>

      <Section titre="Identité" description={francaise ? 'Recherchez l’entreprise pour remplir la fiche automatiquement.' : undefined}>
        {francaise && (
          <div className="sm:col-span-2">
            <RechercheEntreprise onChoix={remplir} />
          </div>
        )}
        <Champ libelle={kind === 'b2c' ? 'Nom et prénom' : 'Raison sociale'} {...champ('name')} erreur={e.name} classeCadre="sm:col-span-2" required />
        {kind !== 'b2c' && <Champ libelle="Forme juridique" {...champ('legal_form')} facultatif />}
        {francaise && (
          <>
            <Champ libelle="SIREN" {...champ('siren')} chiffres inputMode="numeric" erreur={e.siren} facultatif={kind === 'b2g'} />
            <Champ libelle="SIRET" {...champ('siret')} chiffres inputMode="numeric" erreur={e.siret} facultatif />
          </>
        )}
        {kind !== 'b2c' && (
          <Champ
            libelle="N° de TVA intracommunautaire"
            {...champ('vat_number')}
            chiffres
            erreur={e.vat_number}
            facultatif={kind !== 'ue'}
            aide={kind === 'b2b' ? 'Calculé automatiquement depuis le SIREN si vous le laissez vide.' : undefined}
          />
        )}
        {francaise && (
          <Champ
            libelle="Adresse de facturation électronique"
            name="einvoice_address"
            defaultValue={client?.einvoice_address ?? ''}
            chiffres
            facultatif
            aide="Identifiant de routage de l’annuaire national, fourni par la plateforme agréée."
          />
        )}
        {kind === 'b2g' && (
          <Champ libelle="Code service (Chorus Pro)" name="service_code" defaultValue={client?.service_code ?? ''} facultatif />
        )}
      </Section>

      <Section titre="Adresse de facturation">
        <Champ libelle="Adresse" {...champ('billing_line1')} autoComplete="address-line1" classeCadre="sm:col-span-2" />
        <Champ
          libelle="Complément"
          name="billing_line2"
          defaultValue={client?.billing_line2 ?? ''}
          autoComplete="address-line2"
          classeCadre="sm:col-span-2"
          facultatif
        />
        <Champ libelle="Code postal" {...champ('billing_postal_code')} autoComplete="postal-code" />
        <Champ libelle="Ville" {...champ('billing_city')} autoComplete="address-level2" />
        <Champ
          libelle="Pays"
          name="billing_country"
          defaultValue={client?.billing_country ?? (kind === 'b2b' || kind === 'b2g' || kind === 'b2c' ? 'FR' : '')}
          key={`pays-${kind}`}
          maxLength={2}
          chiffres
          erreur={e.billing_country}
          aide="Code ISO à 2 lettres, par exemple FR, DE, GB."
        />
        <Case
          libelle="Adresse de livraison différente"
          name="shipping_different"
          checked={livraison}
          onChange={(ev) => setLivraison(ev.target.checked)}
          className="sm:col-span-2"
        />
        {livraison && (
          <>
            <Champ libelle="Adresse de livraison" name="shipping_line1" defaultValue={client?.shipping_line1 ?? ''} classeCadre="sm:col-span-2" />
            <Champ libelle="Complément" name="shipping_line2" defaultValue={client?.shipping_line2 ?? ''} classeCadre="sm:col-span-2" facultatif />
            <Champ libelle="Code postal" name="shipping_postal_code" defaultValue={client?.shipping_postal_code ?? ''} />
            <Champ libelle="Ville" name="shipping_city" defaultValue={client?.shipping_city ?? ''} />
            <Champ libelle="Pays" name="shipping_country" defaultValue={client?.shipping_country ?? 'FR'} maxLength={2} chiffres erreur={e.shipping_country} />
          </>
        )}
      </Section>

      {!client && (
        <Section titre="Contact de facturation" description="La personne qui reçoit les factures. Vous pourrez en ajouter d’autres.">
          <Champ libelle="Nom" name="contact_name" autoComplete="name" facultatif />
          <Champ libelle="Email" name="contact_email" type="email" autoComplete="email" facultatif />
        </Section>
      )}

      <Section titre="Réglages commerciaux" description="Appliqués automatiquement à chaque nouvelle facture de ce client.">
        <Selection
          libelle="Régime de TVA"
          name="default_vat_category"
          defaultValue={client?.default_vat_category ?? ''}
          options={[
            { valeur: '', libelle: 'Automatique selon la catégorie' },
            { valeur: 'S', libelle: 'TVA française' },
            { valeur: 'AE', libelle: 'Autoliquidation' },
            { valeur: 'K', libelle: 'Livraison intracommunautaire' },
            { valeur: 'G', libelle: 'Exportation' },
            { valeur: 'E', libelle: 'Exonération (motif ci-dessous)' },
          ]}
          erreur={e.default_vat_category}
        />
        <Champ
          libelle="Taux de TVA par défaut"
          name="default_vat_rate"
          defaultValue={pourcentage(client?.default_vat_rate ?? null)}
          suffixe="%"
          chiffres
          inputMode="decimal"
          erreur={e.default_vat_rate}
          aide="Laissez vide pour utiliser le taux de chaque article."
          facultatif
        />
        <Champ
          libelle="Motif d’exonération ou mention"
          name="exemption_reason"
          defaultValue={client?.exemption_reason ?? motifParDefaut}
          key={`motif-${kind}`}
          classeCadre="sm:col-span-2"
          aide="Imprimé sur la facture quand aucune TVA n’est appliquée. Exemple : Autoliquidation, art. 283-2 nonies du CGI."
          facultatif
        />
        <Selection
          libelle="Type de remise"
          name="default_discount_kind"
          defaultValue={client?.default_discount_kind ?? 'pourcentage'}
          options={[
            { valeur: 'pourcentage', libelle: 'Pourcentage' },
            { valeur: 'montant', libelle: 'Montant HT' },
          ]}
        />
        <Champ
          libelle="Remise par défaut"
          name="default_discount_value"
          defaultValue={
            client?.default_discount_value == null
              ? ''
              : client.default_discount_kind === 'montant'
                ? centimesEnSaisie(client.default_discount_value)
                : pourcentage(client.default_discount_value)
          }
          chiffres
          inputMode="decimal"
          erreur={e.default_discount_value}
          facultatif
        />
        <Selection
          libelle="Conditions de paiement"
          name="payment_terms"
          defaultValue={client?.payment_terms ?? ''}
          options={[{ valeur: '', libelle: 'Celles de l’entreprise' }, ...CONDITIONS_PAIEMENT]}
        />
        <Champ
          libelle="Escompte pour paiement anticipé"
          name="early_payment_discount"
          defaultValue={client?.early_payment_discount ?? ''}
          facultatif
        />
        <Champ libelle="Devise" name="currency" defaultValue={client?.currency ?? 'EUR'} maxLength={3} chiffres erreur={e.currency} />
        <Selection
          libelle="Langue des factures"
          name="language"
          defaultValue={client?.language ?? 'fr'}
          options={[
            { valeur: 'fr', libelle: 'Français' },
            { valeur: 'en', libelle: 'Anglais' },
          ]}
        />
        <Champ
          libelle="Mentions particulières"
          name="custom_mentions"
          defaultValue={client?.custom_mentions ?? ''}
          classeCadre="sm:col-span-2"
          aide="Référence de marché, conditions spécifiques… Imprimées sur chaque facture."
          facultatif
        />
        <Case
          libelle="Numéro de bon de commande obligatoire"
          name="purchase_order_required"
          defaultChecked={client?.purchase_order_required ?? false}
          aide="L’émission sera bloquée tant qu’il n’est pas renseigné."
        />
        <Case
          libelle="Relances automatiques"
          name="reminders_enabled"
          value="on"
          defaultChecked={client?.reminders_enabled ?? true}
          aide="Désactivez-les pour un client que vous relancez vous-même."
        />
        <input type="hidden" name="reminders_enabled" value="off" />
      </Section>

      <Panneau>
        <PanneauTete titre="Notes internes" description="Visibles uniquement par votre équipe." />
        <PanneauCorps>
          <label htmlFor="notes" className="sr-only">
            Notes internes
          </label>
          <textarea
            id="notes"
            name="notes"
            defaultValue={client?.notes ?? ''}
            rows={4}
            maxLength={5000}
            className="w-full rounded-m border border-trait-fort bg-surface p-3 text-[14px] outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-doux)]"
          />
        </PanneauCorps>
        <PanneauPied>
          <BoutonLien href={client ? `/${slug}/clients/${client.id}` : `/${slug}/clients`} variante="fantome">
            Annuler
          </BoutonLien>
          <Bouton type="submit" variante="primaire" chargement={enCours}>
            {client ? 'Enregistrer' : 'Créer le client'}
          </Bouton>
        </PanneauPied>
      </Panneau>
    </form>
  )
}
