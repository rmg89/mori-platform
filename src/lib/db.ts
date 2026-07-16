// ─────────────────────────────────────────────────────────────────────────────
// Mori Platform — Supabase data layer (server-only, uses the service-role client)
// Fetches from Supabase and maps rows into the Engagement shape the app expects.
// ─────────────────────────────────────────────────────────────────────────────

import { supabaseAdmin } from '@/lib/supabase'
import type {
  Engagement, EngagementContact, CommEntry, EngagementCall,
  OutgoingMaterial, IncomingMaterial, BriefingNote,
  EngagementFlag, MediaFlag, PostEventFlag, WrapUpFlagStages,
  EngagementAlert,
} from '@/types'

const supabase = supabaseAdmin()

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
  invoice_finalized_at: string | null
  payment_received_at: string | null
  deposit_amount: number | null
  deposit_invoice_sent_at: string | null
  deposit_finalized_at: string | null
  deposit_received_at: string | null
  payment_notes: string | null
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
  wrap_up_review_needed: boolean
  booking_review_needed: boolean
  outgoing_materials: unknown[] | null
  incoming_materials: unknown[] | null
  outgoing_not_needed: boolean
  incoming_not_needed: boolean
  not_needed: string[] | null
  post_event_needed: string[] | null
  post_event_not_needed: string[] | null
  post_event_item_notes: Record<string, string> | null
  post_event_media: unknown[] | null
  post_event_testimonial_link: string | null
  post_event_testimonial_text: string | null
  post_event_follow_up_date: string | null
}

interface ContactRow {
  id: string
  engagement_id: string | null
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
  company_id: string | null
  team_id: string | null
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
  next_step: string | null
  next_step_due_at: string | null
  next_step_snoozed_until: string | null
  next_step_cleared: boolean | null
}

interface CallRow {
  id: string
  engagement_id: string
  type: string
  status: string
  number: number | null
  requested_at: string | null
  scheduled_at: string | null
  scheduled_tz: string | null
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
    company_id: row.company_id ?? undefined,
    team_id: row.team_id ?? undefined,
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
    next_step: row.next_step ?? undefined,
    next_step_due_at: row.next_step_due_at ?? undefined,
    next_step_snoozed_until: row.next_step_snoozed_until ?? undefined,
    next_step_cleared: row.next_step_cleared ?? undefined,
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
    scheduled_tz: row.scheduled_tz ?? undefined,
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
  const not_needed = new Set<PostEventFlag>(row.post_event_not_needed as PostEventFlag[] ?? [])
  const stages: WrapUpFlagStages = {}

  if (row.invoice_sent_at) {
    done.push('invoice')
    stages.invoice = row.payment_received_at ? 'paid' : 'sent'
  } else if (row.invoice_finalized_at) {
    stages.invoice = 'finalized'
  }
  if (row.thank_you_sent)        done.push('thank_you')
  if (row.testimonial_requested) done.push('testimonial')
  if (row.media_received) {
    done.push('media')
    stages.media = row.media_processed ? 'processed' : row.media_uploaded ? 'uploaded' : 'received'
  }
  if (row.social_media_complete) done.push('social_media')
  if (row.follow_up_required === false && row.section === 'wrap-up') not_needed.add('follow_up')

  const needed = (row.post_event_needed as PostEventFlag[] ?? [])

  return { done, needed, not_needed: Array.from(not_needed), stages }
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
  // Compare whole calendar days in local time to avoid UTC midnight timezone shifts
  if (row.event_date && row.section === 'engagements') {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const [y, m, d] = (row.event_date as string).split('-').map(Number)
    const eventDate = new Date(y, m - 1, d)
    const daysUntil = Math.round((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
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
    // Spread all raw Supabase columns first so nothing is silently dropped
    // (briefing fields, run_of_show, not_needed, etc. all pass through automatically)
    ...(row as unknown as Record<string, unknown>),

    // Then override with properly typed / transformed values
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
    invoice_finalized_at: row.invoice_finalized_at ?? undefined,
    wrap_up_review_needed: row.wrap_up_review_needed ?? false,
    booking_review_needed: row.booking_review_needed ?? false,
    deposit_amount: row.deposit_amount ?? undefined,
    deposit_invoice_sent_at: row.deposit_invoice_sent_at ?? undefined,
    deposit_finalized_at: row.deposit_finalized_at ?? undefined,
    deposit_received_at: row.deposit_received_at ?? undefined,
    payment_notes: row.payment_notes ?? undefined,

    // Prefer JSONB columns (UI edits) — fall back to materials table rows (Claude MCP inserts)
    outgoing_materials: (row.outgoing_materials as OutgoingMaterial[] | null)?.length
      ? row.outgoing_materials as OutgoingMaterial[]
      : materials.filter(m => m.direction === 'outgoing').map(mapOutgoing),
    outgoing_not_needed: row.outgoing_not_needed ?? false,
    incoming_materials: (row.incoming_materials as IncomingMaterial[] | null)?.length
      ? row.incoming_materials as IncomingMaterial[]
      : materials.filter(m => m.direction === 'incoming').map(mapIncoming),
    incoming_not_needed: row.incoming_not_needed ?? false,

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

export async function fetchAllEngagements(origin: string): Promise<Engagement[]> {
  // Auto-transition any confirmed engagement whose event date has passed into wrap-up
  const today = new Date().toISOString().split('T')[0]
  const { data: transitioned } = await supabase
    .from('engagements')
    .update({ section: 'wrap-up', wrap_up_review_needed: true })
    .eq('section', 'engagements')
    .eq('archived', false)
    .lt('event_date', today)
    .select('id')

  ;(transitioned ?? []).forEach((row: { id: string }) => {
    fetch(`${origin}/api/ai/scan-engagement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engagement_id: row.id, scan_type: 'wrapup' }),
    }).catch(() => {})
  })

  const [
    { data: engRows, error: engError },
    { data: contactRows },
    { data: commRows },
    { data: callRows },
    { data: materialRows },
    { data: briefingRows },
  ] = await Promise.all([
    supabase.from('engagements').select('*').order('created_at', { ascending: false }),
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


export async function updateEngagementRow(id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('engagements').update(patch).eq('id', id)
  if (error) throw new Error(`updateEngagementRow: ${error.message}`)
}

export async function deleteEngagementRow(id: string): Promise<void> {
  const { error } = await supabase.from('engagements').delete().eq('id', id)
  if (error) throw new Error(`deleteEngagementRow: ${error.message}`)
}

export async function insertEngagementRow(input: {
  organization: string
  company_id?: string
  prospect_step?: string
  event_type?: string
  source?: string
  topic?: string
  event_city?: string
  fee?: number
  notes?: string
  contacts?: {
    first_name: string; last_name?: string; email?: string; phone?: string; title?: string
    company_id?: string; is_current_point_of_contact?: boolean
  }[]
}): Promise<Engagement> {
  const now = new Date().toISOString()
  const { data: row, error } = await supabase.from('engagements').insert({
    organization: input.organization,
    company_id: input.company_id || null,
    section: 'prospects',
    prospect_step: input.prospect_step ?? 'inquiry',
    event_type: input.event_type ?? 'speaking',
    source: input.source || null,
    topic: input.topic || null,
    event_city: input.event_city || null,
    fee: input.fee ?? null,
    notes: input.notes || null,
    created_at: now, updated_at: now, last_activity_at: now,
  }).select('*').single()
  if (error) throw new Error(`insertEngagementRow: ${error.message}`)

  let contacts: ContactRow[] = []
  if (input.contacts?.length) {
    const { data: contactRows, error: contactError } = await supabase.from('contacts').insert(
      input.contacts.map(c => ({
        engagement_id: row.id,
        first_name: c.first_name,
        last_name: c.last_name || '',
        email: c.email || null,
        phone: c.phone || null,
        title: c.title || null,
        // Preserve a contact's own company link (e.g. picked from another org) —
        // only fall back to this engagement's company for genuinely new contacts.
        company_id: c.company_id ?? input.company_id ?? null,
        role: 'primary',
        is_current_point_of_contact: c.is_current_point_of_contact ?? false,
        status: 'prospect_active',
        watching: false,
      }))
    ).select('*')
    if (contactError) console.error('insertEngagementRow contacts:', contactError.message)
    else if (contactRows) contacts = contactRows as ContactRow[]
  }

  return assembleEngagement(row as EngagementRow, contacts, [], [], [], [])
}

export async function insertContact(engagement_id: string | null, contact: Omit<ContactRow, 'id' | 'engagement_id'>): Promise<string | null> {
  const { data, error } = await supabase.from('contacts').insert({ ...contact, engagement_id }).select('id').single()
  if (error) { console.error('insertContact:', error.message); return null }
  return data.id
}

export async function upsertContact(contact: Partial<ContactRow> & { engagement_id: string | null }): Promise<void> {
  // Only upsert if the id looks like a real UUID (not a temp id from the UI)
  if (!contact.id || /^(new_|lnk_)/.test(contact.id)) return
  const { error } = await supabase.from('contacts').upsert(contact)
  if (error) throw new Error(`upsertContact: ${error.message}`)
}

// Contacts with no engagement_id — created directly from the Contacts directory,
// not as part of a prospect/engagement.
export async function fetchUnassignedContacts(): Promise<EngagementContact[]> {
  const { data, error } = await supabase.from('contacts').select('*').is('engagement_id', null)
  if (error) throw new Error(`fetchUnassignedContacts: ${error.message}`)
  return (data as ContactRow[]).map(mapContact)
}

export async function deleteContactRow(id: string): Promise<void> {
  const { error } = await supabase.from('contacts').delete().eq('id', id)
  if (error) throw new Error(`deleteContactRow: ${error.message}`)
}

export async function fetchCompanies(): Promise<import('@/types').Company[]> {
  const { data, error } = await supabase.from('companies').select('*').order('name')
  if (error) { console.warn('fetchCompanies:', error.message); return [] }
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    name: row.name as string,
    industry: (row.industry as string) ?? undefined,
    website: (row.website as string) ?? undefined,
    notes: (row.notes as string) ?? undefined,
    watching: (row.watching as boolean) ?? false,
    teams: [],
    engagement_ids: [],
    contact_ids: [],
  }))
}

export async function updateCompanyRow(id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('companies').update(patch).eq('id', id)
  if (error) throw new Error(`updateCompanyRow: ${error.message}`)
}

export async function deleteCompanyRow(id: string): Promise<void> {
  const { error } = await supabase.from('companies').delete().eq('id', id)
  if (error) throw new Error(`deleteCompanyRow: ${error.message}`)
}

export async function insertCompanyRow(input: { name: string; website?: string; industry?: string }): Promise<import('@/types').Company> {
  const { data, error } = await supabase.from('companies').insert({
    name: input.name,
    website: input.website || null,
    industry: input.industry || null,
  }).select('*').single()
  if (error) throw new Error(`insertCompanyRow: ${error.message}`)
  return {
    id: data.id as string,
    name: data.name as string,
    industry: (data.industry as string) ?? undefined,
    website: (data.website as string) ?? undefined,
    notes: (data.notes as string) ?? undefined,
    watching: (data.watching as boolean) ?? false,
    teams: [],
    engagement_ids: [],
    contact_ids: [],
  }
}

export async function insertComm(comm: Omit<CommRow, 'id'>): Promise<void> {
  const { error } = await supabase.from('communications').insert(comm)
  if (error) throw new Error(`insertComm: ${error.message}`)
}

export async function updateCommRow(id: string, patch: Partial<CommRow>): Promise<void> {
  const { error } = await supabase.from('communications').update(patch).eq('id', id)
  if (error) throw new Error(`updateCommRow: ${error.message}`)
}

export async function upsertCall(call: Partial<CallRow> & { engagement_id: string }): Promise<void> {
  const { error } = await supabase.from('calls').upsert(call)
  if (error) throw new Error(`upsertCall: ${error.message}`)
}

