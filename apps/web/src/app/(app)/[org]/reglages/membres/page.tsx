import type { Metadata } from 'next'
import { BoutonRetirer, SelecteurRole } from '@/components/organisation/ActionsMembre'
import { Avatar } from '@/components/ui/Avatar'
import { Etiquette } from '@/components/ui/Categorie'
import { Panneau, PanneauCorps, PanneauTete } from '@/components/ui/Panneau'
import { Tableau, Td, Th } from '@/components/ui/Tableau'
import { annulerInvitation, inviterMembre } from '@/app/actions/compte'
import { BoutonAction } from '@/components/documents/Actions'
import { ChampSuivi, FormulaireSuivi } from '@/components/documents/Suivi'
import { formatDate } from '@/lib/format'
import { offre } from '@/lib/offres'
import { DESCRIPTIONS_ROLE, estRole, LIBELLES_ROLE, peutAgirSur, peutGererMembres, ROLES, rolesAttribuables } from '@/lib/roles'
import { chargerContexte } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Membres et rôles' }

const CHAMP = 'h-[34px] w-full rounded-m border border-trait-fort bg-surface px-2.5 text-[13.5px] font-normal text-encre outline-none focus:border-accent'

export default async function Membres({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params
  const { organisation, roleReel: role, utilisateur, abonnement } = await chargerContexte(org)
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
  const { data: invitations } = gere
    ? await supabase.from('invitations').select('id, email, role, expires_at').eq('organization_id', organisation.id).is('accepted_at', null).order('created_at')
    : { data: [] }
  const limite = offre(abonnement.plan).utilisateurs

  return (
    <>
      <Panneau>
        <PanneauTete
          titre="Membres"
          description={`${membres.length} membre${membres.length > 1 ? 's' : ''} sur ${limite} avec l’offre ${offre(abonnement.plan).nom}`}
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

      {gere && (
        <Panneau>
          <PanneauTete titre="Inviter un membre" description="Un collaborateur, ou votre expert-comptable en accès lecture et exports." />
          <PanneauCorps>
            <FormulaireSuivi action={inviterMembre.bind(null, org)} bouton="Envoyer l’invitation">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
                <ChampSuivi libelle="Email">
                  <input name="email" type="email" required autoComplete="off" className={CHAMP} />
                </ChampSuivi>
                <ChampSuivi libelle="Rôle">
                  <select name="role" defaultValue="accountant" className={CHAMP}>
                    {rolesAttribuables(role)
                      .filter((r) => r !== 'owner')
                      .map((r) => (
                        <option key={r} value={r}>
                          {LIBELLES_ROLE[r]}
                        </option>
                      ))}
                  </select>
                </ChampSuivi>
              </div>
            </FormulaireSuivi>
            {(invitations ?? []).length > 0 && (
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {(invitations ?? []).map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 rounded-m bg-surface-2 px-3 py-2 text-[13px]">
                    <span>
                      {i.email} · {estRole(i.role) ? LIBELLES_ROLE[i.role] : i.role}
                      <span className="text-encre-3"> · expire le {formatDate(i.expires_at)}</span>
                    </span>
                    <BoutonAction action={annulerInvitation.bind(null, org, i.id)} variante="fantome">
                      Annuler
                    </BoutonAction>
                  </li>
                ))}
              </ul>
            )}
          </PanneauCorps>
        </Panneau>
      )}

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
