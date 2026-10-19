import { formatTaux } from '@pastille/moteur'
import type { CSSProperties } from 'react'
import { cn } from '@/lib/cn'
import { formatIban, formatMontant } from '@/lib/format'
import { adresseClient, adresseVendeur, dateCourte, identiteLegale, quantiteTexte, type DocumentImprimable } from '@/lib/imprimable'

const LIBELLES = {
  fr: {
    numero: 'N°',
    date: 'Date',
    echeance: 'Échéance',
    validite: 'Valable jusqu’au',
    prestation: 'Prestation',
    periode: 'Période',
    commande: 'Bon de commande',
    client: 'Facturé à',
    destinataire: 'Destinataire',
    designation: 'Désignation',
    qte: 'Qté',
    pu: 'PU HT',
    remise: 'Remise',
    tva: 'TVA',
    total: 'Total HT',
    totalLignes: 'Total HT des lignes',
    remiseGlobale: 'Remise',
    acomptes: 'Acomptes déduits',
    totalHt: 'Total HT',
    totalTva: 'TVA',
    totalTtc: 'Total TTC',
    net: 'Net à payer',
    sur: 'sur',
    exonere: 'Exonéré',
    paiement: 'Paiement',
    enLigne: 'Paiement en ligne',
    conditions: 'Conditions',
    brouillon: 'Brouillon · sans valeur',
    paye: 'Payée',
    empreinte: 'Empreinte SHA-256',
  },
  en: {
    numero: 'No.',
    date: 'Date',
    echeance: 'Due date',
    validite: 'Valid until',
    prestation: 'Service date',
    periode: 'Period',
    commande: 'Purchase order',
    client: 'Bill to',
    destinataire: 'To',
    designation: 'Description',
    qte: 'Qty',
    pu: 'Unit price',
    remise: 'Disc.',
    tva: 'VAT',
    total: 'Amount',
    totalLignes: 'Lines total',
    remiseGlobale: 'Discount',
    acomptes: 'Deposits deducted',
    totalHt: 'Total excl. VAT',
    totalTva: 'VAT',
    totalTtc: 'Total incl. VAT',
    net: 'Amount due',
    sur: 'on',
    exonere: 'Exempt',
    paiement: 'Payment',
    enLigne: 'Pay online',
    conditions: 'Terms',
    brouillon: 'Draft · not valid',
    paye: 'Paid',
    empreinte: 'SHA-256 fingerprint',
  },
}

/** Rendu A4 d'une facture, d'un devis ou d'un avoir, selon le modèle choisi par l'entreprise. */
export function DocumentImprime({ doc, logoUrl, className }: { doc: DocumentImprimable; logoUrl?: string | null; className?: string }) {
  const t = LIBELLES[doc.langue]
  const m = (c: number) => formatMontant(c, doc.devise)
  const v = doc.vendeur
  const c = doc.client
  const classique = doc.modele === 'classique'
  const papeterie = doc.modele === 'papeterie'
  const style = {
    '--doc-accent': doc.couleur,
    fontFamily: doc.police === 'serif' ? 'Georgia, "Times New Roman", serif' : 'var(--font-texte)',
  } as CSSProperties

  const meta: Array<[string, string]> = [
    [t.date, dateCourte(doc.dateEmission)],
    ...(doc.dateEcheance ? [[t.echeance, dateCourte(doc.dateEcheance)] as [string, string]] : []),
    ...(doc.dateValidite ? [[t.validite, dateCourte(doc.dateValidite)] as [string, string]] : []),
    ...(doc.periode ? [[t.periode, `${dateCourte(doc.periode.debut)} – ${dateCourte(doc.periode.fin)}`] as [string, string]] : []),
    ...(doc.datePrestation && !doc.periode ? [[t.prestation, dateCourte(doc.datePrestation)] as [string, string]] : []),
    ...(doc.bonCommande ? [[t.commande, doc.bonCommande] as [string, string]] : []),
  ]

  return (
    <article
      style={style}
      className={cn(
        'document-imprime relative mx-auto flex aspect-[210/297] w-full max-w-[210mm] flex-col bg-[#fff] text-[10.5px] leading-[1.45] text-[#1d1f24] shadow-haute print:aspect-auto print:max-w-none print:shadow-none',
        className,
      )}
    >
      {doc.brouillon && (
        <p className="pointer-events-none absolute inset-x-0 top-[38%] z-10 -rotate-12 text-center text-[54px] font-bold uppercase tracking-widest text-[#1d1f24]/[0.06]" aria-hidden="true">
          {t.brouillon}
        </p>
      )}
      {doc.paye && (
        <p className="absolute right-[14mm] top-[52mm] z-10 rotate-[-8deg] rounded-[4px] border-2 border-[#1f8a5b] px-3 py-1 text-[16px] font-bold uppercase tracking-[0.2em] text-[#1f8a5b]">
          {t.paye}
        </p>
      )}

      {/* En-tête */}
      <header
        className={cn(
          'flex items-start justify-between gap-6 px-[14mm] pt-[13mm]',
          doc.modele === 'galet' && 'pb-[7mm]',
        )}
      >
        <div className="flex min-w-0 flex-col gap-1">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={v.name} className="mb-1 max-h-[16mm] max-w-[52mm] object-contain" />
          ) : (
            <p className={cn('text-[15px] font-bold', papeterie && 'text-[17px] font-semibold tracking-wide')}>{v.name}</p>
          )}
          <div className="text-[#555a64]">
            {adresseVendeur(v).map((l) => (
              <p key={l}>{l}</p>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5 text-right">
          <h2
            className={papeterie ? 'text-[13px] font-semibold uppercase leading-none tracking-[0.3em]' : 'text-[22px] font-bold leading-none tracking-tight'}
            style={{ color: classique ? '#1d1f24' : 'var(--doc-accent)' }}
          >
            {doc.titre}
          </h2>
          <p className="mt-1 text-[12px] font-semibold tabular-nums">
            {doc.numero ? `${t.numero} ${doc.numero}` : t.brouillon}
          </p>
        </div>
      </header>
      {papeterie && <hr className="mx-[14mm] mt-[6mm] border-0 border-t border-[#1d1f24]/20" />}
      {doc.modele === 'galet' && <div className="mx-[14mm] h-[3px] rounded-full" style={{ background: 'var(--doc-accent)' }} />}

      {/* Parties et dates */}
      <section className="grid grid-cols-[1fr_auto] gap-8 px-[14mm] pt-[8mm]">
        <div className={cn('flex min-w-0 flex-col gap-0.5', doc.modele === 'galet' && 'rounded-[8px] bg-[#f4f5f7] p-[4mm]', classique && 'border border-[#1d1f24]/30 p-[3mm]')}>
          <p className="text-[8.5px] font-semibold uppercase tracking-[0.12em] text-[#7a808b]">{doc.type === 'devis' ? t.destinataire : t.client}</p>
          {c ? (
            <>
              <p className="text-[12px] font-semibold">{c.name}</p>
              {adresseClient(c).map((l) => (
                <p key={l}>{l}</p>
              ))}
              {c.siren && <p className="mt-1 text-[#555a64]">SIREN {c.siren}</p>}
              {c.vat_number && <p className="text-[#555a64]">TVA {c.vat_number}</p>}
              {c.service_code && <p className="text-[#555a64]">Code service {c.service_code}</p>}
            </>
          ) : (
            <p className="text-[#7a808b]">—</p>
          )}
        </div>
        <dl className="m-0 grid grid-cols-[auto_auto] content-start gap-x-4 gap-y-1 self-start">
          {meta.map(([k, val]) => (
            <div key={k} className="contents">
              <dt className="text-[#7a808b]">{k}</dt>
              <dd className="m-0 text-right font-medium tabular-nums">{val}</dd>
            </div>
          ))}
        </dl>
      </section>

      {doc.objet && <p className="px-[14mm] pt-[6mm] text-[11.5px] font-semibold">{doc.objet}</p>}

      {/* Lignes */}
      <section className="px-[14mm] pt-[6mm]">
        <table className="w-full border-collapse">
          <thead>
            <tr
              className={cn(
                'text-[8.5px] uppercase tracking-[0.08em]',
                classique ? 'bg-[#1d1f24] text-[#fff]' : 'border-b text-[#7a808b]',
                papeterie && 'border-[#1d1f24]/40',
              )}
              style={doc.modele === 'galet' ? { borderColor: 'var(--doc-accent)' } : undefined}
            >
              <th className="py-2 pl-1.5 text-left font-semibold">{t.designation}</th>
              <th className="w-[12mm] py-2 text-right font-semibold">{t.qte}</th>
              <th className="w-[24mm] py-2 text-right font-semibold">{t.pu}</th>
              <th className="w-[14mm] py-2 text-right font-semibold">{t.tva}</th>
              <th className="w-[26mm] py-2 pr-1.5 text-right font-semibold">{t.total}</th>
            </tr>
          </thead>
          <tbody>
            {doc.lignes.map((l, i) => (
              <tr key={i} className={cn('break-inside-avoid border-b border-[#1d1f24]/10 align-top', classique && 'border-[#1d1f24]/25')}>
                <td className="py-2 pl-1.5 pr-3">
                  <p className="font-medium">{l.designation}</p>
                  {l.description && <p className="whitespace-pre-line text-[9.5px] text-[#555a64]">{l.description}</p>}
                  {l.remise && (
                    <p className="text-[9px] text-[#7a808b]">
                      {t.remise} {l.remise.type === 'pourcentage' ? formatTaux(l.remise.valeur) : m(Math.abs(l.remise.valeur))}
                    </p>
                  )}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {quantiteTexte(l.quantite)}
                  {l.unite && l.unite !== 'unité' && <span className="block text-[8.5px] text-[#7a808b]">{l.unite}</span>}
                </td>
                <td className="py-2 text-right tabular-nums">{m(l.prixUnitaireHt)}</td>
                <td className="py-2 text-right tabular-nums">{l.categorie === 'S' || l.categorie === 'Z' ? formatTaux(l.taux) : l.categorie}</td>
                <td className="py-2 pr-1.5 text-right font-medium tabular-nums">{m(l.montantNet)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Totaux */}
      <section className="grid grid-cols-[1fr_72mm] gap-8 px-[14mm] pt-[5mm]">
        <div className="flex flex-col gap-2 text-[9.5px] text-[#555a64]">
          {doc.notes && <p className="whitespace-pre-line text-[10.5px] text-[#1d1f24]">{doc.notes}</p>}
          {doc.conditions && (
            <p>
              <span className="font-semibold text-[#1d1f24]">{t.conditions} : </span>
              {doc.conditions}
            </p>
          )}
          {doc.type !== 'devis' && doc.type !== 'avoir' && v.iban && (
            <p>
              <span className="font-semibold text-[#1d1f24]">{t.paiement} : </span>
              virement · IBAN <span className="tabular-nums">{formatIban(v.iban)}</span>
              {v.bic ? ` · BIC ${v.bic}` : ''}
              {doc.numero ? ` · référence ${doc.numero}` : ''}
            </p>
          )}
          {doc.lienPaiement && (
            <p>
              <span className="font-semibold text-[#1d1f24]">{t.enLigne} : </span>
              <a href={doc.lienPaiement} className="break-all text-[#1d1f24] underline">
                {doc.lienPaiement}
              </a>
            </p>
          )}
        </div>
        <dl className={cn('m-0 flex flex-col self-start', doc.modele === 'galet' && 'rounded-[8px] bg-[#f4f5f7] p-[3.5mm]', classique && 'border border-[#1d1f24]/30 p-[3mm]')}>
          {doc.totaux.totalLignesHt !== doc.totaux.totalHt && <Total libelle={t.totalLignes} valeur={m(doc.totaux.totalLignesHt)} />}
          {doc.totaux.remiseGlobale !== 0 && <Total libelle={t.remiseGlobale} valeur={`− ${m(doc.totaux.remiseGlobale)}`} />}
          {doc.acomptes.map((a) => (
            <Total key={a.numero} libelle={`${t.acomptes} ${a.numero}`} valeur={`− ${m(a.montantHt)}`} />
          ))}
          <Total libelle={t.totalHt} valeur={m(doc.totaux.totalHt)} fort />
          {doc.ventilation.map((g) => (
            <Total
              key={`${g.categorie}${g.taux}`}
              libelle={g.categorie === 'S' || g.categorie === 'Z' ? `${t.totalTva} ${formatTaux(g.taux)} ${t.sur} ${m(g.baseHt)}` : `${t.exonere} (${g.categorie}) ${t.sur} ${m(g.baseHt)}`}
              valeur={m(g.tva)}
              discret
            />
          ))}
          <Total libelle={t.totalTtc} valeur={m(doc.totaux.totalTtc)} fort />
          <div
            className="mt-1.5 flex justify-between gap-3 rounded-[5px] px-2 py-1.5 text-[12px] font-bold"
            style={{ background: classique ? '#1d1f24' : 'var(--doc-accent)', color: 'white' }}
          >
            <dt>{doc.type === 'devis' ? t.totalTtc : t.net}</dt>
            <dd className="m-0 tabular-nums">{m(doc.totaux.netAPayer)}</dd>
          </div>
        </dl>
      </section>

      {/* Mentions et pied */}
      <footer className="mt-auto flex flex-col gap-1 px-[14mm] pb-[10mm] pt-[8mm] text-[8.5px] leading-[1.5] text-[#555a64]">
        {doc.mentions.map((x) => (
          <p key={x}>{x}</p>
        ))}
        {v.terms_text && <p className="whitespace-pre-line">{v.terms_text}</p>}
        <div className={cn('mt-2 border-t border-[#1d1f24]/15 pt-2 text-center text-[8px] text-[#7a808b]')}>
          {identiteLegale(v).map((x) => (
            <p key={x}>{x}</p>
          ))}
          {v.footer_text && <p>{v.footer_text}</p>}
          {doc.empreinte && (
            <p className="mt-1 break-all font-mono text-[7px]">
              {t.empreinte} {doc.empreinte}
            </p>
          )}
        </div>
      </footer>
    </article>
  )
}

function Total({ libelle, valeur, fort, discret }: { libelle: string; valeur: string; fort?: boolean; discret?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-3 py-[3px]', fort && 'border-t border-[#1d1f24]/15 pt-1.5 font-semibold', discret && 'text-[9.5px] text-[#555a64]')}>
      <dt>{libelle}</dt>
      <dd className="m-0 text-right tabular-nums">{valeur}</dd>
    </div>
  )
}
