import { NextRequest, NextResponse } from 'next/server'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// ─── Supabase (service role — server-side only, bypasses RLS safely) ──────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Auth ─────────────────────────────────────────────────────────────────────
function isAuthorized(_req: NextRequest): boolean {
  return true // TODO: re-enable auth
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function engSummary(e: Record<string, unknown>) {
  return {
    id: e.id, organization: e.organization, event_name: e.event_name,
    event_type: e.event_type, section: e.section, prospect_step: e.prospect_step,
    event_date: e.event_date, event_city: e.event_city, event_format: e.event_format,
    fee: e.fee, last_activity_at: e.last_activity_at, notes: e.notes,
  }
}

// ─── MCP Server factory ───────────────────────────────────────────────────────
function createMcpServer() {
  const server = new McpServer({ name: 'mori-platform', version: '1.0.0' })

  server.tool('list_engagements',
    'List engagements from the pipeline. Filter by section (prospects, engagements, wrap-up), prospect stage, event type, or organization name.',
    {
      section: z.enum(['prospects', 'engagements', 'wrap-up']).optional(),
      prospect_step: z.string().optional(),
      event_type: z.string().optional(),
      organization: z.string().optional(),
      limit: z.number().optional().default(20),
    },
    async ({ section, prospect_step, event_type, organization, limit }) => {
      let q = supabase.from('engagements').select('*').eq('archived', false).order('last_activity_at', { ascending: false }).limit(limit ?? 20)
      if (section) q = q.eq('section', section)
      if (prospect_step) q = q.eq('prospect_step', prospect_step)
      if (event_type) q = q.eq('event_type', event_type)
      if (organization) q = q.ilike('organization', `%${organization}%`)
      const { data, error } = await q
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify((data ?? []).map(engSummary), null, 2) }] }
    }
  )

  server.tool('get_engagement',
    'Get full details for a single engagement including contacts, recent communications, calls, materials, and briefing notes.',
    {
      id: z.string().optional().describe('Engagement UUID'),
      organization: z.string().optional().describe('Organization name'),
    },
    async ({ id, organization }) => {
      let row: Record<string, unknown> | null = null
      if (id) {
        const { data } = await supabase.from('engagements').select('*').eq('id', id).single()
        row = data
      } else if (organization) {
        const { data } = await supabase.from('engagements').select('*').ilike('organization', `%${organization}%`).eq('archived', false).order('last_activity_at', { ascending: false }).limit(1).single()
        row = data
      }
      if (!row) return { content: [{ type: 'text' as const, text: 'Engagement not found.' }] }
      const [{ data: contacts }, { data: comms }, { data: calls }, { data: materials }, { data: notes }] = await Promise.all([
        supabase.from('contacts').select('*').eq('engagement_id', row.id),
        supabase.from('communications').select('*').eq('engagement_id', row.id).order('date', { ascending: false }).limit(10),
        supabase.from('calls').select('*').eq('engagement_id', row.id),
        supabase.from('materials').select('*').eq('engagement_id', row.id),
        supabase.from('briefing_notes').select('*').eq('engagement_id', row.id).eq('resolved', false),
      ])
      return { content: [{ type: 'text' as const, text: JSON.stringify({ ...row, contacts, recent_communications: comms, calls, materials, open_briefing_notes: notes }, null, 2) }] }
    }
  )

  server.tool('search_engagements',
    'Search engagements by keyword across organization, event name, contact names, notes, and topic.',
    { query: z.string() },
    async ({ query }) => {
      const [{ data: byOrg }, { data: byNotes }] = await Promise.all([
        supabase.from('engagements').select('*').eq('archived', false).ilike('organization', `%${query}%`).limit(10),
        supabase.from('engagements').select('*').eq('archived', false).ilike('notes', `%${query}%`).limit(10),
      ])
      const { data: contactRows } = await supabase.from('contacts').select('engagement_id').or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
      const ids = (contactRows ?? []).map((c: Record<string, unknown>) => c.engagement_id as string)
      const { data: byContact } = ids.length > 0 ? await supabase.from('engagements').select('*').in('id', ids) : { data: [] }
      const all = [...(byOrg ?? []), ...(byNotes ?? []), ...(byContact ?? [])]
      const unique = Array.from(new Map(all.map(e => [e.id, e])).values())
      return { content: [{ type: 'text' as const, text: JSON.stringify(unique.map(engSummary), null, 2) }] }
    }
  )

  server.tool('get_dashboard_summary',
    'Get a high-level summary: counts, upcoming events, items needing response, unpaid invoices, stale prospects. Use for "what do I need to focus on today".',
    {},
    async () => {
      const today = new Date().toISOString().split('T')[0]
      const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const staleDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const [
        { count: prospects }, { count: engagements }, { count: wrapup },
        { data: upcoming }, { data: needsResponse }, { data: stale }, { data: unpaid },
      ] = await Promise.all([
        supabase.from('engagements').select('*', { count: 'exact', head: true }).eq('section', 'prospects').eq('archived', false),
        supabase.from('engagements').select('*', { count: 'exact', head: true }).eq('section', 'engagements').eq('archived', false),
        supabase.from('engagements').select('*', { count: 'exact', head: true }).eq('section', 'wrap-up').eq('archived', false),
        supabase.from('engagements').select('id,organization,event_name,event_date,event_city').eq('section', 'engagements').gte('event_date', today).lte('event_date', in30).order('event_date'),
        supabase.from('communications').select('engagement_id,subject,from_name,date').eq('needs_response', true).order('date', { ascending: false }).limit(10),
        supabase.from('engagements').select('id,organization,prospect_step,last_activity_at').eq('section', 'prospects').eq('archived', false).lt('last_activity_at', staleDate).limit(10),
        supabase.from('engagements').select('id,organization,invoice_sent_at').eq('section', 'wrap-up').not('invoice_sent_at', 'is', null).is('payment_received_at', null).limit(10),
      ])
      return { content: [{ type: 'text' as const, text: JSON.stringify({ counts: { prospects, engagements, wrapup }, upcoming_events: upcoming ?? [], needs_response: needsResponse ?? [], stale_prospects: stale ?? [], unpaid_invoices: unpaid ?? [] }, null, 2) }] }
    }
  )

  server.tool('get_upcoming_events',
    'Get confirmed engagements sorted by date. Use for "what do I have coming up" questions.',
    { days_ahead: z.number().optional().default(60) },
    async ({ days_ahead }) => {
      const today = new Date().toISOString().split('T')[0]
      const future = new Date(Date.now() + (days_ahead ?? 60) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const { data, error } = await supabase.from('engagements').select('*').eq('section', 'engagements').eq('archived', false).gte('event_date', today).lte('event_date', future).order('event_date')
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify((data ?? []).map(engSummary), null, 2) }] }
    }
  )

  server.tool('get_stale_prospects',
    'Get prospects with no activity in the last N days. Use for follow-up reviews.',
    { days: z.number().optional().default(7) },
    async ({ days }) => {
      const cutoff = new Date(Date.now() - (days ?? 7) * 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase.from('engagements').select('*').eq('section', 'prospects').eq('archived', false).lt('last_activity_at', cutoff).order('last_activity_at')
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify((data ?? []).map(engSummary), null, 2) }] }
    }
  )

  server.tool('get_needs_response',
    'Get all communications flagged as needing a response. Use for daily triage.',
    {},
    async () => {
      const { data, error } = await supabase.from('communications').select('*, engagements(organization, section)').eq('needs_response', true).order('date', { ascending: false })
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(data ?? [], null, 2) }] }
    }
  )

  server.tool('get_unpaid_invoices',
    'Get wrap-up engagements where an invoice has been sent but payment not received.',
    {},
    async () => {
      const { data, error } = await supabase.from('engagements').select('id,organization,event_name,event_date,fee,invoice_sent_at').eq('section', 'wrap-up').not('invoice_sent_at', 'is', null).is('payment_received_at', null).eq('archived', false)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(data ?? [], null, 2) }] }
    }
  )

  server.tool('get_outstanding_wrapup',
    'Get completed engagements with unfinished post-event tasks.',
    {},
    async () => {
      const { data, error } = await supabase.from('engagements').select('id,organization,event_name,event_date,invoice_sent_at,payment_received_at,thank_you_sent,media_processed').eq('section', 'wrap-up').eq('archived', false)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      const outstanding = (data ?? []).filter((e: Record<string, unknown>) => !e.invoice_sent_at || !e.thank_you_sent || !e.media_processed)
      return { content: [{ type: 'text' as const, text: JSON.stringify(outstanding, null, 2) }] }
    }
  )

  server.tool('update_prospect_stage',
    'Move a prospect to a different pipeline stage: inquiry, outreach, in_contact, call_scheduled, declined, canceled.',
    {
      engagement_id: z.string(),
      stage: z.enum(['inquiry', 'outreach', 'in_contact', 'call_scheduled', 'declined', 'canceled']),
      reason: z.string().optional(),
    },
    async ({ engagement_id, stage, reason }) => {
      const patch: Record<string, unknown> = { prospect_step: stage, updated_at: new Date().toISOString() }
      if (reason) patch.cancellation_reason = reason
      const { error } = await supabase.from('engagements').update(patch).eq('id', engagement_id)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: `Stage updated to "${stage}".` }] }
    }
  )

  server.tool('move_to_confirmed',
    'Graduate a prospect to a confirmed engagement when they have been booked.',
    { engagement_id: z.string() },
    async ({ engagement_id }) => {
      const { error } = await supabase.from('engagements').update({ section: 'engagements', prospect_step: null, updated_at: new Date().toISOString() }).eq('id', engagement_id)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: `Moved to confirmed engagements.` }] }
    }
  )

  server.tool('move_to_wrapup',
    'Move a confirmed engagement to wrap-up after the event has occurred.',
    { engagement_id: z.string() },
    async ({ engagement_id }) => {
      const { error } = await supabase.from('engagements').update({ section: 'wrap-up', updated_at: new Date().toISOString() }).eq('id', engagement_id)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: `Moved to wrap-up.` }] }
    }
  )

  server.tool('update_engagement_field',
    'Update a specific field on an engagement. Allowed: organization, event_name, event_date, event_time, event_city, event_location, event_format, topic, fee, session_length, audience_size, travel_covered, travel_destination, hotel_covered, av_needs, source, booker_name, notes, outstanding_items, follow_up_details.',
    {
      engagement_id: z.string(),
      field: z.enum(['organization','event_name','event_date','event_time','event_city','event_location','event_format','topic','fee','session_length','audience_size','travel_covered','travel_destination','hotel_covered','av_needs','source','booker_name','notes','outstanding_items','follow_up_details']),
      value: z.union([z.string(), z.number(), z.boolean()]),
    },
    async ({ engagement_id, field, value }) => {
      const { error } = await supabase.from('engagements').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', engagement_id)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: `Updated ${field}.` }] }
    }
  )

  server.tool('set_engagement_flag',
    'Mark a workflow flag on a confirmed engagement: contract_sent, contract_signed, materials_sent, briefing_complete, materials_requested.',
    {
      engagement_id: z.string(),
      flag: z.enum(['contract_sent','contract_signed','materials_sent','briefing_complete','materials_requested']),
      value: z.boolean().default(true),
    },
    async ({ engagement_id, flag, value }) => {
      const now = new Date().toISOString()
      const colMap: Record<string, Record<string, unknown>> = {
        contract_sent:      { contract_sent_at: value ? now : null },
        contract_signed:    { contract_signed_at: value ? now : null },
        materials_sent:     { client_deliverables_sent: value },
        briefing_complete:  { briefing_complete: value, briefing_complete_at: value ? now : null },
        materials_requested:{ materials_requested: value },
      }
      const { error } = await supabase.from('engagements').update({ ...colMap[flag], updated_at: now }).eq('id', engagement_id)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: `Flag "${flag}" set to ${value}.` }] }
    }
  )

  server.tool('set_post_event_flag',
    'Mark a post-event flag on a wrap-up engagement: invoice_sent, payment_received, thank_you_sent, testimonial_requested, media_received, media_uploaded, media_processed, social_media_complete.',
    {
      engagement_id: z.string(),
      flag: z.enum(['invoice_sent','payment_received','thank_you_sent','testimonial_requested','media_received','media_uploaded','media_processed','social_media_complete']),
      value: z.boolean().default(true),
    },
    async ({ engagement_id, flag, value }) => {
      const now = new Date().toISOString()
      const colMap: Record<string, Record<string, unknown>> = {
        invoice_sent:          { invoice_sent_at: value ? now : null },
        payment_received:      { payment_received_at: value ? now : null },
        thank_you_sent:        { thank_you_sent: value },
        testimonial_requested: { testimonial_requested: value },
        media_received:        { media_received: value },
        media_uploaded:        { media_uploaded: value },
        media_processed:       { media_processed: value },
        social_media_complete: { social_media_complete: value },
      }
      const { error } = await supabase.from('engagements').update({ ...colMap[flag], updated_at: now }).eq('id', engagement_id)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: `Post-event flag "${flag}" set to ${value}.` }] }
    }
  )

  server.tool('add_communication',
    'Log a communication against an engagement — email, call, or note.',
    {
      engagement_id: z.string(),
      type: z.enum(['email_inbound','email_outbound','call','note','stage_change']),
      body: z.string(),
      subject: z.string().optional(),
      from_name: z.string().optional(),
      to_name: z.string().optional(),
      staff_name: z.string().optional(),
      needs_response: z.boolean().optional().default(false),
    },
    async ({ engagement_id, type, body, subject, from_name, to_name, staff_name, needs_response }) => {
      const now = new Date().toISOString()
      const { error } = await supabase.from('communications').insert({ engagement_id, type, body, subject, from_name, to_name, staff_name, needs_response: needs_response ?? false, date: now, channel: type === 'call' ? 'phone' : 'email' })
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      await supabase.from('engagements').update({ last_activity_at: now, updated_at: now }).eq('id', engagement_id)
      return { content: [{ type: 'text' as const, text: `Communication logged.` }] }
    }
  )

  server.tool('get_communications',
    'Get the communication history for a specific engagement, most recent first.',
    { engagement_id: z.string(), limit: z.number().optional().default(20) },
    async ({ engagement_id, limit }) => {
      const { data, error } = await supabase.from('communications').select('*').eq('engagement_id', engagement_id).order('date', { ascending: false }).limit(limit ?? 20)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(data ?? [], null, 2) }] }
    }
  )

  server.tool('get_contacts',
    'Get contacts for an engagement, or find a contact by email across all engagements.',
    { engagement_id: z.string().optional(), email: z.string().optional() },
    async ({ engagement_id, email }) => {
      let q = supabase.from('contacts').select('*, engagements(organization, section)')
      if (engagement_id) q = q.eq('engagement_id', engagement_id)
      if (email) q = q.ilike('email', `%${email}%`)
      const { data, error } = await q
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(data ?? [], null, 2) }] }
    }
  )

  server.tool('update_contact',
    'Update a contact\'s information.',
    {
      contact_id: z.string(),
      first_name: z.string().optional(), last_name: z.string().optional(),
      email: z.string().optional(), phone: z.string().optional(),
      title: z.string().optional(), role: z.string().optional(),
      notes: z.string().optional(), watching: z.boolean().optional(),
    },
    async ({ contact_id, ...patch }) => {
      const filtered = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
      const { error } = await supabase.from('contacts').update(filtered).eq('id', contact_id)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: `Contact updated.` }] }
    }
  )

  server.tool('get_contact_history',
    'Get all engagements and communications for a person by email. Use to understand the full relationship history.',
    { email: z.string() },
    async ({ email }) => {
      const { data: contacts } = await supabase.from('contacts').select('engagement_id, first_name, last_name, title').ilike('email', `%${email}%`)
      const ids = (contacts ?? []).map((c: Record<string, unknown>) => c.engagement_id as string)
      if (!ids.length) return { content: [{ type: 'text' as const, text: 'No contact found.' }] }
      const [{ data: engs }, { data: comms }] = await Promise.all([
        supabase.from('engagements').select('id,organization,event_name,event_date,section,prospect_step').in('id', ids),
        supabase.from('communications').select('*').in('engagement_id', ids).order('date', { ascending: false }).limit(20),
      ])
      return { content: [{ type: 'text' as const, text: JSON.stringify({ contact: contacts?.[0], engagements: engs, recent_communications: comms }, null, 2) }] }
    }
  )

  server.tool('get_organization_history',
    'Get all engagements and activity history for an organization.',
    { organization: z.string() },
    async ({ organization }) => {
      const { data: engs } = await supabase.from('engagements').select('*').ilike('organization', `%${organization}%`).eq('archived', false).order('created_at', { ascending: false })
      if (!engs?.length) return { content: [{ type: 'text' as const, text: `No engagements found for "${organization}".` }] }
      const ids = engs.map(e => e.id)
      const [{ data: contacts }, { data: comms }] = await Promise.all([
        supabase.from('contacts').select('*').in('engagement_id', ids),
        supabase.from('communications').select('*').in('engagement_id', ids).order('date', { ascending: false }).limit(30),
      ])
      return { content: [{ type: 'text' as const, text: JSON.stringify({ engagements: engs, contacts, recent_communications: comms }, null, 2) }] }
    }
  )

  server.tool('add_briefing_note',
    'Add a timestamped note to an engagement\'s briefing log.',
    { engagement_id: z.string(), body: z.string() },
    async ({ engagement_id, body }) => {
      const { error } = await supabase.from('briefing_notes').insert({ engagement_id, body, resolved: false })
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: `Briefing note added.` }] }
    }
  )

  server.tool('resolve_briefing_note',
    'Mark a briefing note as resolved.',
    { note_id: z.string() },
    async ({ note_id }) => {
      const { error } = await supabase.from('briefing_notes').update({ resolved: true }).eq('id', note_id)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: `Briefing note resolved.` }] }
    }
  )

  server.tool('list_calls',
    'List calls across engagements, optionally filtered by status (requested, scheduled, completed).',
    { status: z.enum(['requested','scheduled','completed']).optional(), engagement_id: z.string().optional() },
    async ({ status, engagement_id }) => {
      let q = supabase.from('calls').select('*, engagements(organization)').order('scheduled_at', { ascending: true })
      if (status) q = q.eq('status', status)
      if (engagement_id) q = q.eq('engagement_id', engagement_id)
      const { data, error } = await q
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(data ?? [], null, 2) }] }
    }
  )

  server.tool('add_call',
    'Schedule or log a call for an engagement. Type: discovery = team call, mori = Mori is on the call.',
    {
      engagement_id: z.string(),
      type: z.enum(['discovery','mori']),
      status: z.enum(['requested','scheduled','completed']),
      scheduled_at: z.string().optional(),
      notes: z.string().optional(),
    },
    async ({ engagement_id, type, status, scheduled_at, notes }) => {
      const { error } = await supabase.from('calls').insert({ engagement_id, type, status, scheduled_at, notes, added_by: 'ai', requested_at: new Date().toISOString() })
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: `Call added.` }] }
    }
  )

  server.tool('update_call',
    'Update the status or details of an existing call.',
    {
      call_id: z.string(),
      status: z.enum(['requested','scheduled','completed']).optional(),
      scheduled_at: z.string().optional(),
      completed_at: z.string().optional(),
      notes: z.string().optional(),
    },
    async ({ call_id, ...patch }) => {
      const filtered = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
      const { error } = await supabase.from('calls').update(filtered).eq('id', call_id)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: `Call updated.` }] }
    }
  )

  server.tool('list_materials',
    'List all materials (outgoing and incoming) for an engagement.',
    { engagement_id: z.string() },
    async ({ engagement_id }) => {
      const { data, error } = await supabase.from('materials').select('*').eq('engagement_id', engagement_id)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(data ?? [], null, 2) }] }
    }
  )

  server.tool('add_material',
    'Add a material item to an engagement. outgoing = sent to client (bio, headshot etc), incoming = received from client (agenda, attendee list etc).',
    {
      engagement_id: z.string(),
      direction: z.enum(['outgoing','incoming']),
      label: z.string(),
      url: z.string().optional(),
      notes: z.string().optional(),
    },
    async ({ engagement_id, direction, label, url, notes }) => {
      const { error } = await supabase.from('materials').insert({ engagement_id, direction, label, url, note: notes, done: false, received: false, added_at: new Date().toISOString() })
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: `Material "${label}" added.` }] }
    }
  )

  server.tool('mark_material_done',
    'Mark an outgoing material as sent, or an incoming material as received.',
    {
      material_id: z.string(),
      direction: z.enum(['outgoing','incoming']),
      url: z.string().optional(),
      note: z.string().optional(),
    },
    async ({ material_id, direction, url, note }) => {
      const now = new Date().toISOString()
      const patch = direction === 'outgoing' ? { done: true, sent_at: now } : { received: true, received_at: now, url, note }
      const { error } = await supabase.from('materials').update(patch).eq('id', material_id)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: `Material marked as ${direction === 'outgoing' ? 'sent' : 'received'}.` }] }
    }
  )

  server.tool('archive_engagement',
    'Archive an engagement so it no longer appears in the active pipeline. Use for declined, canceled, or fully completed engagements. Cannot be undone from Claude.',
    { engagement_id: z.string(), reason: z.string().optional() },
    async ({ engagement_id, reason }) => {
      const now = new Date().toISOString()
      const patch: Record<string, unknown> = { archived: true, archived_at: now, updated_at: now }
      if (reason) patch.cancellation_reason = reason
      const { error } = await supabase.from('engagements').update(patch).eq('id', engagement_id)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: `Engagement archived.` }] }
    }
  )

  return server
}

// ─── Request handler ──────────────────────────────────────────────────────────
async function handle(req: NextRequest): Promise<Response> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const server = createMcpServer()
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless mode
    })
    await server.connect(transport)
    const response = await transport.handleRequest(req)
    return response
  } catch (err) {
    console.error('MCP error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const POST = handle
export const GET = handle
export const DELETE = handle