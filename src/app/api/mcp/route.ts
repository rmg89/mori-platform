import { NextRequest, NextResponse } from 'next/server'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// ─── Supabase client (service role for MCP — bypasses RLS safely server-side) ─
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Auth check ───────────────────────────────────────────────────────────────
function isAuthorized(req: NextRequest): boolean {
  if (process.env.MCP_READ_ONLY === 'true') return true
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.replace('Bearer ', '').trim()
  return token === process.env.MCP_SECRET_TOKEN
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function engagementSummary(e: Record<string, unknown>) {
  return {
    id: e.id,
    organization: e.organization,
    event_name: e.event_name,
    event_type: e.event_type,
    section: e.section,
    prospect_step: e.prospect_step,
    event_date: e.event_date,
    event_city: e.event_city,
    event_format: e.event_format,
    fee: e.fee,
    last_activity_at: e.last_activity_at,
    notes: e.notes,
  }
}

// ─── Build MCP server ─────────────────────────────────────────────────────────
function buildServer() {
  const server = new McpServer({
    name: 'mori-platform',
    version: '1.0.0',
  })

  // ── LIST ENGAGEMENTS ────────────────────────────────────────────────────────
  server.tool(
    'list_engagements',
    'List engagements from the pipeline. Filter by section (prospects, engagements, wrap-up), prospect stage, event type, or organization name. Returns a summary of each matching engagement.',
    {
      section: z.enum(['prospects', 'engagements', 'wrap-up']).optional().describe('Which section of the pipeline to list'),
      prospect_step: z.string().optional().describe('Filter by prospect stage: inquiry, outreach, in_contact, declined, canceled'),
      event_type: z.string().optional().describe('Filter by event type: speaking, podcast, panel, interview, livestream, coaching, general_inquiry'),
      organization: z.string().optional().describe('Filter by organization name (partial match)'),
      limit: z.number().optional().default(20).describe('Max results to return'),
    },
    async ({ section, prospect_step, event_type, organization, limit }) => {
      let query = supabase.from('engagements').select('*').eq('archived', false).order('last_activity_at', { ascending: false }).limit(limit ?? 20)
      if (section) query = query.eq('section', section)
      if (prospect_step) query = query.eq('prospect_step', prospect_step)
      if (event_type) query = query.eq('event_type', event_type)
      if (organization) query = query.ilike('organization', `%${organization}%`)
      const { data, error } = await query
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: JSON.stringify((data ?? []).map(engagementSummary), null, 2) }] }
    }
  )

  // ── GET ENGAGEMENT ──────────────────────────────────────────────────────────
  server.tool(
    'get_engagement',
    'Get full details for a single engagement including all contacts, recent communications, calls, materials, and briefing notes. Use when you need complete information about a specific engagement.',
    {
      id: z.string().optional().describe('Engagement UUID'),
      organization: z.string().optional().describe('Organization name to look up (finds the most recent match)'),
    },
    async ({ id, organization }) => {
      let engRow
      if (id) {
        const { data } = await supabase.from('engagements').select('*').eq('id', id).single()
        engRow = data
      } else if (organization) {
        const { data } = await supabase.from('engagements').select('*').ilike('organization', `%${organization}%`).eq('archived', false).order('last_activity_at', { ascending: false }).limit(1).single()
        engRow = data
      }
      if (!engRow) return { content: [{ type: 'text', text: 'Engagement not found.' }] }

      const [{ data: contacts }, { data: comms }, { data: calls }, { data: materials }, { data: notes }] = await Promise.all([
        supabase.from('contacts').select('*').eq('engagement_id', engRow.id),
        supabase.from('communications').select('*').eq('engagement_id', engRow.id).order('date', { ascending: false }).limit(10),
        supabase.from('calls').select('*').eq('engagement_id', engRow.id),
        supabase.from('materials').select('*').eq('engagement_id', engRow.id),
        supabase.from('briefing_notes').select('*').eq('engagement_id', engRow.id).eq('resolved', false),
      ])

      const result = { ...engRow, contacts, recent_communications: comms, calls, materials, open_briefing_notes: notes }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    }
  )

  // ── SEARCH ENGAGEMENTS ──────────────────────────────────────────────────────
  server.tool(
    'search_engagements',
    'Search engagements by keyword across organization name, event name, contact names, notes, and topic. Use for broad queries like "find everything related to Goldman" or "search for podcast engagements".',
    {
      query: z.string().describe('Search keyword or phrase'),
    },
    async ({ query }) => {
      const [{ data: byOrg }, { data: byNotes }] = await Promise.all([
        supabase.from('engagements').select('*').eq('archived', false).ilike('organization', `%${query}%`).limit(10),
        supabase.from('engagements').select('*').eq('archived', false).ilike('notes', `%${query}%`).limit(10),
      ])
      const contactSearch = await supabase.from('contacts').select('engagement_id, first_name, last_name, email').or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
      const contactEngIds = (contactSearch.data ?? []).map((c: Record<string, unknown>) => c.engagement_id as string)
      const { data: byContact } = contactEngIds.length > 0
        ? await supabase.from('engagements').select('*').in('id', contactEngIds)
        : { data: [] }

      const all = [...(byOrg ?? []), ...(byNotes ?? []), ...(byContact ?? [])]
      const unique = Array.from(new Map(all.map(e => [e.id, e])).values())
      return { content: [{ type: 'text', text: JSON.stringify(unique.map(engagementSummary), null, 2) }] }
    }
  )

  // ── GET DASHBOARD SUMMARY ───────────────────────────────────────────────────
  server.tool(
    'get_dashboard_summary',
    'Get a high-level summary of the current state of the business: counts by section, upcoming events in the next 30 days, items needing response, unpaid invoices, and stale prospects. Use for "what do I need to focus on today" type questions.',
    {},
    async () => {
      const today = new Date().toISOString().split('T')[0]
      const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const staleDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const [
        { count: prospectCount },
        { count: engagementCount },
        { count: wrapupCount },
        { data: upcoming },
        { data: needsResponse },
        { data: staleProspects },
        { data: unpaidInvoices },
      ] = await Promise.all([
        supabase.from('engagements').select('*', { count: 'exact', head: true }).eq('section', 'prospects').eq('archived', false),
        supabase.from('engagements').select('*', { count: 'exact', head: true }).eq('section', 'engagements').eq('archived', false),
        supabase.from('engagements').select('*', { count: 'exact', head: true }).eq('section', 'wrap-up').eq('archived', false),
        supabase.from('engagements').select('id,organization,event_name,event_date,event_city,event_format').eq('section', 'engagements').gte('event_date', today).lte('event_date', in30).order('event_date'),
        supabase.from('communications').select('engagement_id, subject, from_name, date').eq('needs_response', true).order('date', { ascending: false }).limit(10),
        supabase.from('engagements').select('id,organization,prospect_step,last_activity_at').eq('section', 'prospects').eq('archived', false).lt('last_activity_at', staleDate).limit(10),
        supabase.from('engagements').select('id,organization,invoice_sent_at').eq('section', 'wrap-up').not('invoice_sent_at', 'is', null).is('payment_received_at', null).limit(10),
      ])

      const summary = {
        counts: { prospects: prospectCount, engagements: engagementCount, wrap_up: wrapupCount },
        upcoming_events: upcoming ?? [],
        needs_response: needsResponse ?? [],
        stale_prospects: staleProspects ?? [],
        unpaid_invoices: unpaidInvoices ?? [],
      }
      return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] }
    }
  )

  // ── GET UPCOMING EVENTS ─────────────────────────────────────────────────────
  server.tool(
    'get_upcoming_events',
    'Get confirmed engagements sorted by date. Use for "what do I have coming up" questions. Returns events in the specified number of days ahead.',
    {
      days_ahead: z.number().optional().default(60).describe('How many days ahead to look'),
    },
    async ({ days_ahead }) => {
      const today = new Date().toISOString().split('T')[0]
      const future = new Date(Date.now() + (days_ahead ?? 60) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const { data, error } = await supabase.from('engagements').select('*').eq('section', 'engagements').eq('archived', false).gte('event_date', today).lte('event_date', future).order('event_date')
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: JSON.stringify((data ?? []).map(engagementSummary), null, 2) }] }
    }
  )

  // ── GET STALE PROSPECTS ─────────────────────────────────────────────────────
  server.tool(
    'get_stale_prospects',
    'Get prospects that have not had any activity in the specified number of days. Use for follow-up reviews and pipeline hygiene questions.',
    {
      days: z.number().optional().default(7).describe('Number of days without activity to consider stale'),
    },
    async ({ days }) => {
      const cutoff = new Date(Date.now() - (days ?? 7) * 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase.from('engagements').select('*').eq('section', 'prospects').eq('archived', false).lt('last_activity_at', cutoff).order('last_activity_at')
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: JSON.stringify((data ?? []).map(engagementSummary), null, 2) }] }
    }
  )

  // ── GET NEEDS RESPONSE ──────────────────────────────────────────────────────
  server.tool(
    'get_needs_response',
    'Get all communications that are flagged as needing a response. Use for daily triage — "what emails need replies today".',
    {},
    async () => {
      const { data, error } = await supabase.from('communications').select('*, engagements(organization, section, prospect_step)').eq('needs_response', true).order('date', { ascending: false })
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: JSON.stringify(data ?? [], null, 2) }] }
    }
  )

  // ── GET UNPAID INVOICES ─────────────────────────────────────────────────────
  server.tool(
    'get_unpaid_invoices',
    'Get all wrap-up engagements where an invoice has been sent but payment has not been received.',
    {},
    async () => {
      const { data, error } = await supabase.from('engagements').select('id,organization,event_name,event_date,fee,invoice_sent_at').eq('section', 'wrap-up').not('invoice_sent_at', 'is', null).is('payment_received_at', null).eq('archived', false)
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: JSON.stringify(data ?? [], null, 2) }] }
    }
  )

  // ── GET OUTSTANDING WRAPUP ──────────────────────────────────────────────────
  server.tool(
    'get_outstanding_wrapup',
    'Get completed engagements that still have unfinished post-event tasks (invoice not sent, thank you not sent, media not processed, etc).',
    {},
    async () => {
      const { data, error } = await supabase.from('engagements').select('id,organization,event_name,event_date,invoice_sent_at,payment_received_at,thank_you_sent,testimonial_requested,media_received,media_processed,social_media_complete,follow_up_required').eq('section', 'wrap-up').eq('archived', false)
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      const outstanding = (data ?? []).filter((e: Record<string, unknown>) =>
        !e.invoice_sent_at || !e.thank_you_sent || !e.media_processed
      )
      return { content: [{ type: 'text', text: JSON.stringify(outstanding, null, 2) }] }
    }
  )

  // ── UPDATE PROSPECT STAGE ───────────────────────────────────────────────────
  server.tool(
    'update_prospect_stage',
    'Move a prospect to a different pipeline stage. Valid stages: inquiry, outreach, in_contact, call_scheduled, declined, canceled.',
    {
      engagement_id: z.string().describe('UUID of the engagement'),
      stage: z.enum(['inquiry', 'outreach', 'in_contact', 'call_scheduled', 'declined', 'canceled']).describe('New pipeline stage'),
      reason: z.string().optional().describe('Optional reason or note for the stage change'),
    },
    async ({ engagement_id, stage, reason }) => {
      const patch: Record<string, unknown> = { prospect_step: stage, updated_at: new Date().toISOString() }
      if (reason) patch.cancellation_reason = reason
      const { error } = await supabase.from('engagements').update(patch).eq('id', engagement_id)
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: `Stage updated to "${stage}" for engagement ${engagement_id}.` }] }
    }
  )

  // ── MOVE TO CONFIRMED ───────────────────────────────────────────────────────
  server.tool(
    'move_to_confirmed',
    'Graduate a prospect to a confirmed engagement. Call this when a prospect has been booked and confirmed.',
    {
      engagement_id: z.string().describe('UUID of the engagement to confirm'),
    },
    async ({ engagement_id }) => {
      const { error } = await supabase.from('engagements').update({ section: 'engagements', prospect_step: null, updated_at: new Date().toISOString() }).eq('id', engagement_id)
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: `Engagement ${engagement_id} moved to confirmed engagements.` }] }
    }
  )

  // ── MOVE TO WRAPUP ──────────────────────────────────────────────────────────
  server.tool(
    'move_to_wrapup',
    'Move a confirmed engagement to wrap-up after the event has occurred.',
    {
      engagement_id: z.string().describe('UUID of the engagement'),
    },
    async ({ engagement_id }) => {
      const { error } = await supabase.from('engagements').update({ section: 'wrap-up', updated_at: new Date().toISOString() }).eq('id', engagement_id)
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: `Engagement ${engagement_id} moved to wrap-up.` }] }
    }
  )

  // ── UPDATE ENGAGEMENT FIELD ─────────────────────────────────────────────────
  server.tool(
    'update_engagement_field',
    'Update a specific field on an engagement. Allowed fields: organization, event_name, event_date, event_time, event_city, event_location, event_format, topic, fee, session_length, audience_size, travel_covered, travel_destination, hotel_covered, av_needs, source, booker_name, notes, outstanding_items, follow_up_details.',
    {
      engagement_id: z.string().describe('UUID of the engagement'),
      field: z.enum([
        'organization', 'event_name', 'event_date', 'event_time', 'event_city',
        'event_location', 'event_format', 'topic', 'fee', 'session_length',
        'audience_size', 'travel_covered', 'travel_destination', 'hotel_covered',
        'av_needs', 'source', 'booker_name', 'notes', 'outstanding_items', 'follow_up_details',
      ]).describe('Field name to update'),
      value: z.union([z.string(), z.number(), z.boolean()]).describe('New value for the field'),
    },
    async ({ engagement_id, field, value }) => {
      const { error } = await supabase.from('engagements').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', engagement_id)
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: `Updated ${field} on engagement ${engagement_id}.` }] }
    }
  )

  // ── SET ENGAGEMENT FLAG ─────────────────────────────────────────────────────
  server.tool(
    'set_engagement_flag',
    'Mark a workflow flag on a confirmed engagement. Use for: contract_sent, contract_signed, materials_sent (client deliverables sent), briefing_complete, materials_requested.',
    {
      engagement_id: z.string().describe('UUID of the engagement'),
      flag: z.enum(['contract_sent', 'contract_signed', 'materials_sent', 'briefing_complete', 'materials_requested']).describe('Which flag to set'),
      value: z.boolean().default(true).describe('True to mark done, false to unmark'),
    },
    async ({ engagement_id, flag, value }) => {
      const now = new Date().toISOString()
      const colMap: Record<string, Record<string, unknown>> = {
        contract_sent:      { contract_sent_at: value ? now : null },
        contract_signed:    { contract_signed_at: value ? now : null },
        materials_sent:     { client_deliverables_sent: value },
        briefing_complete:  { briefing_complete: value, briefing_complete_at: value ? now : null },
        materials_requested: { materials_requested: value },
      }
      const { error } = await supabase.from('engagements').update({ ...colMap[flag], updated_at: now }).eq('id', engagement_id)
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: `Flag "${flag}" set to ${value} on engagement ${engagement_id}.` }] }
    }
  )

  // ── SET POST EVENT FLAG ─────────────────────────────────────────────────────
  server.tool(
    'set_post_event_flag',
    'Mark a post-event workflow flag on a wrap-up engagement. Use for: invoice_sent, payment_received, thank_you_sent, testimonial_requested, media_received, media_uploaded, media_processed, social_media_complete.',
    {
      engagement_id: z.string().describe('UUID of the engagement'),
      flag: z.enum(['invoice_sent', 'payment_received', 'thank_you_sent', 'testimonial_requested', 'media_received', 'media_uploaded', 'media_processed', 'social_media_complete']).describe('Which post-event flag to set'),
      value: z.boolean().default(true).describe('True to mark done, false to unmark'),
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
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: `Post-event flag "${flag}" set to ${value} on engagement ${engagement_id}.` }] }
    }
  )

  // ── ADD COMMUNICATION ───────────────────────────────────────────────────────
  server.tool(
    'add_communication',
    'Log a communication against an engagement — an email, call, note, or stage change. Use when the team has a conversation, sends a message, or makes a call that should be recorded.',
    {
      engagement_id: z.string().describe('UUID of the engagement'),
      type: z.enum(['email_inbound', 'email_outbound', 'call', 'note', 'stage_change']).describe('Type of communication'),
      body: z.string().describe('Content or summary of the communication'),
      subject: z.string().optional().describe('Subject line for emails'),
      from_name: z.string().optional().describe('Who sent it'),
      to_name: z.string().optional().describe('Who received it'),
      staff_name: z.string().optional().describe('Team member who handled it'),
      needs_response: z.boolean().optional().default(false).describe('Whether this requires a response'),
    },
    async ({ engagement_id, type, body, subject, from_name, to_name, staff_name, needs_response }) => {
      const now = new Date().toISOString()
      const { error: commError } = await supabase.from('communications').insert({
        engagement_id, type, body, subject, from_name, to_name, staff_name,
        needs_response: needs_response ?? false,
        date: now,
        channel: type === 'call' ? 'phone' : 'email',
      })
      if (commError) return { content: [{ type: 'text', text: `Error: ${commError.message}` }] }
      await supabase.from('engagements').update({ last_activity_at: now, updated_at: now }).eq('id', engagement_id)
      return { content: [{ type: 'text', text: `Communication logged for engagement ${engagement_id}.` }] }
    }
  )

  // ── GET COMMUNICATIONS ──────────────────────────────────────────────────────
  server.tool(
    'get_communications',
    'Get the communication history for a specific engagement, ordered most recent first.',
    {
      engagement_id: z.string().describe('UUID of the engagement'),
      limit: z.number().optional().default(20).describe('Max number of communications to return'),
    },
    async ({ engagement_id, limit }) => {
      const { data, error } = await supabase.from('communications').select('*').eq('engagement_id', engagement_id).order('date', { ascending: false }).limit(limit ?? 20)
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: JSON.stringify(data ?? [], null, 2) }] }
    }
  )

  // ── GET CONTACTS ────────────────────────────────────────────────────────────
  server.tool(
    'get_contacts',
    'Get all contacts for a specific engagement, or find a contact by email across all engagements.',
    {
      engagement_id: z.string().optional().describe('UUID of the engagement'),
      email: z.string().optional().describe('Email address to look up across all engagements'),
    },
    async ({ engagement_id, email }) => {
      let query = supabase.from('contacts').select('*, engagements(organization, section)')
      if (engagement_id) query = query.eq('engagement_id', engagement_id)
      if (email) query = query.ilike('email', `%${email}%`)
      const { data, error } = await query
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: JSON.stringify(data ?? [], null, 2) }] }
    }
  )

  // ── UPDATE CONTACT ──────────────────────────────────────────────────────────
  server.tool(
    'update_contact',
    'Update a contact\'s information on a specific engagement.',
    {
      contact_id: z.string().describe('UUID of the contact'),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      title: z.string().optional(),
      role: z.string().optional().describe('primary, bureau, assistant, av, legal'),
      notes: z.string().optional(),
      watching: z.boolean().optional(),
    },
    async ({ contact_id, ...patch }) => {
      const filtered = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
      const { error } = await supabase.from('contacts').update(filtered).eq('id', contact_id)
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: `Contact ${contact_id} updated.` }] }
    }
  )

  // ── GET CONTACT HISTORY ─────────────────────────────────────────────────────
  server.tool(
    'get_contact_history',
    'Get all engagements and communications associated with a specific person, identified by email. Use to understand the full relationship history with someone.',
    {
      email: z.string().describe('Email address of the person'),
    },
    async ({ email }) => {
      const { data: contacts } = await supabase.from('contacts').select('engagement_id, first_name, last_name, title, role').ilike('email', `%${email}%`)
      const engIds = (contacts ?? []).map((c: Record<string, unknown>) => c.engagement_id as string)
      if (engIds.length === 0) return { content: [{ type: 'text', text: 'No contact found with that email.' }] }
      const [{ data: engs }, { data: comms }] = await Promise.all([
        supabase.from('engagements').select('id,organization,event_name,event_date,section,prospect_step').in('id', engIds),
        supabase.from('communications').select('*').in('engagement_id', engIds).order('date', { ascending: false }).limit(20),
      ])
      return { content: [{ type: 'text', text: JSON.stringify({ contact: contacts?.[0], engagements: engs, recent_communications: comms }, null, 2) }] }
    }
  )

  // ── GET ORGANIZATION HISTORY ────────────────────────────────────────────────
  server.tool(
    'get_organization_history',
    'Get all engagements and activity history for a specific organization. Use to understand the full relationship with a company.',
    {
      organization: z.string().describe('Organization name'),
    },
    async ({ organization }) => {
      const { data: engs } = await supabase.from('engagements').select('*').ilike('organization', `%${organization}%`).eq('archived', false).order('created_at', { ascending: false })
      if (!engs?.length) return { content: [{ type: 'text', text: `No engagements found for "${organization}".` }] }
      const engIds = engs.map(e => e.id)
      const [{ data: contacts }, { data: comms }] = await Promise.all([
        supabase.from('contacts').select('*').in('engagement_id', engIds),
        supabase.from('communications').select('*').in('engagement_id', engIds).order('date', { ascending: false }).limit(30),
      ])
      return { content: [{ type: 'text', text: JSON.stringify({ engagements: engs, contacts, recent_communications: comms }, null, 2) }] }
    }
  )

  // ── ADD BRIEFING NOTE ───────────────────────────────────────────────────────
  server.tool(
    'add_briefing_note',
    'Add a timestamped note to an engagement\'s briefing log. Use for capturing important details, updates, or things to remember about an engagement.',
    {
      engagement_id: z.string().describe('UUID of the engagement'),
      body: z.string().describe('The note content'),
    },
    async ({ engagement_id, body }) => {
      const { error } = await supabase.from('briefing_notes').insert({ engagement_id, body, resolved: false })
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: `Briefing note added to engagement ${engagement_id}.` }] }
    }
  )

  // ── RESOLVE BRIEFING NOTE ───────────────────────────────────────────────────
  server.tool(
    'resolve_briefing_note',
    'Mark a briefing note as resolved.',
    {
      note_id: z.string().describe('UUID of the briefing note'),
    },
    async ({ note_id }) => {
      const { error } = await supabase.from('briefing_notes').update({ resolved: true }).eq('id', note_id)
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: `Briefing note ${note_id} marked as resolved.` }] }
    }
  )

  // ── LIST CALLS ──────────────────────────────────────────────────────────────
  server.tool(
    'list_calls',
    'List calls across all engagements, optionally filtered by status. Use to see all scheduled or requested calls.',
    {
      status: z.enum(['requested', 'scheduled', 'completed']).optional().describe('Filter by call status'),
      engagement_id: z.string().optional().describe('Filter to a specific engagement'),
    },
    async ({ status, engagement_id }) => {
      let query = supabase.from('calls').select('*, engagements(organization, section, prospect_step)').order('scheduled_at', { ascending: true })
      if (status) query = query.eq('status', status)
      if (engagement_id) query = query.eq('engagement_id', engagement_id)
      const { data, error } = await query
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: JSON.stringify(data ?? [], null, 2) }] }
    }
  )

  // ── ADD CALL ────────────────────────────────────────────────────────────────
  server.tool(
    'add_call',
    'Schedule or log a call for an engagement.',
    {
      engagement_id: z.string().describe('UUID of the engagement'),
      type: z.enum(['discovery', 'mori']).describe('discovery = team call, mori = Mori is on the call'),
      status: z.enum(['requested', 'scheduled', 'completed']).describe('Current status of the call'),
      scheduled_at: z.string().optional().describe('ISO datetime when the call is scheduled'),
      notes: z.string().optional().describe('Notes about the call'),
      added_by: z.enum(['manual', 'ai']).optional().default('ai'),
    },
    async ({ engagement_id, type, status, scheduled_at, notes, added_by }) => {
      const { error } = await supabase.from('calls').insert({
        engagement_id, type, status, scheduled_at, notes,
        added_by: added_by ?? 'ai',
        requested_at: new Date().toISOString(),
      })
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: `Call added for engagement ${engagement_id}.` }] }
    }
  )

  // ── UPDATE CALL ─────────────────────────────────────────────────────────────
  server.tool(
    'update_call',
    'Update the status or details of an existing call.',
    {
      call_id: z.string().describe('UUID of the call'),
      status: z.enum(['requested', 'scheduled', 'completed']).optional(),
      scheduled_at: z.string().optional().describe('ISO datetime'),
      completed_at: z.string().optional().describe('ISO datetime when completed'),
      notes: z.string().optional(),
    },
    async ({ call_id, ...patch }) => {
      const filtered = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
      const { error } = await supabase.from('calls').update(filtered).eq('id', call_id)
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: `Call ${call_id} updated.` }] }
    }
  )

  // ── LIST MATERIALS ──────────────────────────────────────────────────────────
  server.tool(
    'list_materials',
    'List all materials (outgoing and incoming) for an engagement.',
    {
      engagement_id: z.string().describe('UUID of the engagement'),
    },
    async ({ engagement_id }) => {
      const { data, error } = await supabase.from('materials').select('*').eq('engagement_id', engagement_id)
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: JSON.stringify(data ?? [], null, 2) }] }
    }
  )

  // ── ADD MATERIAL ────────────────────────────────────────────────────────────
  server.tool(
    'add_material',
    'Add a material item to an engagement. Direction: outgoing = Mori\'s team sending to client (bio, headshot, etc), incoming = client sending to Mori\'s team (agenda, attendee list, etc).',
    {
      engagement_id: z.string().describe('UUID of the engagement'),
      direction: z.enum(['outgoing', 'incoming']).describe('outgoing = sent to client, incoming = received from client'),
      label: z.string().describe('Name of the material, e.g. "Bio", "Run of Show", "Headshot"'),
      url: z.string().optional().describe('URL if the material is a link or file'),
      notes: z.string().optional(),
    },
    async ({ engagement_id, direction, label, url, notes }) => {
      const { error } = await supabase.from('materials').insert({
        engagement_id, direction, label, url, note: notes,
        done: false, received: false,
        added_at: new Date().toISOString(),
      })
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: `Material "${label}" added to engagement ${engagement_id}.` }] }
    }
  )

  // ── MARK MATERIAL DONE ──────────────────────────────────────────────────────
  server.tool(
    'mark_material_done',
    'Mark an outgoing material as sent, or an incoming material as received.',
    {
      material_id: z.string().describe('UUID of the material'),
      direction: z.enum(['outgoing', 'incoming']).describe('Whether this is outgoing (sent) or incoming (received)'),
      url: z.string().optional().describe('URL or link for incoming materials'),
      note: z.string().optional().describe('Note about the received material'),
    },
    async ({ material_id, direction, url, note }) => {
      const now = new Date().toISOString()
      const patch = direction === 'outgoing'
        ? { done: true, sent_at: now }
        : { received: true, received_at: now, url, note }
      const { error } = await supabase.from('materials').update(patch).eq('id', material_id)
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: `Material ${material_id} marked as ${direction === 'outgoing' ? 'sent' : 'received'}.` }] }
    }
  )

  // ── ARCHIVE ENGAGEMENT ──────────────────────────────────────────────────────
  server.tool(
    'archive_engagement',
    'Archive an engagement so it no longer appears in the active pipeline. Use for declined prospects, canceled engagements, or fully completed wrap-ups. This cannot be undone from Claude — only from the platform directly.',
    {
      engagement_id: z.string().describe('UUID of the engagement to archive'),
      reason: z.string().optional().describe('Reason for archiving'),
    },
    async ({ engagement_id, reason }) => {
      const now = new Date().toISOString()
      const patch: Record<string, unknown> = { archived: true, archived_at: now, updated_at: now }
      if (reason) patch.cancellation_reason = reason
      const { error } = await supabase.from('engagements').update(patch).eq('id', engagement_id)
      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text', text: `Engagement ${engagement_id} archived.` }] }
    }
  )

  return server
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const server = buildServer()
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    await server.connect(transport)
    return await transport.handleRequest(req)
  } catch (err) {
    console.error('MCP error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const server = buildServer()
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    await server.connect(transport)
    return await transport.handleRequest(req)
  } catch (err) {
    console.error('MCP error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const server = buildServer()
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    await server.connect(transport)
    return await transport.handleRequest(req)
  } catch (err) {
    console.error('MCP error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}