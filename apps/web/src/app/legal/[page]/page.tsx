import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Article, PageSite } from '@/components/site/Site'
import { classesBouton } from '@/components/ui/Bouton'
import { TEXTES, texte } from '@/lib/legal'

export function generateStaticParams() {
  return TEXTES.map((t) => ({ page: t.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ page: string }> }): Promise<Metadata> {
  const t = texte((await params).page)
  return t ? { title: t.titre, description: t.description, robots: { index: true, follow: true }, alternates: { canonical: `/legal/${t.slug}` } } : {}
}

export default async function PageLegale({ params }: { params: Promise<{ page: string }> }) {
  const t = texte((await params).page)
  if (!t) notFound()
  return (
    <PageSite>
      <Article titre={t.titre} chapo={t.description} maj={t.maj}>
        {t.sections.map((s) => (
          <section key={s.titre} className="flex flex-col gap-2">
            <h2>{s.titre}</h2>
            {s.paragraphes.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </section>
        ))}
        {t.slug === 'dpa' && (
          <p>
            {/* Téléchargement d'un fichier généré par une route : lien classique. */}
            <a href="/legal/dpa/pdf" download className={`${classesBouton('secondaire')} no-underline`}>
              Télécharger le DPA (PDF)
            </a>
          </p>
        )}
      </Article>
    </PageSite>
  )
}
