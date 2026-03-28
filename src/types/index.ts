// ─── Pipeline Buckets & Steps ─────────────────────────────────────────────────

export type PipelineBucket = 'prospect' | 'client' | 'complete'

export type ProspectStep   = 'new_inquiry' | 'contacted' | 'proposal_sent' | 'negotiating'
export type ClientStep     = 'contract_sent' | 'confirmed' | 'briefing_ready' | 'event_day'
export type CompleteStep   = 'post_event' | 'invoiced' | 'paid'
export type PipelineStep   = ProspectStep | ClientStep | CompleteStep

export const BUCKETS: {
  id: PipelineBucket
  label: string
  color: string
  accent: string
  steps: { id: PipelineStep; label: string }[]
}[] = [
  {
    id: 'prospect',
    label: 'Prospects',
    color: '#7A9E87',
    accent: '#A8C4B0',
    steps: [
      { id: 'new_inquiry',    label: 'New Inquiry' },
      { id: 'contacted',      label: 'Contacted' },
      { id: 'proposal_sent',  label: 'Proposal Sent' },
      { id: 'negotiating',    label: 'Negotiating' },
    ],
  },
  {
    id: 'client',
    label: 'Clients',
    color: '#C9A84C',
    accent: '#E8C97A',
    steps: [
      { id: 'contract_sent',  label: 'Contract Sent' },
      { id: 'confirmed',      label: 'Confirmed' },
      { id: 'briefing_ready', label: 'Briefing Ready' },
      { id: 'event_day',      label: 'Event Day' },
    ],
  },
  {
    id: 'complete',
    label: 'Complete',
    color: '#4A4740',
    accent: '#7D7A72',
    steps: [
      { id: 'post_event', label: 'Post-Event' },
      { id: 'invoiced',   label: 'Invoiced' },
      { id: 'paid',       label: 'Paid' },
    ],
  },
]

export function getBucket(step: PipelineStep): PipelineBucket {
  for (const b of BUCKETS) {
    if (b.steps.some(s => s.id === step)) return b.id
  }
  return 'prospect'
}

export function getStepLabel(step: PipelineStep): string {
  for (const b of BUCKETS) {
    const s = b.steps.find(s => s.id === step)
    if (s) return s.label
  }
  return step
}

export function getBucketForStep(step: PipelineStep) {
  return BUCKETS.find(b => b.steps.some(s => s.id === step))!
}

// ─── Contact (person on an engagement) ───────────────────────────────────────

export type ContactRole =
  | 'primary'
  | 'bureau'
  | 'legal'
  | 'logistics'
  | 'av'
  | 'assistant'
  | 'other'

export interface EngagementContact {
  id: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  title?: string
  role: ContactRole
  is_current_point_of_contact: boolean
  notes?: string
}

// ─── Communication timeline entry ────────────────────────────────────────────

export type CommEntryType =
  | 'email_inbound'
  | 'email_outbound'
  | 'note'
  | 'stage_change'
  | 'document_sent'
  | 'call'
  | 'other_channel' // IG, LinkedIn, etc.

export interface CommEntry {
  id: string
  type: CommEntryType
  date: string
  subject?: string
  body?: string
  from_name?: string
  to_name?: string
  contact_id?: string   // which EngagementContact this is linked to
  staff_name?: string   // which staff member sent/logged it
  channel?: string      // 'email' | 'instagram' | 'linkedin' | 'phone' | 'in_person'
  needs_response?: boolean
  response_due_by?: string
  tagged_manually?: boolean // true if staff manually linked this
}

// ─── Alert ───────────────────────────────────────────────────────────────────

export type AlertType =
  | 'no_response'        // inbound with no reply in X hours
  | 'follow_up_due'      // we sent something, no reply in X days
  | 'stage_stalled'      // hasn't moved in X days
  | 'event_approaching'  // event in ≤14 days, doc not done
  | 'invoice_overdue'    // invoice sent, not paid after 30 days

export interface EngagementAlert {
  type: AlertType
  label: string
  severity: 'high' | 'medium' | 'low'
  since?: string
}

// ─── Engagement (the core record) ────────────────────────────────────────────

export interface Engagement {
  id: string
  created_at: string
  updated_at: string
  last_activity_at: string

  // Pipeline position
  bucket: PipelineBucket
  step: PipelineStep

  // Organization
  organization: string
  source?: string  // how they found Mori

  // Contacts (replaces single contact fields)
  contacts: EngagementContact[]

  // Event details
  event_name?: string
  event_date?: string
  event_location?: string
  event_city?: string
  event_format?: 'in_person' | 'virtual' | 'hybrid'
  audience_size?: number
  topic?: string
  session_length?: number
  fee?: number
  travel_covered?: boolean
  hotel_covered?: boolean

  // AV / Logistics
  av_needs?: string
  special_requirements?: string

  // Internal
  notes?: string
  booker_name?: string

  // Document status
  contract_generated?: boolean
  contract_signed?: boolean
  advance_sheet_generated?: boolean
  invoice_generated?: boolean
  invoice_paid?: boolean

  // Communication timeline
  comms: CommEntry[]

  // Computed alerts (derived from comms + dates)
  alerts: EngagementAlert[]
}

// Convenience: primary contact on an engagement
export function primaryContact(e: Engagement): EngagementContact | undefined {
  return e.contacts.find(c => c.is_current_point_of_contact) ?? e.contacts[0]
}

// ─── Legacy alias (used in documents.ts + dashboard) ─────────────────────────
// Keeps existing code working while we migrate
export type Client = Engagement & {
  first_name: string
  last_name: string
  email: string
  stage: PipelineStep
}

// ─── Document Types ────────────────────────────────────────────────────────────

export interface GeneratedDocument {
  id: string
  engagement_id: string
  type: 'contract' | 'advance_sheet' | 'invoice'
  generated_at: string
  file_url?: string
  version: number
}

// ─── Dashboard Types ──────────────────────────────────────────────────────────

export interface DashboardStats {
  total_active: number
  new_this_month: number
  events_this_month: number
  revenue_confirmed: number
  revenue_pipeline: number
  by_bucket: Record<PipelineBucket, number>
  upcoming_events: Engagement[]
}

// ─── AI Types ─────────────────────────────────────────────────────────────────

export interface InstagramCaptionRequest {
  image_description: string
  topic_prompt: string
  tone?: 'professional' | 'inspiring' | 'conversational' | 'bold'
}

// ─── Document Types ────────────────────────────────────────────────────────────

export interface GeneratedDocument {
  id: string
  client_id: string
  type: 'contract' | 'advance_sheet' | 'invoice'
  generated_at: string
  file_url?: string
  version: number
}

// ─── Email / CRM Types ────────────────────────────────────────────────────────

export interface EmailThread {
  id: string
  contact_name: string
  contact_email: string
  organization?: string
  subject: string
  last_message_at: string
  message_count: number
  messages: EmailMessage[]
  client_id?: string // linked client if known
  is_read: boolean
}

export interface EmailMessage {
  id: string
  thread_id: string
  from_name: string
  from_email: string
  to_email: string
  subject: string
  body: string
  sent_at: string
  is_inbound: boolean
  ai_draft_reply?: string
}

// ─── Dashboard Types ──────────────────────────────────────────────────────────

export interface DashboardStats {
  total_active: number
  new_this_month: number
  events_this_month: number
  revenue_confirmed: number
  revenue_pipeline: number
  by_stage: Record<PipelineStage, number>
  upcoming_events: Client[]
}

// ─── AI Types ─────────────────────────────────────────────────────────────────

export interface InstagramCaptionRequest {
  image_description: string
  topic_prompt: string
  tone?: 'professional' | 'inspiring' | 'conversational' | 'bold'
}
