import type { ReactNode } from 'react'
import { CoqueApp } from '@/components/coque/CoqueApp'
import { REGIMES_TVA } from '@/lib/organisation'
import { chargerContexte } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export default async function LayoutOrganisation({ children, params }: { children: ReactNode; params: Promise<{ org: string }> }) {
  const { org } = await params
  const { organisation, organisations, utilisateur, abonnement, roleReel } = await chargerContexte(org)
  const supabase = await creerClientServeur()
  const { data: annonces } = await supabase.from('announcements').select('id, title, body, level').order('starts_at', { ascending: false }).limit(3)
  const lienAbonnement = `/${org}/reglages/abonnement`
  const gestion = roleReel === 'owner' || roleReel === 'admin'
  const bandeau = !abonnement.actif
    ? {
        texte: `${abonnement.libelle} : vos documents restent consultables et téléchargeables, mais plus rien ne peut être créé ni émis.`,
        lien: lienAbonnement,
        libelleLien: gestion ? 'Choisir une offre' : 'Voir l’abonnement',
        ton: 'alerte' as const,
      }
    : abonnement.essai && (abonnement.joursRestants ?? 0) <= 7
      ? { texte: abonnement.libelle, lien: lienAbonnement, libelleLien: 'Choisir une offre', ton: 'info' as const }
      : null
  const regime = REGIMES_TVA.find((r) => r.valeur === organisation.vat_regime)?.libelle
  const detail = [organisation.legal_form, regime].filter(Boolean).join(' · ') || 'Identité à compléter'

  return (
    <CoqueApp
      organisation={{ slug: organisation.slug, nom: organisation.name, detail }}
      organisations={organisations.map((o) => ({ slug: o.slug, nom: o.nom, role: o.role }))}
      utilisateur={{ email: utilisateur.email, nom: utilisateur.nom }}
      bandeau={bandeau}
      annonces={annonces ?? []}
    >
      {children}
    </CoqueApp>
  )
}
