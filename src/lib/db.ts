"use client"

// ─────────────────────────────────────────────────────────────────────────────
// Mori Platform — Supabase data layer
// Fetches from Supabase and maps rows into the Engagement shape the app expects.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from '@/lib/supabase'
import type {
  Engagement, EngagementContact, CommEntry, EngagementCall,
  OutgoingMaterial, IncomingMaterial, BriefingNote,
  EngagementFlag, MediaFlag, PostEventFlag, WrapUpFlagStages,
  EngagementAlert,
} from '@/types'

// ─── Row types (raw Supabase shapes) ─────────────────────────────────────────

interface EngagementRow {
  id: string
  created_at: string
  updated_at: string
  last_activity_at: string | null
  section: string
  prospect_step: string | null
  cancellation_reason: string | null
  archived: boolean
  archived_at: string | null
  organization: string
  event_name: string | null
  event_type: string | null
  source: string | null
  booker_name: string | null
  topic: string | null
  event_date: string | null
  event_time: string | null
  event_location: string | null
  event_city: string | null
  event_format: string | null
  audience_size: number | null
  session_length: number | null
  av_needs: string | null
  fee: number | null
  travel_covered: boolean | null
  travel_destination: string | null
  hotel_covered: boolean | null
  contract_required: boolean | null
  contract_sent_at: string | null
  contract_signed_at: string | null
  materials_requested: boolean
  client_deliverables_sent: boolean
  advance_sheet_complete: boolean
  briefing_complete: boolean
  briefing_complete_at: string | null
  invoice_sent_at: string | null
  payment_received_at: string | null
  thank_you_sent: boolean
  testimonial_requested: boolean
  media_received: boolean
  media_uploaded: boolean
  media_processed: boolean
  social_media_complete: boolean
  follow_up_required: boolean
  follow_up_details: string | null
  media_confirmed: boolean
  media_bio_sent: boolean
  media_prep_sent: boolean
  media_day_of_ready: boolean
  notes: string | null
  outstanding_items: string | null
  media_links: string | null
}

interface ContactRow {
  id: string
  engagement_id: string
  first_name: string
  last_name: string | null
  email: string | null
  phone: string | null
  title: string | null
  role: string | null
  is_current_point_of_contact: boolean
  status: string | null
  watching: boolean
  notes: string | null
}

interface CommRow {
  id: string
  engagement_id: string
  contact_id: string | null
  type: string
  date: string
  channel: string | null
  subject: string | null
  body: string | null
  from_name: string | null
  to_name: string | null
  staff_name: string | null
  needs_response: boolean
  response_due_by: string | null
}

interface CallRow {
  id: string
  engagement_id: string
  type: string
  status: string
  number: number | null
  requested_at: string | null
  scheduled_at: string | null
  completed_at: string | null
  notes: string | null
  added_by: string | null
}

interface MaterialRow {
  id: string
  engagement_id: string
  direction: string
  label: string
  done: boolean
  added_at: string | null
  sent_at: string | null
  received: boolean
  received_at: string | null
  note: string | null
  url: string | null
}

interface BriefingNoteRow {
  id: string
  engagement_id: string
  body: string
  resolved: boolean
  created_at: string
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapContact(row: ContactRow): EngagementContact {
  return {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name ?? '',
    email: row.email ?? '',
    phone: row.phone ?? undefined,
    title: row.title ?? undefined,
    role: (row.role as EngagementContact['role']) ?? 'primary',
    is_current_point_of_contact: row.is_current_point_of_contact,
    status: (row.status as EngagementContact['status']) ?? undefined,
    watching: row.watching,
    notes: row.notes ?? undefined,
  }
}

function mapComm(row: CommRow): CommEntry {
  return {
    id: row.id,
    type: row.type as CommEntry['type'],
    date: row.date,
    subject: row.subject ?? undefined,
    body: row.body ?? undefined,
    from_name: row.from_name ?? undefined,
    to_name: row.to_name ?? undefined,
    contact_id: row.contact_id ?? undefined,
    staff_name: row.staff_name ?? undefined,
    channel: row.channel ?? undefined,
    needs_response: row.needs_response,
    response_due_by: row.response_due_by ?? undefined,
  }
}

function mapCall(row: CallRow): EngagementCall {
  return {
    id: row.id,
    type: row.type as EngagementCall['type'],
    status: row.status as EngagementCall['status'],
    number: row.number ?? 1,
    requested_at: row.requested_at ?? undefined,
    scheduled_at: row.scheduled_at ?? undefined,
    completed_at: row.completed_at ?? undefined,
    notes: row.notes ?? undefined,
    added_by: (row.added_by as 'ai' | 'manual') ?? 'manual',
  }
}

function mapOutgoing(row: MaterialRow): OutgoingMaterial {
  return {
    id: row.id,
    label: row.label,
    done: row.done,
    added_at: row.added_at ?? undefined,
    sent_at: row.sent_at ?? undefined,
  }
}

function mapIncoming(row: MaterialRow): IncomingMaterial {
  return {
    id: row.id,
    label: row.label,
    received: row.received,
    added_at: row.added_at ?? undefined,
    received_at: row.received_at ?? undefined,
    note: row.note ?? undefined,
    link: row.url ?? undefined,
  }
}

function mapBriefingNote(row: BriefingNoteRow): BriefingNote {
  return {
    id: row.id,
    body: row.body,
    resolved: row.resolved,
    created_at: row.created_at,
  }
}

// Derive engagement_flags array from boolean columns
function deriveEngagementFlags(row: EngagementRow): EngagementFlag[] {
  const flags: EngagementFlag[] = []
  if (row.contract_sent_at)          flags.push('contract_sent')
  if (row.contract_signed_at)        flags.push('contract_signed')
  if (row.client_deliverables_sent)  flags.push('client_deliverables_sent')
  if (row.advance_sheet_complete)    flags.push('advance_sheet_complete')
  if (row.materials_requested)       flags.push('materials_requested')
  return flags
}

// Derive media_flags array from boolean columns
function deriveMediaFlags(row: EngagementRow): MediaFlag[] {
  const flags: MediaFlag[] = []
  if (row.media_confirmed)   flags.push('confirmed')
  if (row.media_bio_sent)    flags.push('bio_sent')
  if (row.media_prep_sent)   flags.push('prep_sent')
  if (row.media_day_of_ready) flags.push('day_of_ready')
  return flags
}

// Derive post_event_flags, needed, not_needed from boolean columns
function derivePostEventFlags(row: EngagementRow): {
  done: PostEventFlag[]
  needed: PostEventFlag[]
  not_needed: PostEventFlag[]
  stages: WrapUpFlagStages
} {
  const done: PostEventFlag[] = []
  const not_needed: PostEventFlag[] = []
  const stages: WrapUpFlagStages = {}

  if (row.invoice_sent_at) {
    done.push('invoice')
    stages.invoice = row.payment_received_at ? 'paid' : 'sent'
  }
  if (row.thank_you_sent)        done.push('thank_you')
  if (row.testimonial_requested) done.push('testimonial')
  if (row.media_received) {
    done.push('media')
    stages.media = row.media_processed ? 'processed' : row.media_uploaded ? 'uploaded' : 'received'
  }
  if (row.social_media_complete) done.push('social_media')
  if (row.follow_up_required === false && row.section === 'wrap-up') not_needed.push('follow_up')

  return { done, needed: [], not_needed, stages }
}

// Derive alerts from engagement state
function deriveAlerts(row: EngagementRow): EngagementAlert[] {
  const alerts: EngagementAlert[] = []
  const now = new Date()

  // Invoice overdue (sent but not paid, 30+ days)
  if (row.invoice_sent_at && !row.payment_received_at) {
    const sentDate = new Date(row.invoice_sent_at)
    const daysSince = Math.floor((now.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24))
    if (daysSince > 30) {
      alerts.push({ type: 'invoice_overdue', label: `Invoice unpaid — ${daysSince} days outstanding`, severity: 'high' })
    }
  }

  // Event approaching (within 7 days)
  if (row.event_date && row.section === 'engagements') {
    const eventDate = new Date(row.event_date)
    const daysUntil = Math.floor((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (daysUntil >= 0 && daysUntil <= 7) {
      alerts.push({ type: 'event_approaching', label: `Event in ${daysUntil === 0 ? 'today' : `${daysUntil} day${daysUntil === 1 ? '' : 's'}`} — ${row.organization}`, severity: 'high' })
    }
  }

  return alerts
}

// Assemble a full Engagement from row + related rows
function assembleEngagement(
  row: EngagementRow,
  contacts: ContactRow[],
  comms: CommRow[],
  calls: CallRow[],
  materials: MaterialRow[],
  briefingNotes: BriefingNoteRow[],
): Engagement {
  const postEvent = derivePostEventFlags(row)

  return {
    id: row.id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_activity_at: row.last_activity_at ?? row.updated_at,

    section: row.section as Engagement['section'],
    prospect_step: row.prospect_step as Engagement['prospect_step'] ?? undefined,
    event_type: row.event_type as Engagement['event_type'] ?? undefined,

    engagement_flags: deriveEngagementFlags(row),
    media_flags: deriveMediaFlags(row),
    post_event_flags: postEvent.done,
    post_event_stages: postEvent.stages,
    post_event_needed: postEvent.needed,
    post_event_not_needed: postEvent.not_needed,
    post_event_follow_up_details: row.follow_up_details ?? undefined,

    contract_required: row.contract_required ?? undefined,
    contract_sent_at: row.contract_sent_at ?? undefined,
    contract_signed_at: row.contract_signed_at ?? undefined,
    briefing_complete: row.briefing_complete,
    briefing_complete_at: row.briefing_complete_at ?? undefined,
    briefing_notes: briefingNotes.map(mapBriefingNote),
    invoice_sent_at: row.invoice_sent_at ?? undefined,

    outgoing_materials: materials.filter(m => m.direction === 'outgoing').map(mapOutgoing),
    incoming_materials: materials.filter(m => m.direction === 'incoming').map(mapIncoming),

    organization: row.organization,
    source: row.source ?? undefined,
    booker_name: row.booker_name ?? undefined,
    topic: row.topic ?? undefined,
    event_name: row.event_name ?? undefined,
    event_date: row.event_date ?? undefined,
    event_time: row.event_time ?? undefined,
    event_location: row.event_location ?? undefined,
    event_city: row.event_city ?? undefined,
    event_format: row.event_format as Engagement['event_format'] ?? undefined,
    audience_size: row.audience_size ?? undefined,
    session_length: row.session_length ?? undefined,
    fee: row.fee ?? undefined,
    travel_covered: row.travel_covered ?? undefined,
    hotel_covered: row.hotel_covered ?? undefined,
    av_needs: row.av_needs ?? undefined,
    notes: row.notes ?? undefined,

    contacts: contacts.map(mapContact),
    comms: comms.map(mapComm),
    calls: calls.map(mapCall),
    alerts: deriveAlerts(row),
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchAllEngagements(): Promise<Engagement[]> {
  const [
    { data: engRows, error: engError },
    { data: contactRows },
    { data: commRows },
    { data: callRows },
    { data: materialRows },
    { data: briefingRows },
  ] = await Promise.all([
    supabase.from('engagements').select('*').eq('archived', false).order('created_at', { ascending: false }),
    supabase.from('contacts').select('*'),
    supabase.from('communications').select('*').order('date', { ascending: true }),
    supabase.from('calls').select('*'),
    supabase.from('materials').select('*'),
    supabase.from('briefing_notes').select('*').order('created_at', { ascending: true }),
  ])

  if (engError) throw new Error(`fetchAllEngagements: ${engError.message}`)

  return (engRows as EngagementRow[]).map(row =>
    assembleEngagement(
      row,
      (contactRows as ContactRow[] ?? []).filter(c => c.engagement_id === row.id),
      (commRows as CommRow[] ?? []).filter(c => c.engagement_id === row.id),
      (callRows as CallRow[] ?? []).filter(c => c.engagement_id === row.id),
      (materialRows as MaterialRow[] ?? []).filter(m => m.engagement_id === row.id),
      (briefingRows as BriefingNoteRow[] ?? []).filter(b => b.engagement_id === row.id),
    )
  )
}

export async function fetchEngagement(id: string): Promise<Engagement | null> {
  const [
    { data: row, error },
    { data: contactRows },
    { data: commRows },
    { data: callRows },
    { data: materialRows },
    { data: briefingRows },
  ] = await Promise.all([
    supabase.from('engagements').select('*').eq('id', id).single(),
    supabase.from('contacts').select('*').eq('engagement_id', id),
    supabase.from('communications').select('*').eq('engagement_id', id).order('date', { ascending: true }),
    supabase.from('calls').select('*').eq('engagement_id', id),
    supabase.from('materials').select('*').eq('engagement_id', id),
    supabase.from('briefing_notes').select('*').eq('engagement_id', id).order('created_at', { ascending: true }),
  ])

  if (error || !row) return null

  return assembleEngagement(
    row as EngagementRow,
    (contactRows as ContactRow[]) ?? [],
    (commRows as CommRow[]) ?? [],
    (callRows as CallRow[]) ?? [],
    (materialRows as MaterialRow[]) ?? [],
    (briefingRows as BriefingNoteRow[]) ?? [],
  )
}

export async function updateEngagementRow(id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('engagements').update(patch).eq('id', id)
  if (error) throw new Error(`updateEngagementRow: ${error.message}`)
}

export async function upsertContact(contact: Partial<ContactRow> & { engagement_id: string }): Promise<void> {
  const { error } = await supabase.from('contacts').upsert(contact)
  if (error) throw new Error(`upsertContact: ${error.message}`)
}

export async function insertComm(comm: Omit<CommRow, 'id'>): Promise<void> {
  const { error } = await supabase.from('communications').insert(comm)
  if (error) throw new Error(`insertComm: ${error.message}`)
}

export async function upsertCall(call: Partial<CallRow> & { engagement_id: string }): Promise<void> {
  const { error } = await supabase.from('calls').upsert(call)
  if (error) throw new Error(`upsertCall: ${error.message}`)
}

export async function upsertMaterial(material: Partial<MaterialRow> & { engagement_id: string }): Promise<void> {
  const { error } = await supabase.from('materials').upsert(material)
  if (error) throw new Error(`upsertMaterial: ${error.message}`)
}

export async function insertBriefingNote(note: Omit<BriefingNoteRow, 'id' | 'created_at'>): Promise<void> {
  const { error } = await supabase.from('briefing_notes').insert(note)
  if (error) throw new Error(`insertBriefingNote: ${error.message}`)
}

export async function updateBriefingNote(id: string, patch: Partial<BriefingNoteRow>): Promise<void> {
  const { error } = await supabase.from('briefing_notes').update(patch).eq('id', id)
  if (error) throw new Error(`updateBriefingNote: ${error.message}`)
}

export async function archiveEngagement(id: string): Promise<void> {
  const { error } = await supabase.from('engagements').update({ archived: true, archived_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(`archiveEngagement: ${error.message}`)
}