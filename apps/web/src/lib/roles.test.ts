import { describe, expect, it } from 'vitest'
import { estRole, peutAgirSur, peutFacturer, peutGererMembres, peutModifierOrganisation, ROLES, rolesAttribuables } from './roles'

describe('rôles', () => {
  it('reconnaît les rôles valides', () => {
    expect(estRole('owner')).toBe(true)
    expect(estRole('superadmin')).toBe(false)
    expect(estRole(undefined)).toBe(false)
  })

  it('réserve la gestion aux propriétaires et administrateurs', () => {
    expect(ROLES.filter(peutGererMembres)).toEqual(['owner', 'admin'])
    expect(ROLES.filter(peutModifierOrganisation)).toEqual(['owner', 'admin'])
    expect(ROLES.filter(peutFacturer)).toEqual(['owner', 'admin', 'billing'])
  })

  it('seul un propriétaire peut nommer ou toucher un propriétaire', () => {
    expect(rolesAttribuables('owner')).toContain('owner')
    expect(rolesAttribuables('admin')).not.toContain('owner')
    expect(rolesAttribuables('billing')).toEqual([])
    expect(peutAgirSur('admin', 'owner')).toBe(false)
    expect(peutAgirSur('owner', 'owner')).toBe(true)
    expect(peutAgirSur('admin', 'billing')).toBe(true)
    expect(peutAgirSur('viewer', 'viewer')).toBe(false)
  })
})
