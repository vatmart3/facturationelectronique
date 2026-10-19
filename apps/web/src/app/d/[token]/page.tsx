import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { DocumentImprime } from '@/components/documents/DocumentImprime'
import { FormulaireSignature } from '@/components/documents/Signature'
import { classesBouton } from '@/components/ui/Bouton'
import { Statut } from '@/components/ui/Statut'
import { aujourdHui, statutAffiche } from '@/lib/document'
import { formatDate, formatIban, formatMontant } from '@/lib/format'
import { charge } from '@/lib/pdf'
import { chargerPublic } from '@/lib/public'
import { urlPublique } from '@/lib/supabase/stockage'

export const metadata: Metadata = { title: 'Document', robots: { index: false, follow: false } }

/** Page envoyée au client : consultation, téléchargement, paiement ou acceptation du devis. */
export default async function DocumentPublic({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const p = await chargerPublic(token)
  if (!p) notFound()
  const { document: d, imprimable: doc, signature } = p
  const statut = statutAffiche({ ...d, type: d.type }, aujourdHui())
  const reste = Math.max(0, Number(d.amount_due) - Number(d.amount_paid))
  const qr = charge(doc)
  const svg = qr && reste === Number(d.amount_due) ? await QRCode.toString(qr, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 }) : null
  const devisOuvert = d.type === 'devis' && d.status === 'envoye' && !(d.valid_until && d.valid_until < aujourdHui())
  const logo = doc.vendeur.logo_path ? urlPublique('logos', doc.vendeur.logo_path) : null

  return (
    <main className="min-h-dvh bg-fond px-4 py-8 sm:py-12">
      <div className="mx-auto flex max-w-[980px] flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[13px] text-encre-3">{doc.vendeur.name}</p>
            <h1 className="mt-1 flex flex-wrap items-center gap-3 text-[24px] font-bold leading-tight">
              {doc.titre} <span className="num text-[21px]">{doc.numero}</span>
              <Statut statut={statut.cle} libelle={statut.libelle} />
            </h1>
            <p className="mt-1 text-[14px] text-encre-2">
              {formatMontant(doc.totaux.netAPayer, doc.devise)} · {formatDate(doc.dateEmission)}
              {doc.dateEcheance && d.type !== 'devis' && ` · échéance le ${formatDate(doc.dateEcheance)}`}
              {doc.dateValidite && ` · valable jusqu’au ${formatDate(doc.dateValidite)}`}
            </p>
          </div>
          <a href={`/d/${token}/pdf`} className={classesBouton('primaire')}>
            Télécharger le PDF
          </a>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 overflow-x-auto rounded-l border border-trait bg-surface-2 p-3 sm:p-6">
            <div className="min-w-[560px]">
              <DocumentImprime doc={doc} logoUrl={logo} />
            </div>
          </div>
          <aside className="flex flex-col gap-4 self-start">
            {doc.lienPaiement && reste > 0 && (
              <section className="flex flex-col gap-2 rounded-l border border-trait bg-surface p-4">
                <h2 className="text-[15px] font-semibold">Régler cette facture</h2>
                <p className="text-[13.5px] text-encre-2">
                  Reste à payer : <strong className="text-encre">{formatMontant(reste, d.currency)}</strong>
                </p>
                <a href={doc.lienPaiement} target="_blank" rel="noopener noreferrer" className={classesBouton('primaire')}>
                  Payer en ligne
                </a>
                <p className="text-[12px] text-encre-3">Paiement sécurisé sur la page de votre fournisseur. Rappelez le numéro {doc.numero} si une référence est demandée.</p>
              </section>
            )}
            {devisOuvert && <FormulaireSignature token={token} montant={formatMontant(doc.totaux.netAPayer, doc.devise)} />}
            {signature && (
              <section className="rounded-l border border-trait bg-surface p-4 text-[13.5px]">
                <h2 className="text-[15px] font-semibold">{signature.decision === 'accepte' ? 'Devis accepté' : 'Devis refusé'}</h2>
                <p className="mt-1 text-encre-2">
                  Par {signature.signer_name}, le {new Date(signature.signed_at).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}.
                </p>
              </section>
            )}
            {(d.type === 'facture' || d.type === 'acompte') && reste > 0 && d.status !== 'annule' && doc.vendeur.iban && (
              <section className="flex flex-col gap-2 rounded-l border border-trait bg-surface p-4 text-[13.5px]">
                <h2 className="text-[15px] font-semibold">Régler par virement</h2>
                <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <dt className="text-encre-3">Montant</dt>
                  <dd className="num m-0 font-semibold">{formatMontant(reste, doc.devise)}</dd>
                  <dt className="text-encre-3">IBAN</dt>
                  <dd className="num m-0 min-w-0 whitespace-normal break-words">{formatIban(doc.vendeur.iban)}</dd>
                  {doc.vendeur.bic && (
                    <>
                      <dt className="text-encre-3">BIC</dt>
                      <dd className="num m-0">{doc.vendeur.bic}</dd>
                    </>
                  )}
                  <dt className="text-encre-3">Référence</dt>
                  <dd className="num m-0">{doc.numero}</dd>
                </dl>
                {svg && (
                  <figure className="m-0 mt-2 flex flex-col items-center gap-1">
                    <div className="size-36 [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />
                    <figcaption className="text-[12px] text-encre-3">Scannez avec votre application bancaire</figcaption>
                  </figure>
                )}
              </section>
            )}
            {d.status === 'paye' && (
              <section className="rounded-l border border-ok/30 bg-ok-doux p-4 text-[13.5px] text-ok">Cette facture est réglée. Merci !</section>
            )}
          </aside>
        </div>
        <p className="text-center text-[12px] text-encre-3">Document émis par {doc.vendeur.name} avec Pastille.</p>
      </div>
    </main>
  )
}
