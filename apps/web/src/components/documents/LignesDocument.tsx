'use client'

import { formatTaux, type LigneCalculee } from '@pastille/moteur'
import { useEffect, useId, useRef, useState } from 'react'
import { Icone } from '@/components/ui/Icone'
import { cn } from '@/lib/cn'
import type { LigneEdition } from '@/lib/document'
import { appliquerSaisieRapide, changerTva, optionsTva, suggererProduits, valeurTva, type ProduitEditeur } from '@/lib/editeur'
import type { RegimeEntreprise } from '@/lib/fiscalite'
import { formatMontant } from '@/lib/format'
import { UNITES } from '@/lib/produits'
import { SaisieMontant, SaisiePourcentage, SaisieQuantite } from './Saisies'

const GRILLE = 'grid grid-cols-[minmax(220px,1fr)_76px_92px_108px_64px_100px_112px_32px] items-start gap-x-1.5'

interface Props {
  lignes: LigneEdition[]
  calculees: ReadonlyMap<string, LigneCalculee>
  produits: ProduitEditeur[]
  regime: RegimeEntreprise
  devise: string
  onChanger: (cle: string, f: (l: LigneEdition) => LigneEdition) => void
  onProduit: (cle: string, produit: ProduitEditeur) => void
  onAjouter: (apres?: string) => string
  onSupprimer: (cle: string) => void
  onDeplacer: (cle: string, sens: -1 | 1) => void
}

export function LignesDocument({ lignes, calculees, produits, regime, devise, onChanger, onProduit, onAjouter, onSupprimer, onDeplacer }: Props) {
  const champs = useRef(new Map<string, HTMLInputElement>())
  const [aFocaliser, setAFocaliser] = useState<string | null>(null)

  useEffect(() => {
    if (aFocaliser) champs.current.get(aFocaliser)?.focus()
  }, [aFocaliser])

  return (
    <div role="region" aria-label="Lignes du document" tabIndex={-1} className="-mx-1 overflow-x-auto px-1">
      <div className="min-w-[820px]">
        <div className={cn(GRILLE, 'border-b border-trait pb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-encre-3')} aria-hidden="true">
          <span className="pl-1.5">Désignation</span>
          <span className="pr-1.5 text-right">Qté</span>
          <span className="pl-1.5">Unité</span>
          <span className="pr-1.5 text-right">Prix unit. HT</span>
          <span className="pr-1.5 text-right">Remise</span>
          <span className="pl-1.5">TVA</span>
          <span className="pr-1.5 text-right">Total HT</span>
          <span />
        </div>
        <ol className="m-0 list-none p-0">
          {lignes.map((l, i) => (
            <Ligne
              key={l.cle}
              ligne={l}
              index={i}
              total={lignes.length}
              net={calculees.get(l.cle)?.montantNet}
              produits={produits}
              regime={regime}
              devise={devise}
              champ={(el) => {
                if (el) champs.current.set(l.cle, el)
                else champs.current.delete(l.cle)
              }}
              onChanger={(f) => onChanger(l.cle, f)}
              onProduit={(p) => onProduit(l.cle, p)}
              onSuivante={() => setAFocaliser(onAjouter(l.cle))}
              onSupprimer={() => {
                const voisine = lignes[i + 1] ?? lignes[i - 1]
                onSupprimer(l.cle)
                if (voisine) setAFocaliser(voisine.cle)
              }}
              onDeplacer={(sens) => onDeplacer(l.cle, sens)}
            />
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-3 pt-3">
          <button
            type="button"
            onClick={() => setAFocaliser(onAjouter())}
            className="inline-flex h-8 items-center gap-1.5 rounded-m px-2 text-[13px] font-semibold text-accent hover:bg-accent-doux"
          >
            <Icone nom="plus" taille={14} />
            Ajouter une ligne
          </button>
          <span className="text-[12px] text-encre-3">
            Entrée ajoute une ligne · saisie rapide : « 3 x Création logo 450 »
          </span>
        </div>
      </div>
    </div>
  )
}

interface LigneProps {
  ligne: LigneEdition
  index: number
  total: number
  net: number | undefined
  produits: ProduitEditeur[]
  regime: RegimeEntreprise
  devise: string
  champ: (el: HTMLInputElement | null) => void
  onChanger: (f: (l: LigneEdition) => LigneEdition) => void
  onProduit: (p: ProduitEditeur) => void
  onSuivante: () => void
  onSupprimer: () => void
  onDeplacer: (sens: -1 | 1) => void
}

function Ligne({ ligne: l, index, total, net, produits, regime, devise, champ, onChanger, onProduit, onSuivante, onSupprimer, onDeplacer }: LigneProps) {
  const id = useId()
  const [ouvert, setOuvert] = useState(false)
  const [actif, setActif] = useState(0)
  const suggestions = ouvert && !l.productId ? suggererProduits(produits, l.designation) : []
  const motifRequis = l.categorie !== 'S' && l.categorie !== 'Z'
  const numero = index + 1

  function choisir(p: ProduitEditeur) {
    onProduit(p)
    setOuvert(false)
  }

  return (
    <li className={cn(GRILLE, 'group border-b border-trait py-2')}>
      <div className="relative flex min-w-0 flex-col gap-0.5">
        <input
          ref={champ}
          value={l.designation}
          onChange={(e) => {
            const v = e.target.value
            // Retoucher la désignation d'un article le détache du catalogue (le prix reste).
            onChanger((x) => ({ ...x, designation: v, productId: x.productId && v.trim() === '' ? null : x.productId }))
            setOuvert(true)
            setActif(0)
          }}
          onFocus={() => setOuvert(true)}
          onBlur={() => {
            setOuvert(false)
            onChanger(appliquerSaisieRapide)
          }}
          onKeyDown={(e) => {
            if (suggestions.length > 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
              e.preventDefault()
              setActif((a) => (a + (e.key === 'ArrowDown' ? 1 : suggestions.length - 1)) % suggestions.length)
            } else if (e.key === 'Escape') {
              setOuvert(false)
            } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              const s = suggestions[actif]
              if (s) choisir(s)
              else {
                onChanger(appliquerSaisieRapide)
                onSuivante()
              }
            }
          }}
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-controls={`${id}-liste`}
          aria-autocomplete="list"
          aria-activedescendant={suggestions.length > 0 ? `${id}-s${actif}` : undefined}
          aria-label={`Désignation, ligne ${numero}`}
          placeholder={index === 0 ? 'Article, prestation ou « 3 x Logo 450 »' : 'Désignation'}
          maxLength={300}
          className="h-8 w-full min-w-0 rounded-s border border-transparent bg-transparent px-1.5 text-[13.5px] font-medium outline-none placeholder:font-normal placeholder:text-encre-3 hover:border-trait focus:border-accent focus:bg-surface"
        />
        {suggestions.length > 0 && (
          <ul
            id={`${id}-liste`}
            role="listbox"
            aria-label="Articles du catalogue"
            className="absolute left-0 top-9 z-20 m-0 w-full max-w-[420px] list-none overflow-hidden rounded-m border border-trait-fort bg-surface p-1 shadow-haute"
          >
            {suggestions.map((p, i) => (
              <li
                key={p.id}
                id={`${id}-s${i}`}
                role="option"
                aria-selected={i === actif}
                onMouseDown={(e) => {
                  e.preventDefault()
                  choisir(p)
                }}
                onMouseEnter={() => setActif(i)}
                className={cn('flex cursor-pointer items-center justify-between gap-3 rounded-s px-2.5 py-1.5 text-[13px]', i === actif && 'bg-survol')}
              >
                <span className="min-w-0 truncate">
                  {p.favorite && <span className="mr-1 text-accent" aria-label="favori">★</span>}
                  {p.name}
                </span>
                <span className="num shrink-0 text-[12px] text-encre-3">
                  {formatMontant(p.unit_price_cents)} / {p.unit}
                </span>
              </li>
            ))}
          </ul>
        )}
        <textarea
          value={l.description}
          onChange={(e) => {
            const v = e.target.value
            onChanger((x) => ({ ...x, description: v }))
          }}
          rows={l.description ? Math.min(6, l.description.split('\n').length) : 1}
          placeholder="Détail (facultatif)"
          aria-label={`Détail, ligne ${numero}`}
          maxLength={2000}
          className="min-h-7 w-full resize-none rounded-s border border-transparent bg-transparent px-1.5 py-1 text-[12.5px] text-encre-2 outline-none placeholder:text-encre-3 hover:border-trait focus:border-accent focus:bg-surface"
        />
        {motifRequis && (
          <input
            value={l.motif ?? ''}
            onChange={(e) => {
              const v = e.target.value
              onChanger((x) => ({ ...x, motif: v }))
            }}
            placeholder="Mention d’exonération obligatoire"
            aria-label={`Mention d’exonération, ligne ${numero}`}
            aria-invalid={!l.motif?.trim() || undefined}
            maxLength={300}
            className={cn(
              'h-7 w-full rounded-s border bg-surface-2 px-1.5 text-[12px] outline-none focus:border-accent',
              l.motif?.trim() ? 'border-transparent text-encre-2' : 'border-attente/50 text-encre',
            )}
          />
        )}
      </div>
      <SaisieQuantite valeur={l.quantite} onValeur={(q) => onChanger((x) => ({ ...x, quantite: q }))} aria-label={`Quantité, ligne ${numero}`} />
      <input
        list="pastille-unites"
        value={l.unite}
        onChange={(e) => {
          const v = e.target.value
          onChanger((x) => ({ ...x, unite: v }))
        }}
        aria-label={`Unité, ligne ${numero}`}
        maxLength={30}
        className="h-8 w-full min-w-0 rounded-s border border-transparent bg-transparent px-1.5 text-[13px] text-encre-2 outline-none hover:border-trait focus:border-accent focus:bg-surface"
      />
      <SaisieMontant valeur={l.prixUnitaireHt} onValeur={(c) => onChanger((x) => ({ ...x, prixUnitaireHt: c }))} aria-label={`Prix unitaire HT, ligne ${numero}`} />
      <SaisiePourcentage
        valeur={l.remise?.type === 'pourcentage' ? l.remise.valeur : null}
        onValeur={(p) => onChanger((x) => ({ ...x, remise: p ? { type: 'pourcentage', valeur: p } : null }))}
        placeholder="—"
        aria-label={`Remise en pourcentage, ligne ${numero}`}
      />
      <select
        value={valeurTva(l)}
        onChange={(e) => {
          const v = e.target.value
          onChanger((x) => changerTva(x, v, regime))
        }}
        aria-label={`TVA, ligne ${numero}`}
        className="h-8 w-full min-w-0 rounded-s border border-transparent bg-transparent px-1 text-[13px] outline-none hover:border-trait focus:border-accent focus:bg-surface"
      >
        {optionsTva(l).map((o) => (
          <option key={o.valeur} value={o.valeur}>
            {o.libelle}
          </option>
        ))}
      </select>
      <output className="num flex h-8 items-center justify-end pr-1.5 text-[13.5px] font-semibold" aria-label={`Total HT, ligne ${numero}`}>
        {net === undefined ? '—' : formatMontant(net, devise)}
      </output>
      <div className="flex flex-col items-center opacity-60 group-focus-within:opacity-100 group-hover:opacity-100">
        <button
          type="button"
          onClick={onSupprimer}
          aria-label={`Supprimer la ligne ${numero}`}
          title="Supprimer la ligne"
          className="grid size-7 place-items-center rounded-s text-encre-3 hover:bg-alerte-doux hover:text-alerte"
        >
          <Icone nom="fermer" taille={13} />
        </button>
        {total > 1 && (
          <span className="flex">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => onDeplacer(-1)}
              aria-label={`Monter la ligne ${numero}`}
              className="grid h-5 w-3.5 place-items-center text-[10px] text-encre-3 hover:text-encre disabled:opacity-30"
            >
              ▲
            </button>
            <button
              type="button"
              disabled={index === total - 1}
              onClick={() => onDeplacer(1)}
              aria-label={`Descendre la ligne ${numero}`}
              className="grid h-5 w-3.5 place-items-center text-[10px] text-encre-3 hover:text-encre disabled:opacity-30"
            >
              ▼
            </button>
          </span>
        )}
      </div>
    </li>
  )
}

export function ListeUnites() {
  return (
    <datalist id="pastille-unites">
      {UNITES.map((u) => (
        <option key={u} value={u} />
      ))}
    </datalist>
  )
}

export function TauxTva({ taux }: { taux: number }) {
  return <>{formatTaux(taux)}</>
}
