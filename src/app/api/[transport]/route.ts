import { createMcpHandler } from 'mcp-handler'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function engSummary(e: Record<string, unknown>) {
  return {
    id: e.id, organization: e.organization, event_name: e.event_name,
    event_type: e.event_type, section: e.section, prospect_step: e.prospect_step,
    event_date: e.event_date, event_city: e.event_city, event_format: e.event_format,
    fee: e.fee, last_activity_at: e.last_activity_at, notes: e.notes,
  }
}

const handler = createMcpHandler(
  (server) => {

    server.registerTool('debug_connection', {
      title: 'Debug Connection',
      description: 'Test the Supabase connection and env vars. Use this if other tools are failing.',
      inputSchema: {},
    }, async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY
      const { data, error } = await supabase.from('engagements').select('id').limit(1)
      return { content: [{ type: 'text' as const, text: JSON.stringify({
        url_set: !!url,
        key_set: !!key,
        key_prefix: key?.substring(0, 20),
        query_success: !error,
        query_error: error?.message ?? null,
        row_count: data?.length ?? 0,
      }, null, 2) }] }
    })

    server.registerTool('list_engagements', {
      title: 'List Engagements',
      description: 'List engagements from the pipeline. Filter by section (prospects, engagements, wrap-up), prospect stage, event type, or organization name.',
      inputSchema: {
        section: z.enum(['prospects', 'engagements', 'wrap-up']).optional(),
        prospect_step: z.string().optional(),
        event_type: z.string().optional(),
        organization: z.string().optional(),
        limit: z.number().optional(),
      },
    }, async ({ section, prospect_step, event_type, organization, limit }) => {
      let q = supabase.from('engagements').select('*').eq('archived', false).order('last_activity_at', { ascending: false }).limit(limit ?? 20)
      if (section) q = q.eq('section', section)
      if (prospect_step) q = q.eq('prospect_step', prospect_step)
      if (event_type) q = q.eq('event_type', event_type)
      if (organization) q = q.ilike('organization', `%${organization}%`)
      const { data, error } = await q
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify((data ?? []).map(engSummary), null, 2) }] }
    })

    server.registerTool('get_engagement', {
      title: 'Get Engagement',
      description: 'Get full details for a single engagement including contacts, recent communications, calls, materials, and briefing notes.',
      inputSchema: {
        id: z.string().optional(),
        organization: z.string().optional(),
      },
    }, async ({ id, organization }) => {
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
    })

    server.registerTool('search_engagements', {
      title: 'Search Engagements',
      description: 'Search engagements by keyword across organization, event name, contact names, and notes.',
      inputSchema: { query: z.string() },
    }, async ({ query }) => {
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
    })

    server.registerTool('get_dashboard_summary', {
      title: 'Get Dashboard Summary',
      description: 'Get a high-level summary: counts by section, upcoming events, items needing response, unpaid invoices, stale prospects. Use for "what do I need to focus on today".',
      inputSchema: {},
    }, async () => {
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
    })

    server.registerTool('get_upcoming_events', {
      title: 'Get Upcoming Events',
      description: 'Get confirmed engagements sorted by date. Use for "what do I have coming up" questions.',
      inputSchema: { days_ahead: z.number().optional() },
    }, async ({ days_ahead }) => {
      const today = new Date().toISOString().split('T')[0]
      const future = new Date(Date.now() + (days_ahead ?? 60) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const { data, error } = await supabase.from('engagements').select('*').eq('section', 'engagements').eq('archived', false).gte('event_date', today).lte('event_date', future).order('event_date')
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify((data ?? []).map(engSummary), null, 2) }] }
    })

    server.registerTool('get_stale_prospects', {
      title: 'Get Stale Prospects',
      description: 'Get prospects with no activity in the last N days. Use for follow-up reviews.',
      inputSchema: { days: z.number().optional() },
    }, async ({ days }) => {
      const cutoff = new Date(Date.now() - (days ?? 7) * 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase.from('engagements').select('*').eq('section', 'prospects').eq('archived', false).lt('last_activity_at', cutoff).order('last_activity_at')
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify((data ?? []).map(engSummary), null, 2) }] }
    })

    server.registerTool('get_needs_response', {
      title: 'Get Needs Response',
      description: 'Get all communications flagged as needing a response. Use for daily triage.',
      inputSchema: {},
    }, async () => {
      const { data, error } = await supabase.from('communications').select('*, engagements(organization, section)').eq('needs_response', true).order('date', { ascending: false })
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(data ?? [], null, 2) }] }
    })

    server.registerTool('get_unpaid_invoices', {
      title: 'Get Unpaid Invoices',
      description: 'Get wrap-up engagements where an invoice has been sent but payment not received.',
      inputSchema: {},
    }, async () => {
      const { data, error } = await supabase.from('engagements').select('id,organization,event_name,event_date,fee,invoice_sent_at').eq('section', 'wrap-up').not('invoice_sent_at', 'is', null).is('payment_received_at', null).eq('archived', false)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(data ?? [], null, 2) }] }
    })

    server.registerTool('update_prospect_stage', {
      title: 'Update Prospect Stage',
      description: 'Move a prospect to a different pipeline stage: inquiry, outreach, in_contact, call_scheduled, declined, canceled.',
      inputSchema: {
        engagement_id: z.string(),
        stage: z.enum(['inquiry', 'outreach', 'in_contact', 'call_scheduled', 'declined', 'canceled']),
        reason: z.string().optional(),
      },
    }, async ({ engagement_id, stage, reason }) => {
      const patch: Record<string, unknown> = { prospect_step: stage, updated_at: new Date().toISOString() }
      if (reason) patch.cancellation_reason = reason
      const { error } = await supabase.from('engagements').update(patch).eq('id', engagement_id)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: `Stage updated to "${stage}".` }] }
    })

    server.registerTool('move_to_confirmed', {
      title: 'Move to Confirmed',
      description: 'Graduate a prospect to a confirmed engagement when they have been booked.',
      inputSchema: { engagement_id: z.string() },
    }, async ({ engagement_id }) => {
      const { error } = await supabase.from('engagements').update({ section: 'engagements', prospect_step: null, updated_at: new Date().toISOString() }).eq('id', engagement_id)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: `Moved to confirmed engagements.` }] }
    })

    server.registerTool('move_to_wrapup', {
      title: 'Move to Wrap-Up',
      description: 'Move a confirmed engagement to wrap-up after the event has occurred.',
      inputSchema: { engagement_id: z.string() },
    }, async ({ engagement_id }) => {
      const { error } = await supabase.from('engagements').update({ section: 'wrap-up', updated_at: new Date().toISOString() }).eq('id', engagement_id)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: `Moved to wrap-up.` }] }
    })

    server.registerTool('update_engagement_field', {
      title: 'Update Engagement Field',
      description: 'Update a specific field on an engagement. Allowed: organization, event_name, event_date, event_time, event_city, event_location, event_format, topic, fee, deposit_amount, session_length, audience_size, travel_covered, travel_destination, hotel_covered, av_needs, source, booker_name, notes, outstanding_items, follow_up_details.',
      inputSchema: {
        engagement_id: z.string(),
        field: z.enum(['organization','event_name','event_date','event_time','event_city','event_location','event_format','topic','fee','deposit_amount','session_length','audience_size','travel_covered','travel_destination','hotel_covered','av_needs','source','booker_name','notes','outstanding_items','follow_up_details']),
        value: z.union([z.string(), z.number(), z.boolean()]),
      },
    }, async ({ engagement_id, field, value }) => {
      const { error } = await supabase.from('engagements').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', engagement_id)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: `Updated ${field}.` }] }
    })

    server.registerTool('set_engagement_flag', {
      title: 'Set Engagement Flag',
      description: 'Mark a workflow flag on a confirmed engagement: contract_sent, contract_signed, materials_sent, briefing_complete, materials_requested, deposit_invoice_sent, deposit_received.',
      inputSchema: {
        engagement_id: z.string(),
        flag: z.enum(['contract_sent','contract_signed','materials_sent','briefing_complete','materials_requested','deposit_invoice_sent','deposit_received']),
        value: z.boolean(),
      },
    }, async ({ engagement_id, flag, value }) => {
      const now = new Date().toISOString()
      const colMap: Record<string, Record<string, unknown>> = {
        contract_sent: { contract_sent_at: value ? now : null },
        contract_signed: { contract_signed_at: value ? now : null },
        materials_sent: { client_deliverables_sent: value },
        briefing_complete: { briefing_complete: value, briefing_complete_at: value ? now : null },
        materials_requested: { materials_requested: value },
        deposit_invoice_sent: { deposit_invoice_sent_at: value ? now : null },
        deposit_received: { deposit_received_at: value ? now : null },
      }
      const { error } = await supabase.from('engagements').update({ ...colMap[flag], updated_at: now }).eq('id', engagement_id)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: `Flag "${flag}" set to ${value}.` }] }
    })

    server.registerTool('set_post_event_flag', {
      title: 'Set Post-Event Flag',
      description: 'Mark a post-event flag: invoice_sent, payment_received, thank_you_sent, testimonial_requested, media_received, media_uploaded, media_processed, social_media_complete.',
      inputSchema: {
        engagement_id: z.string(),
        flag: z.enum(['invoice_sent','payment_received','thank_you_sent','testimonial_requested','media_received','media_uploaded','media_processed','social_media_complete']),
        value: z.boolean(),
      },
    }, async ({ engagement_id, flag, value }) => {
      const now = new Date().toISOString()
      const colMap: Record<string, Record<string, unknown>> = {
        invoice_sent: { invoice_sent_at: value ? now : null },
        payment_received: { payment_received_at: value ? now : null },
        thank_you_sent: { thank_you_sent: value },
        testimonial_requested: { testimonial_requested: value },
        media_received: { media_received: value },
        media_uploaded: { media_uploaded: value },
        media_processed: { media_processed: value },
        social_media_complete: { social_media_complete: value },
      }
      const { error } = await supabase.from('engagements').update({ ...colMap[flag], updated_at: now }).eq('id', engagement_id)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: `Post-event flag "${flag}" set to ${value}.` }] }
    })

    server.registerTool('add_communication', {
      title: 'Add Communication',
      description: 'Log a communication against an engagement — email, call, or note.',
      inputSchema: {
        engagement_id: z.string(),
        type: z.enum(['email_inbound','email_outbound','call','note','stage_change']),
        body: z.string(),
        subject: z.string().optional(),
        from_name: z.string().optional(),
        to_name: z.string().optional(),
        staff_name: z.string().optional(),
        needs_response: z.boolean().optional(),
      },
    }, async ({ engagement_id, type, body, subject, from_name, to_name, staff_name, needs_response }) => {
      const now = new Date().toISOString()
      const { error } = await supabase.from('communications').insert({ engagement_id, type, body, subject, from_name, to_name, staff_name, needs_response: needs_response ?? false, date: now, channel: type === 'call' ? 'phone' : 'email' })
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      await supabase.from('engagements').update({ last_activity_at: now, updated_at: now }).eq('id', engagement_id)
      return { content: [{ type: 'text' as const, text: `Communication logged.` }] }
    })

    server.registerTool('get_communications', {
      title: 'Get Communications',
      description: 'Get the communication history for a specific engagement, most recent first.',
      inputSchema: { engagement_id: z.string(), limit: z.number().optional() },
    }, async ({ engagement_id, limit }) => {
      const { data, error } = await supabase.from('communications').select('*').eq('engagement_id', engagement_id).order('date', { ascending: false }).limit(limit ?? 20)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(data ?? [], null, 2) }] }
    })

    server.registerTool('get_contacts', {
      title: 'Get Contacts',
      description: 'Get contacts for an engagement, or find a contact by email across all engagements.',
      inputSchema: { engagement_id: z.string().optional(), email: z.string().optional() },
    }, async ({ engagement_id, email }) => {
      let q = supabase.from('contacts').select('*, engagements(organization, section)')
      if (engagement_id) q = q.eq('engagement_id', engagement_id)
      if (email) q = q.ilike('email', `%${email}%`)
      const { data, error } = await q
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(data ?? [], null, 2) }] }
    })

    server.registerTool('get_contact_history', {
      title: 'Get Contact History',
      description: 'Get all engagements and communications for a person by email. Use to understand the full relationship history.',
      inputSchema: { email: z.string() },
    }, async ({ email }) => {
      const { data: contacts } = await supabase.from('contacts').select('engagement_id, first_name, last_name, title').ilike('email', `%${email}%`)
      const ids = (contacts ?? []).map((c: Record<string, unknown>) => c.engagement_id as string)
      if (!ids.length) return { content: [{ type: 'text' as const, text: 'No contact found.' }] }
      const [{ data: engs }, { data: comms }] = await Promise.all([
        supabase.from('engagements').select('id,organization,event_name,event_date,section,prospect_step').in('id', ids),
        supabase.from('communications').select('*').in('engagement_id', ids).order('date', { ascending: false }).limit(20),
      ])
      return { content: [{ type: 'text' as const, text: JSON.stringify({ contact: contacts?.[0], engagements: engs, recent_communications: comms }, null, 2) }] }
    })

    server.registerTool('get_organization_history', {
      title: 'Get Organization History',
      description: 'Get all engagements and activity history for an organization.',
      inputSchema: { organization: z.string() },
    }, async ({ organization }) => {
      const { data: engs } = await supabase.from('engagements').select('*').ilike('organization', `%${organization}%`).eq('archived', false).order('created_at', { ascending: false })
      if (!engs?.length) return { content: [{ type: 'text' as const, text: `No engagements found for "${organization}".` }] }
      const ids = engs.map(e => e.id)
      const [{ data: contacts }, { data: comms }] = await Promise.all([
        supabase.from('contacts').select('*').in('engagement_id', ids),
        supabase.from('communications').select('*').in('engagement_id', ids).order('date', { ascending: false }).limit(30),
      ])
      return { content: [{ type: 'text' as const, text: JSON.stringify({ engagements: engs, contacts, recent_communications: comms }, null, 2) }] }
    })

    server.registerTool('add_briefing_note', {
      title: 'Add Briefing Note',
      description: 'Add a timestamped note to an engagement\'s briefing log.',
      inputSchema: { engagement_id: z.string(), body: z.string() },
    }, async ({ engagement_id, body }) => {
      const { error } = await supabase.from('briefing_notes').insert({ engagement_id, body, resolved: false })
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: `Briefing note added.` }] }
    })

    server.registerTool('resolve_briefing_note', {
      title: 'Resolve Briefing Note',
      description: 'Mark a briefing note as resolved.',
      inputSchema: { note_id: z.string() },
    }, async ({ note_id }) => {
      const { error } = await supabase.from('briefing_notes').update({ resolved: true }).eq('id', note_id)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: `Briefing note resolved.` }] }
    })

    server.registerTool('list_calls', {
      title: 'List Calls',
      description: 'List calls across engagements, optionally filtered by status (requested, scheduled, completed).',
      inputSchema: { status: z.enum(['requested','scheduled','completed']).optional(), engagement_id: z.string().optional() },
    }, async ({ status, engagement_id }) => {
      let q = supabase.from('calls').select('*, engagements(organization)').order('scheduled_at', { ascending: true })
      if (status) q = q.eq('status', status)
      if (engagement_id) q = q.eq('engagement_id', engagement_id)
      const { data, error } = await q
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(data ?? [], null, 2) }] }
    })

    server.registerTool('add_call', {
      title: 'Add Call',
      description: 'Schedule or log a call for an engagement. Type: discovery = team call, mori = Mori is on the call.',
      inputSchema: {
        engagement_id: z.string(),
        type: z.enum(['discovery','mori']),
        status: z.enum(['requested','scheduled','completed']),
        scheduled_at: z.string().optional(),
        requested_at: z.string().optional(),
        notes: z.string().optional(),
      },
    }, async ({ engagement_id, type, status, scheduled_at, requested_at, notes }) => {
      const { error } = await supabase.from('calls').insert({ engagement_id, type, status, scheduled_at, notes, added_by: 'ai', requested_at: requested_at ?? new Date().toISOString() })
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: `Call added.` }] }
    })

    server.registerTool('update_call', {
      title: 'Update Call',
      description: 'Update an existing call record — change its status, scheduled time, or notes. Use this instead of add_call when a call already exists and just needs updating.',
      inputSchema: {
        call_id: z.string(),
        status: z.enum(['requested','scheduled','completed']).optional(),
        scheduled_at: z.string().optional(),
        requested_at: z.string().optional(),
        notes: z.string().optional(),
      },
    }, async ({ call_id, status, scheduled_at, requested_at, notes }) => {
      const updates: Record<string, unknown> = {}
      if (status !== undefined) updates.status = status
      if (scheduled_at !== undefined) updates.scheduled_at = scheduled_at
      if (requested_at !== undefined) updates.requested_at = requested_at
      if (notes !== undefined) updates.notes = notes
      const { error } = await supabase.from('calls').update(updates).eq('id', call_id)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: 'Call updated.' }] }
    })

    server.registerTool('add_material', {
      title: 'Add Material',
      description: 'Add a material item. outgoing = sent to client (bio, headshot etc), incoming = received from client (agenda, attendee list etc).',
      inputSchema: {
        engagement_id: z.string(),
        direction: z.enum(['outgoing','incoming']),
        label: z.string(),
        url: z.string().optional(),
        notes: z.string().optional(),
      },
    }, async ({ engagement_id, direction, label, url, notes }) => {
      const { error } = await supabase.from('materials').insert({ engagement_id, direction, label, url, note: notes, done: false, received: false, added_at: new Date().toISOString() })
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: `Material "${label}" added.` }] }
    })

    server.registerTool('archive_engagement', {
      title: 'Archive Engagement',
      description: 'Archive an engagement so it no longer appears in the active pipeline. Cannot be undone from Claude.',
      inputSchema: { engagement_id: z.string(), reason: z.string().optional() },
    }, async ({ engagement_id, reason }) => {
      const now = new Date().toISOString()
      const patch: Record<string, unknown> = { archived: true, archived_at: now, updated_at: now }
      if (reason) patch.cancellation_reason = reason
      const { error } = await supabase.from('engagements').update(patch).eq('id', engagement_id)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: `Engagement archived.` }] }
    })

  },
  {},
  {
    basePath: '/api',
    maxDuration: 60,
  }
)

export { handler as GET, handler as POST }