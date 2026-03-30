// ─── Pipeline Steps ────────────────────────────────────────────────────────────

export type ProspectStep = 'inquiry' | 'outreach' | 'in_contact' | 'discussing' | 'confirmed' | 'declined'
export type EngagementFlag = 'contract_sent' | 'contract_signed' | 'advance_sheet_sent' | 'logistics_confirmed' | 'day_of_ready'
export type PostEventFlag = 'invoice_sent' | 'invoice_paid' | 'media_uploaded' | 'marked_complete'
export type Section = 'prospects' | 'engagements' | 'post-event'

export const PROSPECT_STEPS: { id: ProspectStep; label: string; entry?: boolean; terminal?: boolean }[] = [
  { id: 'inquiry',    label: 'Inquiry',    entry: true },
  { id: 'outreach',   label: 'Outreach',   entry: true },
  { id: 'in_contact', label: 'In Contact' },
  { id: 'discussing', label: 'Discussing' },
  { id: 'confirmed',  label: 'Confirmed',  terminal: true },
  { id: 'declined',   label: 'Declined',   terminal: true },
]

export const ENGAGEMENT_FLAGS: { id: EngagementFlag; label: string }[] = [
  { id: 'contract_sent',      label: 'Contract Sent' },
  { id: 'contract_signed',    label: 'Contract Signed' },
  { id: 'advance_sheet_sent', label: 'Advance Sheet Sent' },
  { id: 'logistics_confirmed',label: 'Logistics Confirmed' },
  { id: 'day_of_ready',       label: 'Day-Of Ready' },
]

export const POST_EVENT_FLAGS: { id: PostEventFlag; label: string }[] = [
  { id: 'invoice_sent',     label: 'Invoice Sent' },
  { id: 'invoice_paid',     label: 'Invoice Paid' },
  { id: 'media_uploaded',   label: 'Media Uploaded' },
  { id: 'marked_complete',  label: 'Complete' },
]

// ─── Contact ──────────────────────────────────────────────────────────────────

export type ContactRole = 'primary' | 'bureau' | 'legal' | 'logistics' | 'av' | 'assistant' | 'other'
export type ContactStatus = 'prospect_active' | 'prospect_expired' | 'client'

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
  status?: ContactStatus
  watching?: boolean
}

// ─── Communication ────────────────────────────────────────────────────────────

export type CommEntryType = 'email_inbound' | 'email_outbound' | 'note' | 'stage_change' | 'document_sent' | 'call' | 'other_channel'

export interface CommEntry {
  id: string
  type: CommEntryType
  date: string
  subject?: string
  body?: string
  from_name?: string
  to_name?: string
  contact_id?: string
  staff_name?: string
  channel?: string
  needs_response?: boolean
  response_due_by?: string
  tagged_manually?: boolean
}

// ─── Alert ────────────────────────────────────────────────────────────────────

export type AlertType = 'no_response' | 'follow_up_due' | 'stage_stalled' | 'event_approaching' | 'invoice_overdue'

export interface EngagementAlert {
  type: AlertType
  label: string
  severity: 'high' | 'medium' | 'low'
  since?: string
}

// ─── Review Queue Item ────────────────────────────────────────────────────────

export type ReviewItemState = 'ai_sorted' | 'needs_review'
export type ReviewAction = 'create_prospect' | 'add_to_existing' | 'ignore'

export interface ReviewItem {
  id: string
  received_at: string
  from_name: string
  from_email: string
  subject: string
  body_preview: string
  account: string // which M365 account received it
  ai_confidence: number // 0-1
  state: ReviewItemState
  ai_suggested_action: ReviewAction
  ai_suggested_engagement_id?: string // if add_to_existing
  ai_reasoning: string
  confirmed_by?: string
  confirmed_at?: string
}

// ─── Engagement ───────────────────────────────────────────────────────────────

export interface Engagement {
  id: string
  created_at: string
  updated_at: string
  last_activity_at: string

  section: Section
  prospect_step?: ProspectStep
  engagement_flags: EngagementFlag[]
  post_event_flags: PostEventFlag[]

  // AI confirmation status (for auto-sorted items)
  ai_created?: boolean
  human_confirmed?: boolean

  organization: string
  source?: string
  contacts: EngagementContact[]

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
  av_needs?: string
  special_requirements?: string
  notes?: string
  booker_name?: string

  comms: CommEntry[]
  alerts: EngagementAlert[]
}

export function primaryContact(e: Engagement): EngagementContact | undefined {
  return e.contacts.find(c => c.is_current_point_of_contact) ?? e.contacts[0]
}

export function getProspectStepLabel(step: ProspectStep): string {
  return PROSPECT_STEPS.find(s => s.id === step)?.label ?? step
}

// ─── Document Types ───────────────────────────────────────────────────────────

export interface GeneratedDocument {
  id: string
  engagement_id: string
  type: 'contract' | 'advance_sheet' | 'invoice'
  generated_at: string
  file_url?: string
  version: number
}

// ─── AI Types ─────────────────────────────────────────────────────────────────

export interface InstagramCaptionRequest {
  image_description: string
  topic_prompt: string
  tone?: 'professional' | 'inspiring' | 'conversational' | 'bold'
}

// ─── Company ──────────────────────────────────────────────────────────────────

export interface CompanyTeam {
  id: string
  name: string // e.g. "Women's Initiative", "Leadership Development"
}

export interface Company {
  id: string
  name: string
  industry?: string
  website?: string
  notes?: string
  watching?: boolean
  teams: CompanyTeam[]
  // derived from engagements
  engagement_ids: string[]
  contact_ids: string[]
}

// ─── User ─────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'regular'

export interface TeamUser {
  id: string
  name: string
  email: string
  role: UserRole
  account: string // which M365 account they own
  avatar_initials: string
}