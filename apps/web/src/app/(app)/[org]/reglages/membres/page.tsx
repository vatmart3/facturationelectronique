import type { Metadata } from 'next'
import { BoutonRetirer, SelecteurRole } from '@/components/organisation/ActionsMembre'
import { Avatar } from '@/components/ui/Avatar'
import { Bouton } from '@/components/ui/Bouton'
import { Etiquette } from '@/components/ui/Categorie'
import { Panneau, PanneauCorps, PanneauTete } from '@/components/ui/Panneau'
import { Tableau, Td, Th } from '@/components/ui/Tableau'
import { formatDate } from '@/lib/format'
import { DESCRIPTIONS_ROLE, estRole, LIBELLES_ROLE, peutAgirSur, peutGererMembres, ROLES, rolesAttribuables } from '@/lib/roles'
import { chargerContexte } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Membres et rôles' }

export default async function Membres({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params
  const { organisation, role, utilisateur } = await chargerContexte(org)
  const supabase = await creerClientServeur()

  const { data: adhesions } = await supabase
    .from('memberships')
    .select('user_id, role, created_at')
    .eq('organization_id', organisation.id)
    .order('created_at')
  const ids = (adhesions ?? []).map((a) => a.user_id)
  const { data: profils } = ids.length
    ? await supabase.from('profiles').select('id, email, full_name').in('id', ids)
    : { data: [] }
  const parId = new Map((profils ?? []).map((p) => [p.id, p]))

  const membres = (adhesions ?? []).flatMap((a) => {
    if (!estRole(a.role)) return []
    const p = parId.get(a.user_id)
    return [{ id: a.user_id, role: a.role, depuis: a.created_at, nom: p?.full_name ?? null, email: p?.email ?? '' }]
  })
  const gere = peutGererMembres(role)

  return (
    <>
      <Panneau>
        <PanneauTete
          titre="Membres"
          description={`${membres.length} membre${membres.length > 1 ? 's' : ''}`}
          actions={
            gere && (
              <Bouton icone="plus" taille="s" disabled title="Les invitations par email arrivent avec les offres équipe.">
                Inviter
              </Bouton>
            )
          }
        />
        <div className="[&>div]:rounded-none [&>div]:border-0">
          <Tableau legende="Membres de l’entreprise" largeurMin={620}>
            <thead>
              <tr>
                <Th>Membre</Th>
                <Th>Rôle</Th>
                <Th>Depuis</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {membres.map((m) => {
                const soiMeme = m.id === utilisateur.id
                const nom = m.nom ?? m.email
                const modifiable = !soiMeme && peutAgirSur(role, m.role)
                return (
                  <tr key={m.id}>
                    <Td>
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar nom={nom} />
                        <div className="flex min-w-0 flex-col leading-tight">
                          <span className="truncate font-semibold">
                            {nom}
                            {soiMeme && <span className="font-normal text-encre-3"> (vous)</span>}
                          </span>
                          {m.nom && <span className="truncate text-[12px] text-encre-3">{m.email}</span>}
                        </div>
                      </div>
                    </Td>
                    <Td>
                      {modifiable ? (
                        <SelecteurRole slug={org} userId={m.id} role={m.role} roles={rolesAttribuables(role)} nom={nom} />
                      ) : (
                        <Etiquette>{LIBELLES_ROLE[m.role]}</Etiquette>
                      )}
                    </Td>
                    <Td className="text-encre-3">{formatDate(m.depuis)}</Td>
                    <Td className="text-right">
                      {(modifiable || soiMeme) && <BoutonRetirer slug={org} userId={m.id} soiMeme={soiMeme} nom={nom} />}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Tableau>
        </div>
      </Panneau>

      <Panneau>
        <PanneauTete titre="Rôles" description="Les droits sont appliqués par la base de données, pas seulement par l’interface." />
        <PanneauCorps className="gap-0 py-1">
          <dl className="m-0">
            {ROLES.map((r) => (
              <div key={r} className="grid gap-1 border-b border-trait py-2.5 last:border-b-0 sm:grid-cols-[180px_minmax(0,1fr)]">
                <dt className="font-medium">{LIBELLES_ROLE[r]}</dt>
                <dd className="m-0 text-[13.5px] text-encre-2">{DESCRIPTIONS_ROLE[r]}</dd>
              </div>
            ))}
          </dl>
        </PanneauCorps>
      </Panneau>
    </>
  )
}
