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
export type DocumentType = 'facture' | 'devis' | 'acompte' | 'avoir'
export type DocumentStatus = 'brouillon' | 'emis' | 'envoye' | 'partiellement_paye' | 'paye' | 'annule' | 'accepte' | 'refuse' | 'expire' | 'transforme'

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
  reminders_enabled: boolean
  reminder_days: number[]
  reminder_email_from: string | null
  reminder_signature: string | null
  pa_provider: 'simulee' | 'afnor'
  pa_account_id: string | null
  pa_auto_transmit: boolean
  pa_mandate_at: string | null
  ereporting_frequency: 'decade' | 'mois' | 'bimestre'
  closed_at: string | null
  payment_link: string | null
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

export type DocumentRow = {
  id: string
  organization_id: string
  type: DocumentType
  status: DocumentStatus
  client_id: string | null
  number: string | null
  sequence_key: string | null
  sequence_number: number | null
  issue_date: string
  service_date: string | null
  service_period_start: string | null
  service_period_end: string | null
  due_date: string | null
  valid_until: string | null
  purchase_order: string | null
  subject: string | null
  public_notes: string | null
  internal_notes: string | null
  currency: string
  language: 'fr' | 'en'
  payment_terms: PaymentTerms | null
  early_payment_discount: string | null
  discount_kind: DiscountKind | null
  discount_value: number | null
  total_lines_ht: number
  discount_total: number
  deposits_ht: number
  total_ht: number
  total_vat: number
  total_ttc: number
  amount_due: number
  amount_paid: number
  operation_category: 'biens' | 'services' | 'mixte' | null
  origin_document_id: string | null
  deducted_deposits: unknown
  seller_snapshot: unknown
  client_snapshot: unknown
  content_hash: string | null
  previous_hash: string | null
  chain_position: number | null
  public_token: string | null
  issued_at: string | null
  issued_by: string | null
  sent_at: string | null
  accepted_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type DocumentLineRow = {
  id: string
  organization_id: string
  document_id: string
  position: number
  product_id: string | null
  designation: string
  description: string | null
  quantity_milli: number
  unit: string
  unit_price_cents: number
  discount_kind: DiscountKind | null
  discount_value: number | null
  vat_category: CategorieTva
  vat_rate: number
  exemption_reason: string | null
  nature: ItemNature
  line_net_cents: number
  created_at: string
  updated_at: string
}

export type PaymentMethod = 'virement' | 'carte' | 'cheque' | 'especes' | 'prelevement' | 'autre'
export type RecurrenceFrequency = 'mensuelle' | 'trimestrielle' | 'semestrielle' | 'annuelle'

export type PaymentRow = {
  id: string
  organization_id: string
  document_id: string
  amount_cents: number
  paid_on: string
  method: PaymentMethod
  reference: string | null
  note: string | null
  created_by: string | null
  created_at: string
}

export type ReminderRow = {
  id: string
  organization_id: string
  document_id: string
  step: number | null
  kind: 'envoi' | 'relance' | 'remerciement'
  recipient: string
  subject: string
  status: 'envoye' | 'simule' | 'echec'
  provider_id: string | null
  error: string | null
  sent_by: string | null
  sent_at: string
}

export type RecurringInvoiceRow = {
  id: string
  organization_id: string
  client_id: string
  name: string
  frequency: RecurrenceFrequency
  next_date: string
  end_date: string | null
  mode: 'brouillon' | 'emission'
  active: boolean
  template: unknown
  last_document_id: string | null
  last_run_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type QuoteSignatureRow = {
  document_id: string
  organization_id: string
  decision: 'accepte' | 'refuse'
  signer_name: string
  signer_email: string | null
  comment: string | null
  content_hash: string
  user_agent: string | null
  signed_at: string
}

export type TransmissionRow = {
  id: string
  organization_id: string
  document_id: string
  provider: string
  flow_id: string | null
  format: 'factur-x' | 'cii' | 'ubl'
  status_code: number
  status_label: string
  history: unknown
  error: string | null
  created_by: string | null
  sent_at: string
  updated_at: string
}

export type ReceivedInvoiceRow = {
  id: string
  organization_id: string
  provider: string
  flow_id: string
  format: 'factur-x' | 'cii' | 'ubl'
  type_code: string
  number: string
  issue_date: string
  due_date: string | null
  seller_name: string
  seller_siren: string | null
  seller_vat: string | null
  currency: string
  total_ht: number
  total_vat: number
  total_ttc: number
  amount_due: number
  vat_breakdown: unknown
  lines: unknown
  xml: string
  status: 'a_traiter' | 'approuvee' | 'refusee' | 'litige' | 'payee'
  status_code: number
  motive: string | null
  history: unknown
  received_at: string
  updated_at: string
}

export type EreportingRow = {
  id: string
  organization_id: string
  kind: 'transactions' | 'paiements'
  period_start: string
  period_end: string
  provider: string
  flow_id: string | null
  status: 'depose' | 'accepte' | 'rejete'
  summary: unknown
  created_by: string | null
  sent_at: string
}

export type DocumentVatSummaryRow = {
  organization_id: string
  document_id: string
  position: number
  vat_category: CategorieTva
  vat_rate: number
  base_cents: number
  vat_cents: number
  exemption_reason: string | null
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
      documents: {
        Row: DocumentRow
        Insert: Insertion<DocumentRow, 'organization_id' | 'type'>
        Update: Partial<Omit<DocumentRow, Auto | 'organization_id'>>
        Relationships: [
          {
            foreignKeyName: 'documents_client_id_organization_id_fkey'
            columns: ['client_id', 'organization_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id', 'organization_id']
          },
        ]
      }
      document_lines: {
        Row: DocumentLineRow
        Insert: Insertion<DocumentLineRow, 'organization_id' | 'document_id' | 'position'>
        Update: Partial<Omit<DocumentLineRow, Auto | 'organization_id' | 'document_id'>>
        Relationships: []
      }
      document_vat_summary: {
        Row: DocumentVatSummaryRow
        Insert: DocumentVatSummaryRow
        Update: never
        Relationships: [
          {
            foreignKeyName: 'document_vat_summary_document_id_organization_id_fkey'
            columns: ['document_id', 'organization_id']
            isOneToOne: false
            referencedRelation: 'documents'
            referencedColumns: ['id', 'organization_id']
          },
        ]
      }
      audit_log: {
        Row: { id: number; organization_id: string; actor_id: string | null; action: string; entity: string; entity_id: string | null; details: unknown; created_at: string }
        Insert: never
        Update: never
        Relationships: []
      }
      document_sequences: {
        Row: { organization_id: string; sequence_key: string; last_number: number; updated_at: string }
        Insert: never
        Update: never
        Relationships: []
      }
      payments: {
        Row: PaymentRow
        Insert: Insertion<PaymentRow, 'organization_id' | 'document_id' | 'amount_cents'>
        Update: never
        Relationships: [
          {
            foreignKeyName: 'payments_document_id_organization_id_fkey'
            columns: ['document_id', 'organization_id']
            isOneToOne: false
            referencedRelation: 'documents'
            referencedColumns: ['id', 'organization_id']
          },
        ]
      }
      reminders: {
        Row: ReminderRow
        Insert: Insertion<ReminderRow, 'organization_id' | 'document_id' | 'kind' | 'recipient' | 'subject' | 'status'>
        Update: never
        Relationships: [
          {
            foreignKeyName: 'reminders_document_id_organization_id_fkey'
            columns: ['document_id', 'organization_id']
            isOneToOne: false
            referencedRelation: 'documents'
            referencedColumns: ['id', 'organization_id']
          },
        ]
      }
      recurring_invoices: {
        Row: RecurringInvoiceRow
        Insert: Insertion<RecurringInvoiceRow, 'organization_id' | 'client_id' | 'name' | 'frequency' | 'next_date' | 'template'>
        Update: Partial<Omit<RecurringInvoiceRow, Auto | 'organization_id'>>
        Relationships: [
          {
            foreignKeyName: 'recurring_invoices_client_id_organization_id_fkey'
            columns: ['client_id', 'organization_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id', 'organization_id']
          },
        ]
      }
      einvoice_transmissions: {
        Row: TransmissionRow
        Insert: Insertion<TransmissionRow, 'organization_id' | 'document_id' | 'provider' | 'format'>
        Update: Partial<Pick<TransmissionRow, 'status_code' | 'status_label' | 'history' | 'error' | 'flow_id'>>
        Relationships: [
          {
            foreignKeyName: 'einvoice_transmissions_document_id_organization_id_fkey'
            columns: ['document_id', 'organization_id']
            isOneToOne: false
            referencedRelation: 'documents'
            referencedColumns: ['id', 'organization_id']
          },
        ]
      }
      received_invoices: {
        Row: ReceivedInvoiceRow
        Insert: Insertion<
          ReceivedInvoiceRow,
          'organization_id' | 'provider' | 'flow_id' | 'format' | 'number' | 'issue_date' | 'seller_name' | 'total_ht' | 'total_vat' | 'total_ttc' | 'amount_due' | 'xml'
        >
        Update: Partial<Pick<ReceivedInvoiceRow, 'status' | 'status_code' | 'motive' | 'history'>>
        Relationships: []
      }
      ereporting_reports: {
        Row: EreportingRow
        Insert: Insertion<EreportingRow, 'organization_id' | 'kind' | 'period_start' | 'period_end' | 'provider' | 'summary'>
        Update: never
        Relationships: []
      }
      subscriptions: {
        Row: {
          organization_id: string
          plan: 'solo' | 'pro' | 'studio'
          status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'unpaid'
          trial_ends_at: string | null
          current_period_end: string | null
          cancel_at_period_end: boolean
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          organization_id: string
          plan?: 'solo' | 'pro' | 'studio'
          status?: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'unpaid'
          trial_ends_at?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: Partial<Database['public']['Tables']['subscriptions']['Insert']>
        Relationships: []
      }
      invitations: {
        Row: { id: string; organization_id: string; email: string; role: MemberRole; token: string; invited_by: string | null; expires_at: string; accepted_at: string | null; created_at: string }
        Insert: { organization_id: string; email: string; role: MemberRole }
        Update: never
        Relationships: []
      }
      platform_admins: { Row: { user_id: string; created_at: string }; Insert: { user_id: string }; Update: never; Relationships: [] }
      announcements: {
        Row: { id: string; title: string; body: string; level: 'info' | 'important'; starts_at: string; ends_at: string | null; created_at: string }
        Insert: { title: string; body: string; level?: 'info' | 'important'; starts_at?: string; ends_at?: string | null }
        Update: Partial<{ title: string; body: string; level: 'info' | 'important'; starts_at: string; ends_at: string | null }>
        Relationships: []
      }
      error_logs: {
        Row: { id: number; organization_id: string | null; kind: 'pdf' | 'facturx' | 'email' | 'plateforme' | 'stripe' | 'autre'; message: string; context: unknown; created_at: string }
        Insert: { organization_id?: string | null; kind: 'pdf' | 'facturx' | 'email' | 'plateforme' | 'stripe' | 'autre'; message: string; context?: unknown }
        Update: never
        Relationships: [
          { foreignKeyName: 'error_logs_organization_id_fkey'; columns: ['organization_id']; isOneToOne: false; referencedRelation: 'organizations'; referencedColumns: ['id'] },
        ]
      }
      quote_signatures: {
        Row: QuoteSignatureRow
        Insert: never
        Update: never
        Relationships: []
      }
      vat_rates: {
        Row: { id: string; territory: string; label: string; rate: number; valid_from: string; valid_to: string | null; created_at: string }
        Insert: { territory: string; label: string; rate: number; valid_from: string; valid_to?: string | null }
        Update: { valid_to?: string | null }
        Relationships: []
      }
      legal_mentions: {
        Row: { key: string; text: string; applies_when: string; updated_at: string }
        Insert: never
        Update: { text?: string; updated_at?: string }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      create_organization: { Args: { p_name: string }; Returns: OrganizationRow }
      enregistrer_brouillon: {
        Args: { p_organization: string; p_id: string | null; p_document: unknown; p_lignes: unknown; p_tva: unknown }
        Returns: string
      }
      emettre_document: { Args: { p_id: string }; Returns: DocumentRow }
      lien_public: { Args: { p_id: string }; Returns: string }
      invitation: { Args: { p_token: string }; Returns: unknown }
      accepter_invitation: { Args: { p_token: string }; Returns: string }
      supprimer_mon_compte: { Args: { p_confirmation: string }; Returns: { supprimees: number; closes: number } }
      document_public: { Args: { p_token: string }; Returns: unknown }
      signer_devis: {
        Args: { p_token: string; p_decision: string; p_nom: string; p_email: string | null; p_commentaire: string | null; p_agent: string }
        Returns: string
      }
      changer_statut: { Args: { p_id: string; p_statut: DocumentStatus }; Returns: DocumentRow }
      verifier_chaine: {
        Args: { p_organization: string }
        Returns: Array<{ chain_position: number; document_id: string; number: string; empreinte_ok: boolean; lien_ok: boolean }>
      }
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
