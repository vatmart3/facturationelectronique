/**
 * Rôles d'un membre dans une organisation. Les valeurs sont celles de l'enum
 * Postgres public.member_role ; les droits réels sont imposés par les politiques RLS,
 * ces fonctions ne servent qu'à adapter l'interface.
 */

export const ROLES = ['owner', 'admin', 'billing', 'viewer', 'accountant'] as const
export type Role = (typeof ROLES)[number]

export const LIBELLES_ROLE: Record<Role, string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  billing: 'Facturation',
  viewer: 'Lecture seule',
  accountant: 'Expert-comptable',
}

export const DESCRIPTIONS_ROLE: Record<Role, string> = {
  owner: 'Tous les droits, y compris l’abonnement et la gestion des propriétaires.',
  admin: 'Tous les droits sur l’entreprise et ses membres, sauf les propriétaires.',
  billing: 'Crée et émet devis, factures et avoirs, gère clients et paiements.',
  viewer: 'Consulte et télécharge, sans rien modifier.',
  accountant: 'Consulte et exporte les écritures, journaux et factures.',
}

export function estRole(valeur: unknown): valeur is Role {
  return typeof valeur === 'string' && (ROLES as readonly string[]).includes(valeur)
}

export function peutModifierOrganisation(role: Role): boolean {
  return role === 'owner' || role === 'admin'
}

export function peutGererMembres(role: Role): boolean {
  return role === 'owner' || role === 'admin'
}

/** Rôles qu'un membre peut attribuer : seul un propriétaire peut nommer un propriétaire. */
export function rolesAttribuables(role: Role): Role[] {
  if (role === 'owner') return [...ROLES]
  if (role === 'admin') return ROLES.filter((r) => r !== 'owner')
  return []
}

/** Un membre peut-il modifier ou retirer un autre membre ayant le rôle `cible` ? */
export function peutAgirSur(role: Role, cible: Role): boolean {
  if (!peutGererMembres(role)) return false
  return cible !== 'owner' || role === 'owner'
}

export function peutFacturer(role: Role): boolean {
  return role === 'owner' || role === 'admin' || role === 'billing'
}
