'use client'

import { useActionState, useState } from 'react'
import { etapeDemarrage, type EtapeDemarrage, type EtatFacturation } from '@/app/actions/organisation'
import { Bouton, BoutonLien } from '@/components/ui/Bouton'
import { Case, Champ, Selection } from '@/components/ui/Champ'
import { Message } from '@/components/ui/Message'
import { CONDITIONS_PAIEMENT } from '@/lib/clients'
import { cn } from '@/lib/cn'
import { formatIban } from '@/lib/format'
import { formaterNumero, FORMATS_SUGGERES } from '@/lib/numerotation'
import { MODELES_FACTURE, REGIMES_TVA } from '@/lib/organisation'
import type { OrganizationRow } from '@/lib/supabase/types'
import { COULEURS, Logo } from './FormulaireFacturation'

function Choix({ nom, valeur, actif, onChange, titre, aide }: { nom: string; valeur: string; actif: boolean; onChange: () => void; titre: string; aide: string }) {
  return (
    <label className={cn('flex cursor-pointer flex-col gap-1 rounded-m border p-3.5', actif ? 'border-accent bg-accent-doux' : 'border-trait hover:border-trait-fort')}>
      <span className="flex items-center gap-2 font-semibold">
        <input type="radio" name={nom} value={valeur} checked={actif} onChange={onChange} className="accent-[var(--accent)]" />
        {titre}
      </span>
      <span className="text-[12.5px] text-encre-3">{aide}</span>
    </label>
  )
}

export function EtapesDemarrage({ organisation, etape }: { organisation: OrganizationRow; etape: EtapeDemarrage }) {
  const [etat, envoyer, enCours] = useActionState<EtatFacturation, FormData>(etapeDemarrage.bind(null, organisation.slug, etape), {})
  const e = etat.erreurs ?? {}
  const [regime, setRegime] = useState(organisation.vat_regime ?? 'reel_simplifie')
  const [modele, setModele] = useState(organisation.invoice_template)
  const [couleur, setCouleur] = useState(organisation.accent_color)
  const [format, setFormat] = useState(organisation.invoice_number_format)
  const [depart, setDepart] = useState(String(organisation.invoice_start_number))
  const annee = new Date().getFullYear()

  return (
    <form action={envoyer} className="flex flex-col gap-5" noValidate>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}

      {etape === 'tva' && (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {REGIMES_TVA.map((r) => (
              <Choix key={r.valeur} nom="vat_regime" valeur={r.valeur} actif={regime === r.valeur} onChange={() => setRegime(r.valeur)} titre={r.libelle} aide={r.aide} />
            ))}
          </div>
          {e.vat_regime && <p className="text-[12.5px] text-alerte">{e.vat_regime}</p>}
          {regime === 'franchise' ? (
            <Message ton="info">La mention « TVA non applicable, art. 293 B du CGI » sera ajoutée à toutes vos factures, sans TVA.</Message>
          ) : (
            <Case
              libelle="J’ai opté pour le paiement de la TVA d’après les débits"
              name="vat_on_debits"
              defaultChecked={organisation.vat_on_debits}
              aide="Concerne les prestations de services : la TVA est due dès la facturation et non à l’encaissement. Sans option, laissez décoché."
            />
          )}
        </>
      )}

      {etape === 'banque' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Champ libelle="IBAN" name="iban" defaultValue={organisation.iban ? formatIban(organisation.iban) : ''} chiffres erreur={e.iban} classeCadre="sm:col-span-2" aide="Imprimé avec un QR code de virement : vos clients paient en le scannant." facultatif />
          <Champ libelle="BIC" name="bic" defaultValue={organisation.bic ?? ''} chiffres erreur={e.bic} facultatif />
          <Selection libelle="Conditions de paiement par défaut" name="default_payment_terms" defaultValue={organisation.default_payment_terms} options={CONDITIONS_PAIEMENT} erreur={e.default_payment_terms} />
        </div>
      )}

      {etape === 'apparence' && (
        <>
          <Logo organisation={organisation} modifiable />
          <div className="grid gap-2 sm:grid-cols-3">
            {MODELES_FACTURE.map((m) => (
              <Choix key={m.valeur} nom="invoice_template" valeur={m.valeur} actif={modele === m.valeur} onChange={() => setModele(m.valeur)} titre={m.libelle} aide={m.aide} />
            ))}
          </div>
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-1.5 text-[13px] font-medium">Couleur d’accent</legend>
            <div className="flex flex-wrap items-center gap-2">
              {COULEURS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCouleur(c)}
                  aria-label={`Couleur ${c}`}
                  aria-pressed={couleur.toUpperCase() === c}
                  className={cn('size-8 rounded-full border-2', couleur.toUpperCase() === c ? 'border-encre' : 'border-transparent')}
                  style={{ background: c }}
                />
              ))}
              <input type="color" value={couleur} onChange={(ev) => setCouleur(ev.target.value)} aria-label="Couleur personnalisée" className="h-8 w-11 cursor-pointer rounded-s border border-trait-fort" />
              <input type="hidden" name="accent_color" value={couleur} />
            </div>
          </fieldset>
        </>
      )}

      {etape === 'numerotation' && (
        <>
          <div className="flex flex-wrap gap-2">
            {FORMATS_SUGGERES.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                aria-pressed={format === f}
                className={cn('rounded-m border px-3 py-1.5 font-chiffre text-[12.5px]', format === f ? 'border-accent bg-accent-doux' : 'border-trait hover:border-trait-fort')}
              >
                {formaterNumero(f, annee, new Date().getMonth() + 1, 1)}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Champ libelle="Format" name="invoice_number_format" value={format} onChange={(ev) => setFormat(ev.target.value)} chiffres erreur={e.invoice_number_format} />
            <Champ
              libelle="Numéro de la prochaine facture"
              name="invoice_start_number"
              value={depart}
              onChange={(ev) => setDepart(ev.target.value.replace(/\D/g, ''))}
              chiffres
              inputMode="numeric"
              erreur={e.invoice_start_number}
              aide="Si vous changez de logiciel en cours d’année, continuez votre numérotation existante."
            />
          </div>
          <div className="rounded-l border border-trait bg-surface-2 p-4">
            <p className="text-[12.5px] text-encre-3">Votre prochaine facture portera le numéro</p>
            <p className="num mt-1 text-[22px] font-medium">{/\{N+\}/.test(format) ? formaterNumero(format, annee, new Date().getMonth() + 1, Number(depart) || 1) : '—'}</p>
          </div>
        </>
      )}

      {etape === 'fin' && (
        <Message ton="succes">
          {organisation.name} est prête. Ajoutez votre premier client puis créez votre première facture : les mentions obligatoires sont ajoutées automatiquement.
        </Message>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-trait pt-4">
        {etape !== 'fin' ? (
          <BoutonLien href={`/${organisation.slug}/tableau-de-bord`} variante="fantome">
            Terminer plus tard
          </BoutonLien>
        ) : (
          <span />
        )}
        <Bouton type="submit" variante="primaire" chargement={enCours}>
          {etape === 'fin' ? 'Accéder au tableau de bord' : 'Continuer'}
        </Bouton>
      </div>
    </form>
  )
}
