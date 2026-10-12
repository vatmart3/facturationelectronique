/**
 * Types de la base, alignés sur supabase/migrations.
 * À vérifier après chaque migration avec : pnpm db:types (voir README).
 */

import type { CategorieTva } from '@pastille/moteur'

export type MemberRole = 'owner' | 'admin' | 'billing' | 'viewer' | 'accountant'
export type VatRegime = 'franchise' | 'reel_simplifie' | 'reel_normal' | 'non_assujetti'
export type ClientKind = 'b2b' | 'b2c' | 'b2g' | 'ue' | 'hors_ue'
export type ItemNature = 'bien' | 'service' | 'debours'
export type DiscountKind = 'pourcentage' | 'montant'
export type PaymentTerms = 'reception' | '15j' | '30j' | '30jfm' | '45jfm' | '60j'

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
  default_payment_terms: PaymentTerms
  late_penalty_terms: string
  early_payment_discount: string
  invoice_number_format: string
  quote_number_format: string
  credit_number_format: string
  accent_color: string
  invoice_template: 'galet' | 'papeterie' | 'classique'
  invoice_font: 'grotesque' | 'serif'
  logo_path: string | null
  footer_text: string | null
  terms_text: string | null
  onboarding_completed_at: string | null
  invoice_start_number: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export type OrganizationUpdate = Partial<Omit<OrganizationRow, 'id' | 'slug' | 'created_by' | 'created_at' | 'updated_at'>>

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

export type ClientRow = {
  id: string
  organization_id: string
  kind: ClientKind
  name: string
  legal_form: string | null
  siren: string | null
  siret: string | null
  vat_number: string | null
  einvoice_address: string | null
  service_code: string | null
  billing_line1: string | null
  billing_line2: string | null
  billing_postal_code: string | null
  billing_city: string | null
  billing_country: string
  shipping_different: boolean
  shipping_line1: string | null
  shipping_line2: string | null
  shipping_postal_code: string | null
  shipping_city: string | null
  shipping_country: string | null
  default_vat_category: CategorieTva | null
  default_vat_rate: number | null
  exemption_reason: string | null
  default_discount_kind: DiscountKind | null
  default_discount_value: number | null
  payment_terms: PaymentTerms | null
  early_payment_discount: string | null
  currency: string
  language: 'fr' | 'en'
  purchase_order_required: boolean
  custom_mentions: string | null
  reminders_enabled: boolean
  notes: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export type ClientContactRow = {
  id: string
  organization_id: string
  client_id: string
  name: string
  email: string | null
  phone: string | null
  role: string | null
  receives_invoices: boolean
  created_at: string
  updated_at: string
}

export type ProductRow = {
  id: string
  organization_id: string
  name: string
  description: string | null
  reference: string | null
  unit: string
  unit_price_cents: number
  vat_category: CategorieTva
  vat_rate: number
  nature: ItemNature
  category: string | null
  accounting_account: string | null
  favorite: boolean
  archived_at: string | null
  created_at: string
  updated_at: string
}

export type ClientPriceRow = {
  organization_id: string
  client_id: string
  product_id: string
  unit_price_cents: number
  created_at: string
  updated_at: string
}

type Auto = 'id' | 'created_at' | 'updated_at'
type Insertion<T, Requis extends keyof T> = Pick<T, Requis> & Partial<Omit<T, Auto | Requis>>


export type Database = {
  public: {
    Tables: {
      profiles: { Row: ProfileRow; Insert: never; Update: Pick<ProfileRow, 'full_name'>; Relationships: [] }
      organizations: { Row: OrganizationRow; Insert: never; Update: OrganizationUpdate; Relationships: [] }
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
      clients: {
        Row: ClientRow
        Insert: Insertion<ClientRow, 'organization_id' | 'kind' | 'name'>
        Update: Partial<Omit<ClientRow, Auto | 'organization_id'>>
        Relationships: []
      }
      client_contacts: {
        Row: ClientContactRow
        Insert: Insertion<ClientContactRow, 'organization_id' | 'client_id' | 'name'>
        Update: Partial<Omit<ClientContactRow, Auto | 'organization_id' | 'client_id'>>
        Relationships: []
      }
      products: {
        Row: ProductRow
        Insert: Insertion<ProductRow, 'organization_id' | 'name' | 'unit_price_cents'>
        Update: Partial<Omit<ProductRow, Auto | 'organization_id'>>
        Relationships: []
      }
      client_prices: {
        Row: ClientPriceRow
        Insert: Insertion<ClientPriceRow, 'organization_id' | 'client_id' | 'product_id' | 'unit_price_cents'>
        Update: Pick<ClientPriceRow, 'unit_price_cents'>
        Relationships: [
          {
            foreignKeyName: 'client_prices_product_id_organization_id_fkey'
            columns: ['product_id', 'organization_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id', 'organization_id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      create_organization: { Args: { p_name: string }; Returns: OrganizationRow }
    }
    Enums: {
      member_role: MemberRole
      vat_regime: VatRegime
      client_kind: ClientKind
      item_nature: ItemNature
      discount_kind: DiscountKind
      payment_terms: PaymentTerms
    }
    CompositeTypes: Record<string, never>
  }
}
