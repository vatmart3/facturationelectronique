'use client'

import Image from 'next/image'
import { useActionState, useState, useTransition } from 'react'
import { definirLogo, enregistrerFacturation, type EtatFacturation } from '@/app/actions/organisation'
import { Bouton } from '@/components/ui/Bouton'
import { Champ, Selection } from '@/components/ui/Champ'
import { Message } from '@/components/ui/Message'
import { Panneau, PanneauCorps, PanneauPied, PanneauTete } from '@/components/ui/Panneau'
import { CONDITIONS_PAIEMENT } from '@/lib/clients'
import { cn } from '@/lib/cn'
import { formaterNumero } from '@/lib/numerotation'
import { MODELES_FACTURE } from '@/lib/organisation'
import { creerClientNavigateur, urlPublique } from '@/lib/supabase/navigateur'
import type { OrganizationRow } from '@/lib/supabase/types'

export const COULEURS = ['#1F3A5F', '#16171B', '#23774F', '#7A2E3A', '#5E3FA3', '#B23C12', '#0F6E78', '#8A6A12']

function ApercuNumero({ nom, libelle, defaut, erreur }: { nom: string; libelle: string; defaut: string; erreur?: string }) {
  const [format, setFormat] = useState(defaut)
  const maintenant = new Date()
  const apercu = /\{N+\}/.test(format) ? formaterNumero(format, maintenant.getFullYear(), maintenant.getMonth() + 1, 1) : '—'
  return (
    <Champ
      libelle={libelle}
      name={nom}
      value={format}
      onChange={(e) => setFormat(e.target.value)}
      chiffres
      erreur={erreur}
      aide={
        <>
          Premier numéro : <span className="num font-medium text-encre">{apercu}</span>
        </>
      }
    />
  )
}

export function Logo({ organisation, modifiable }: { organisation: OrganizationRow; modifiable: boolean }) {
  const [chemin, setChemin] = useState(organisation.logo_path)
  const [erreur, setErreur] = useState<string>()
  const [enCours, demarrer] = useTransition()

  function envoyer(fichier: File | undefined) {
    if (!fichier) return
    setErreur(undefined)
    if (fichier.size > 1_048_576) return setErreur('Logo trop lourd : 1 Mo maximum.')
    if (!['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'].includes(fichier.type)) return setErreur('Format accepté : PNG, JPEG, SVG ou WebP.')
    demarrer(async () => {
      const extension = fichier.name.split('.').pop()?.toLowerCase() ?? 'png'
      const nouveau = `${organisation.id}/logo-${Date.now()}.${extension}`
      const { error } = await creerClientNavigateur().storage.from('logos').upload(nouveau, fichier, { contentType: fichier.type, upsert: false })
      if (error) return setErreur('Envoi impossible. Seuls les propriétaires et administrateurs peuvent changer le logo.')
      const r = await definirLogo(organisation.slug, nouveau)
      if (r.erreur) return setErreur(r.erreur)
      setChemin(nouveau)
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="grid h-20 w-40 place-items-center overflow-hidden rounded-m border border-dashed border-trait-fort bg-surface-2">
        {chemin ? (
          <Image src={urlPublique('logos', chemin)} alt="Logo de l’entreprise" width={160} height={80} unoptimized className="max-h-16 w-auto object-contain" />
        ) : (
          <span className="text-[12.5px] text-encre-3">Aucun logo</span>
        )}
      </div>
      {modifiable && (
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <label className="inline-flex h-[34px] cursor-pointer items-center rounded-m border border-trait-fort bg-surface px-3.5 text-[13.5px] font-semibold shadow-douce hover:bg-survol">
              {enCours ? 'Envoi…' : chemin ? 'Changer le logo' : 'Ajouter un logo'}
              <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="sr-only" onChange={(e) => envoyer(e.target.files?.[0])} />
            </label>
            {chemin && (
              <Bouton
                variante="fantome"
                onClick={() =>
                  demarrer(async () => {
                    const r = await definirLogo(organisation.slug, null)
                    if (r.erreur) setErreur(r.erreur)
                    else setChemin(null)
                  })
                }
              >
                Retirer
              </Bouton>
            )}
          </div>
          <span className="text-[12.5px] text-encre-3">PNG, JPEG, SVG ou WebP, 1 Mo maximum. Fond transparent conseillé.</span>
          {erreur && <span className="text-[12.5px] text-alerte">{erreur}</span>}
        </div>
      )}
    </div>
  )
}

export function FormulaireFacturation({ organisation, modifiable }: { organisation: OrganizationRow; modifiable: boolean }) {
  const [etat, envoyer, enCours] = useActionState<EtatFacturation, FormData>(enregistrerFacturation.bind(null, organisation.slug), {})
  const e = etat.erreurs ?? {}
  const [couleur, setCouleur] = useState(organisation.accent_color)
  const [modele, setModele] = useState(organisation.invoice_template)
  const o = organisation

  return (
    <div className="flex flex-col gap-[18px]">
      <Panneau>
        <PanneauTete titre="Logo" description="Imprimé en haut de vos factures et devis." />
        <PanneauCorps>
          <Logo organisation={organisation} modifiable={modifiable} />
        </PanneauCorps>
      </Panneau>

      <form action={envoyer} className="flex flex-col gap-[18px]" noValidate>
        {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
        {etat.succes && <Message ton="succes">{etat.succes}</Message>}
        <fieldset disabled={!modifiable || enCours} className="m-0 flex min-w-0 flex-col gap-[18px] border-0 p-0">
          <Panneau>
            <PanneauTete titre="Paiement" description="Mentions obligatoires sur chaque facture." />
            <PanneauCorps>
              <div className="grid gap-4 sm:grid-cols-2">
                <Selection libelle="Conditions par défaut" name="default_payment_terms" defaultValue={o.default_payment_terms} options={CONDITIONS_PAIEMENT} erreur={e.default_payment_terms} aide="Au plus 60 jours, ou 45 jours fin de mois (art. L441-10 du Code de commerce)." />
                <Champ libelle="Escompte pour paiement anticipé" name="early_payment_discount" defaultValue={o.early_payment_discount} />
                <Champ
                  libelle="Pénalités de retard"
                  name="late_penalty_terms"
                  defaultValue={o.late_penalty_terms}
                  erreur={e.late_penalty_terms}
                  classeCadre="sm:col-span-2"
                  aide="L’indemnité forfaitaire de 40 € pour frais de recouvrement est ajoutée automatiquement aux factures entre professionnels."
                />
              </div>
            </PanneauCorps>
          </Panneau>

          <Panneau>
            <PanneauTete titre="Numérotation" description="{AAAA} année · {AA} année courte · {MM} mois · {NNNN} numéro. La séquence repart chaque année si le format contient l’année." />
            <PanneauCorps>
              <div className="grid gap-4 sm:grid-cols-3">
                <ApercuNumero nom="invoice_number_format" libelle="Factures" defaut={o.invoice_number_format} erreur={e.invoice_number_format} />
                <ApercuNumero nom="quote_number_format" libelle="Devis" defaut={o.quote_number_format} erreur={e.quote_number_format} />
                <ApercuNumero nom="credit_number_format" libelle="Avoirs" defaut={o.credit_number_format} erreur={e.credit_number_format} />
              </div>
            </PanneauCorps>
          </Panneau>

          <Panneau>
            <PanneauTete titre="Apparence des factures" />
            <PanneauCorps>
              <fieldset className="m-0 grid gap-2 border-0 p-0 sm:grid-cols-3">
                <legend className="mb-2 text-[13px] font-medium">Modèle</legend>
                {MODELES_FACTURE.map((m) => (
                  <label
                    key={m.valeur}
                    className={cn('flex cursor-pointer flex-col gap-1 rounded-m border p-3', modele === m.valeur ? 'border-accent bg-accent-doux' : 'border-trait hover:border-trait-fort')}
                  >
                    <span className="flex items-center gap-2 text-[13.5px] font-semibold">
                      <input type="radio" name="invoice_template" value={m.valeur} checked={modele === m.valeur} onChange={() => setModele(m.valeur)} className="accent-[var(--accent)]" />
                      {m.libelle}
                    </span>
                    <span className="text-[12.5px] text-encre-3">{m.aide}</span>
                  </label>
                ))}
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-2">
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
                        className={cn('size-7 rounded-full border-2', couleur.toUpperCase() === c ? 'border-encre' : 'border-transparent')}
                        style={{ background: c }}
                      />
                    ))}
                    <input type="color" value={couleur} onChange={(ev) => setCouleur(ev.target.value)} aria-label="Couleur personnalisée" className="h-7 w-10 cursor-pointer rounded-s border border-trait-fort bg-surface" />
                    <input type="hidden" name="accent_color" value={couleur} />
                  </div>
                  {e.accent_color && <span className="text-[12.5px] text-alerte">{e.accent_color}</span>}
                </fieldset>
                <Selection
                  libelle="Police"
                  name="invoice_font"
                  defaultValue={o.invoice_font}
                  options={[
                    { valeur: 'grotesque', libelle: 'Grotesque (moderne)' },
                    { valeur: 'serif', libelle: 'Serif (classique)' },
                  ]}
                />
              </div>
              <Champ libelle="Pied de page" name="footer_text" defaultValue={o.footer_text ?? ''} aide="Ex. : Merci pour votre confiance. Membre d’une association agréée." facultatif />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="terms_text" className="text-[13px] font-medium">
                  Conditions générales de vente <span className="font-normal text-encre-3">· facultatif, imprimées en page 2</span>
                </label>
                <textarea
                  id="terms_text"
                  name="terms_text"
                  defaultValue={o.terms_text ?? ''}
                  rows={6}
                  maxLength={20000}
                  className="rounded-m border border-trait-fort bg-surface p-3 text-[13.5px] outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-doux)]"
                />
              </div>
            </PanneauCorps>
            {modifiable && (
              <PanneauPied>
                <Bouton type="submit" variante="primaire" chargement={enCours}>
                  Enregistrer
                </Bouton>
              </PanneauPied>
            )}
          </Panneau>
        </fieldset>
      </form>
    </div>
  )
}
