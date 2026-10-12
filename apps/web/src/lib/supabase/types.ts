/**
 * Types de la base, alignés sur supabase/migrations.
 * À régénérer après chaque migration : pnpm db:types (voir README).
 */

export type MemberRole = 'owner' | 'admin' | 'billing' | 'viewer' | 'accountant'
export type VatRegime = 'franchise' | 'reel_simplifie' | 'reel_normal' | 'non_assujetti'

export type OrganizationRow = {
  id: string
  slug: string
  name: string
  legal_form: string | null
  share_capital_cents: number | null
  siren: string | null
  siret: string | null
  vat_number: string | null
  naf_code: string | null
  registration: string | null
  address_line1: string | null
  address_line2: string | null
  postal_code: string | null
  city: string | null
  country_code: string
  vat_regime: VatRegime | null
  vat_on_debits: boolean
  iban: string | null
  bic: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type OrganizationUpdate = Partial<
  Pick<
    OrganizationRow,
    | 'name'
    | 'legal_form'
    | 'share_capital_cents'
    | 'siren'
    | 'siret'
    | 'vat_number'
    | 'naf_code'
    | 'registration'
    | 'address_line1'
    | 'address_line2'
    | 'postal_code'
    | 'city'
    | 'country_code'
    | 'vat_regime'
    | 'vat_on_debits'
    | 'iban'
    | 'bic'
  >
>

export type MembershipRow = {
  organization_id: string
  user_id: string
  role: MemberRole
  created_at: string
  updated_at: string
}

export type ProfileRow = {
  id: string
  email: string | null
  full_name: string | null
  created_at: string
  updated_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: never
        Update: Pick<ProfileRow, 'full_name'>
        Relationships: []
      }
      organizations: {
        Row: OrganizationRow
        Insert: never
        Update: OrganizationUpdate
        Relationships: []
      }
      memberships: {
        Row: MembershipRow
        Insert: Pick<MembershipRow, 'organization_id' | 'user_id' | 'role'>
        Update: Pick<MembershipRow, 'role'>
        Relationships: [
          {
            foreignKeyName: 'memberships_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      create_organization: {
        Args: { p_name: string }
        Returns: OrganizationRow
      }
    }
    Enums: {
      member_role: MemberRole
      vat_regime: VatRegime
    }
    CompositeTypes: Record<string, never>
  }
}
