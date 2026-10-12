import type { Metadata } from 'next'
import { Logo } from '@/components/marque/Logo'
import { diagnosticConfig, lireConfigSupabase, normaliserCle } from '@/lib/supabase/env'

export const metadata: Metadata = { title: 'État du service', robots: { index: false } }
export const dynamic = 'force-dynamic'

type Controle = { libelle: string; ok: boolean; detail?: string }

async function joindre(url: string, cle: string): Promise<{ ok: boolean; statut?: number; erreur?: string; corps?: string }> {
  try {
    const r = await fetch(url, { headers: { apikey: cle, Authorization: `Bearer ${cle}` }, cache: 'no-store', signal: AbortSignal.timeout(5000) })
    return { ok: r.ok, statut: r.status, corps: await r.text() }
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : String(e) }
  }
}

/** Diagnostic de mise en ligne : configuration, accès à Supabase, base installée. Aucune clé n'est affichée. */
export default async function Sante() {
  const config = lireConfigSupabase()
  const controles: Controle[] = []
  const problemes = diagnosticConfig()
  controles.push({ libelle: 'Variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', ok: problemes.length === 0, detail: problemes.join(' ') || config?.url })
  controles.push({
    libelle: 'Clé serveur SUPABASE_SERVICE_ROLE_KEY (back-office et tâches)',
    ok: normaliserCle(process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY) !== null,
    detail: 'Facultative pour se connecter ; nécessaire pour /admin.',
  })

  if (config) {
    const auth = await joindre(`${config.url}/auth/v1/settings`, config.cle)
    controles.push({
      libelle: 'Service de connexion Supabase joignable avec cette clé',
      ok: auth.ok,
      detail: auth.ok ? undefined : auth.erreur ?? `Réponse ${auth.statut} : ${(auth.corps ?? '').slice(0, 300)}`,
    })
    if (auth.ok) {
      try {
        const reglages = JSON.parse(auth.corps ?? '{}') as { mailer_autoconfirm?: boolean; disable_signup?: boolean }
        controles.push({ libelle: 'Inscriptions ouvertes', ok: !reglages.disable_signup })
        controles.push({
          libelle: 'Inscription sans confirmation par email (« Confirm email » désactivé)',
          ok: Boolean(reglages.mailer_autoconfirm),
          detail: reglages.mailer_autoconfirm ? undefined : 'Confirmation activée : sans SMTP configuré, seuls les membres de l’équipe Supabase reçoivent l’email.',
        })
      } catch {
        // Réglages illisibles : le contrôle précédent suffit.
      }
    }
    const base = await joindre(`${config.url}/rest/v1/rpc/invitation?p_token=00000000-0000-0000-0000-000000000000`, config.cle)
    controles.push({
      libelle: 'Base de données installée (pastille-installation.sql)',
      ok: base.ok,
      detail: base.ok ? undefined : base.erreur ?? `Réponse ${base.statut} : ${(base.corps ?? '').slice(0, 300)}`,
    })
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[720px] flex-col gap-6 px-4 py-12">
      <Logo />
      <div className="flex flex-col gap-1">
        <h1 className="text-[24px] font-bold">État du service</h1>
        <p className="text-encre-2">Vérifications de la mise en ligne. Aucune clé n’est affichée sur cette page.</p>
      </div>
      <ul className="flex flex-col gap-2">
        {controles.map((c) => (
          <li key={c.libelle} className="flex gap-3 rounded-m border border-trait bg-surface px-4 py-3">
            <span aria-hidden="true" className={c.ok ? 'font-bold text-ok' : 'font-bold text-alerte'}>
              {c.ok ? '✓' : '✗'}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium">
                <span className="sr-only">{c.ok ? 'Correct : ' : 'À corriger : '}</span>
                {c.libelle}
              </span>
              {c.detail && <span className="break-words text-[13px] text-encre-2">{c.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </main>
  )
}
