'use client'

import { useActionState, type ReactNode } from 'react'
import { enregistrerIdentite, type EtatIdentite } from '@/app/actions/organisation'
import { Bouton } from '@/components/ui/Bouton'
import { Case, Champ, Selection } from '@/components/ui/Champ'
import { Message } from '@/components/ui/Message'
import { Panneau, PanneauCorps, PanneauPied, PanneauTete } from '@/components/ui/Panneau'
import { formatIban, grouperChiffres } from '@/lib/format'
import { centimesEnSaisie } from '@/lib/montant'
import { FORMES_JURIDIQUES, REGIMES_TVA } from '@/lib/organisation'
import type { OrganizationRow } from '@/lib/supabase/types'

function Section({ id, titre, description, children }: { id: string; titre: string; description: string; children: ReactNode }) {
  return (
    <Panneau className="scroll-mt-20">
      <div id={id} />
      <PanneauTete titre={titre} description={description} />
      <PanneauCorps>
        <div className="grid gap-4 sm:grid-cols-2">{children}</div>
      </PanneauCorps>
    </Panneau>
  )
}

export function FormulaireIdentite({ organisation, modifiable }: { organisation: OrganizationRow; modifiable: boolean }) {
  const action = enregistrerIdentite.bind(null, organisation.slug)
  const [etat, envoyer, enCours] = useActionState<EtatIdentite, FormData>(action, {})
  const e = etat.erreurs ?? {}
  const o = organisation

  return (
    <form action={envoyer} className="flex flex-col gap-[18px]" noValidate>
      {!modifiable && (
        <Message ton="info">Seuls les propriétaires et administrateurs peuvent modifier l’identité de l’entreprise.</Message>
      )}
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}

      <fieldset disabled={!modifiable || enCours} className="m-0 flex min-w-0 flex-col gap-[18px] border-0 p-0">
        <Section id="identite" titre="Identité légale" description="Mentions obligatoires du vendeur sur chaque facture.">
          <Champ libelle="Dénomination" name="name" defaultValue={o.name} required erreur={e.name} classeCadre="sm:col-span-2" />
          <Selection
            libelle="Forme juridique"
            name="legal_form"
            defaultValue={o.legal_form ?? ''}
            options={[{ valeur: '', libelle: 'Non renseignée' }, ...FORMES_JURIDIQUES.map((f) => ({ valeur: f, libelle: f }))]}
            facultatif
          />
          <Champ
            libelle="Capital social"
            name="share_capital"
            defaultValue={o.share_capital_cents === null ? '' : centimesEnSaisie(o.share_capital_cents)}
            suffixe="€"
            chiffres
            inputMode="decimal"
            erreur={e.share_capital_cents}
            aide="Obligatoire sur les factures des sociétés."
            facultatif
          />
          <Champ
            libelle="SIREN"
            name="siren"
            defaultValue={o.siren ? grouperChiffres(o.siren) : ''}
            chiffres
            inputMode="numeric"
            maxLength={11}
            erreur={e.siren}
          />
          <Champ
            libelle="SIRET du siège"
            name="siret"
            defaultValue={o.siret ? grouperChiffres(o.siret) : ''}
            chiffres
            inputMode="numeric"
            maxLength={17}
            erreur={e.siret}
            facultatif
          />
          <Champ
            libelle="N° de TVA intracommunautaire"
            name="vat_number"
            defaultValue={o.vat_number ?? ''}
            chiffres
            erreur={e.vat_number}
            aide="Pour la France : FR + clé + SIREN."
            facultatif
          />
          <Champ libelle="Code NAF / APE" name="naf_code" defaultValue={o.naf_code ?? ''} chiffres erreur={e.naf_code} facultatif />
          <Champ
            libelle="Immatriculation"
            name="registration"
            defaultValue={o.registration ?? ''}
            aide="Ex. RCS Nantes ou RM 44. Les micro-entrepreneurs non immatriculés laissent vide."
            classeCadre="sm:col-span-2"
            facultatif
          />
        </Section>

        <Section id="adresse" titre="Adresse du siège" description="Adresse imprimée sur les factures.">
          <Champ libelle="Adresse" name="address_line1" defaultValue={o.address_line1 ?? ''} autoComplete="address-line1" classeCadre="sm:col-span-2" />
          <Champ
            libelle="Complément"
            name="address_line2"
            defaultValue={o.address_line2 ?? ''}
            autoComplete="address-line2"
            classeCadre="sm:col-span-2"
            facultatif
          />
          <Champ libelle="Code postal" name="postal_code" defaultValue={o.postal_code ?? ''} autoComplete="postal-code" erreur={e.postal_code} />
          <Champ libelle="Ville" name="city" defaultValue={o.city ?? ''} autoComplete="address-level2" />
          <Champ
            libelle="Pays"
            name="country_code"
            defaultValue={o.country_code}
            maxLength={2}
            chiffres
            erreur={e.country_code}
            aide="Code ISO à 2 lettres."
          />
        </Section>

        <Section id="fiscalite" titre="Fiscalité" description="Régime appliqué par défaut à vos factures.">
          <Selection
            libelle="Régime de TVA"
            name="vat_regime"
            defaultValue={o.vat_regime ?? ''}
            options={[{ valeur: '', libelle: 'À choisir' }, ...REGIMES_TVA.map((r) => ({ valeur: r.valeur, libelle: r.libelle }))]}
            erreur={e.vat_regime}
            aide="En franchise, la mention « TVA non applicable, art. 293 B du CGI » est ajoutée automatiquement."
            classeCadre="sm:col-span-2"
          />
          <Case
            libelle="Option pour le paiement de la TVA d’après les débits"
            name="vat_on_debits"
            defaultChecked={o.vat_on_debits}
            aide="Pour les prestations de services : la TVA devient exigible à la facturation et non à l’encaissement. La mention est ajoutée aux factures."
            className="sm:col-span-2"
          />
        </Section>

        <Section id="banque" titre="Coordonnées bancaires" description="Imprimées en pied de facture pour le paiement par virement.">
          <Champ
            libelle="IBAN"
            name="iban"
            defaultValue={o.iban ? formatIban(o.iban) : ''}
            chiffres
            erreur={e.iban}
            autoComplete="off"
            classeCadre="sm:col-span-2"
          />
          <Champ libelle="BIC" name="bic" defaultValue={o.bic ?? ''} chiffres erreur={e.bic} autoComplete="off" />
        </Section>
      </fieldset>

      {modifiable && (
        <Panneau>
          <PanneauPied>
            <Bouton type="submit" variante="primaire" chargement={enCours}>
              Enregistrer
            </Bouton>
          </PanneauPied>
        </Panneau>
      )}
    </form>
  )
}
