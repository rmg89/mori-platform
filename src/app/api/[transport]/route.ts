import { createMcpHandler } from 'mcp-handler'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { scanEngagement } from '@/lib/ai-scan'

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

    // ── 1. list_engagements ───────────────────────────────────────────────────
    server.registerTool('list_engagements', {
      title: 'List Engagements',
      description: 'List or search engagements. Filter by section, stage, type, or org. Pass query to full-text search. Pass upcoming_days to get confirmed events within N days. Pass stale_days to find prospects with no activity. Pass unpaid_only to get wrap-up engagements with outstanding invoices.',
      inputSchema: {
        section: z.enum(['prospects','engagements','wrap-up']).optional(),
        prospect_step: z.string().optional(),
        event_type: z.string().optional(),
        organization: z.string().optional(),
        query: z.string().optional(),
        upcoming_days: z.number().optional(),
        stale_days: z.number().optional(),
        unpaid_only: z.boolean().optional(),
        limit: z.number().optional(),
      },
    }, async ({ section, prospect_step, event_type, organization, query, upcoming_days, stale_days, unpaid_only, limit }) => {
      // Unpaid invoices mode
      if (unpaid_only) {
        const { data, error } = await supabase.from('engagements').select('id,organization,event_name,event_date,fee,invoice_sent_at,deposit_amount,deposit_invoice_sent_at,deposit_received_at').eq('section','wrap-up').not('invoice_sent_at','is',null).is('payment_received_at',null).eq('archived',false)
        if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
        return { content: [{ type: 'text' as const, text: JSON.stringify(data ?? [], null, 2) }] }
      }
      // Upcoming events mode
      if (upcoming_days !== undefined) {
        const today = new Date().toISOString().split('T')[0]
        const future = new Date(Date.now() + upcoming_days * 86400000).toISOString().split('T')[0]
        const { data, error } = await supabase.from('engagements').select('*').eq('section','engagements').eq('archived',false).gte('event_date',today).lte('event_date',future).order('event_date')
        if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
        return { content: [{ type: 'text' as const, text: JSON.stringify((data ?? []).map(engSummary), null, 2) }] }
      }
      // Stale prospects mode
      if (stale_days !== undefined) {
        const cutoff = new Date(Date.now() - stale_days * 86400000).toISOString()
        const { data, error } = await supabase.from('engagements').select('*').eq('section','prospects').eq('archived',false).lt('last_activity_at',cutoff).order('last_activity_at')
        if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
        return { content: [{ type: 'text' as const, text: JSON.stringify((data ?? []).map(engSummary), null, 2) }] }
      }
      // Full-text search mode
      if (query) {
        const [{ data: byOrg }, { data: byNotes }] = await Promise.all([
          supabase.from('engagements').select('*').eq('archived',false).ilike('organization',`%${query}%`).limit(10),
          supabase.from('engagements').select('*').eq('archived',false).ilike('notes',`%${query}%`).limit(10),
        ])
        const { data: contactRows } = await supabase.from('contacts').select('engagement_id').or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
        const ids = (contactRows ?? []).map((c: Record<string,unknown>) => c.engagement_id as string)
        const { data: byContact } = ids.length > 0 ? await supabase.from('engagements').select('*').in('id', ids) : { data: [] }
        const all = [...(byOrg ?? []), ...(byNotes ?? []), ...(byContact ?? [])]
        const unique = Array.from(new Map(all.map(e => [e.id, e])).values())
        return { content: [{ type: 'text' as const, text: JSON.stringify(unique.map(engSummary), null, 2) }] }
      }
      // Standard list mode
      let q = supabase.from('engagements').select('*').eq('archived',false).order('last_activity_at',{ ascending: false }).limit(limit ?? 20)
      if (section) q = q.eq('section', section)
      if (prospect_step) q = q.eq('prospect_step', prospect_step)
      if (event_type) q = q.eq('event_type', event_type)
      if (organization) q = q.ilike('organization', `%${organization}%`)
      const { data, error } = await q
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify((data ?? []).map(engSummary), null, 2) }] }
    })

    // ── 2. get_engagement ─────────────────────────────────────────────────────
    server.registerTool('get_engagement', {
      title: 'Get Engagement',
      description: 'Get full details for a single engagement including contacts, communications, calls, materials, and briefing notes. The engagement row also contains the briefing document fields: purpose, audience_description, join_link (virtual), arrival_time (in-person), venue_maps_link, flight_details, hotel_name, ground_transport, moderator_info, panelist_info, dress_code, etc. Null = not yet filled in. travel_not_needed/venue_not_needed flags indicate those sections were deliberately skipped.',
      inputSchema: { id: z.string().optional(), organization: z.string().optional() },
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

    // ── 3. get_dashboard_summary ──────────────────────────────────────────────
    server.registerTool('get_dashboard_summary', {
      title: 'Get Dashboard Summary',
      description: 'High-level summary: counts by section, upcoming events, items needing response, unpaid invoices, stale prospects. Use for "what do I need to focus on today".',
      inputSchema: {},
    }, async () => {
      const today = new Date().toISOString().split('T')[0]
      const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
      const staleDate = new Date(Date.now() - 7 * 86400000).toISOString()
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

    // ── 4. get_needs_response ─────────────────────────────────────────────────
    server.registerTool('get_needs_response', {
      title: 'Get Needs Response',
      description: 'Get all communications flagged as needing a response, with engagement context. Use for daily triage.',
      inputSchema: {},
    }, async () => {
      const { data, error } = await supabase.from('communications').select('*, engagements(id,organization,section)').eq('needs_response', true).order('date', { ascending: false })
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(data ?? [], null, 2) }] }
    })

    // ── 5. get_contact_history ────────────────────────────────────────────────
    server.registerTool('get_contact_history', {
      title: 'Get Contact History',
      description: 'Get all engagements and communications for a person by email. Use to understand the full relationship history with someone.',
      inputSchema: { email: z.string() },
    }, async ({ email }) => {
      const { data: contacts } = await supabase.from('contacts').select('engagement_id,first_name,last_name,title').ilike('email', `%${email}%`)
      const ids = (contacts ?? []).map((c: Record<string, unknown>) => c.engagement_id as string)
      if (!ids.length) return { content: [{ type: 'text' as const, text: 'No contact found.' }] }
      const [{ data: engs }, { data: comms }] = await Promise.all([
        supabase.from('engagements').select('id,organization,event_name,event_date,section,prospect_step').in('id', ids),
        supabase.from('communications').select('*').in('engagement_id', ids).order('date', { ascending: false }).limit(20),
      ])
      return { content: [{ type: 'text' as const, text: JSON.stringify({ contact: contacts?.[0], engagements: engs, recent_communications: comms }, null, 2) }] }
    })

    // ── 6. update_prospect_stage ──────────────────────────────────────────────
    server.registerTool('update_prospect_stage', {
      title: 'Update Prospect Stage',
      description: 'Move a prospect to a different pipeline stage: inquiry, outreach, in_contact, declined. Declining moves the engagement to Wrap-Up for review and triggers an automatic AI scan of which post-event items still apply.',
      inputSchema: {
        engagement_id: z.string(),
        stage: z.enum(['inquiry','outreach','in_contact','declined']),
        reason: z.string().optional(),
      },
    }, async ({ engagement_id, stage, reason }) => {
      const patch: Record<string, unknown> = { prospect_step: stage, updated_at: new Date().toISOString() }
      if (reason) patch.cancellation_reason = reason
      if (stage === 'declined') {
        patch.section = 'wrap-up'
        patch.wrap_up_review_needed = true
        patch.declined_at = new Date().toISOString()
      }
      const { error } = await supabase.from('engagements').update(patch).eq('id', engagement_id)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      if (stage === 'declined') {
        try { await scanEngagement(supabase, engagement_id, 'declined') } catch (err) { console.error('scanEngagement (declined):', err) }
        return { content: [{ type: 'text' as const, text: 'Stage updated to "declined". Moved to Wrap-Up for review — an AI scan has flagged which post-event items still apply.' }] }
      }
      return { content: [{ type: 'text' as const, text: `Stage updated to "${stage}".` }] }
    })

    // ── 7. move_to_confirmed ──────────────────────────────────────────────────
    server.registerTool('move_to_confirmed', {
      title: 'Move to Confirmed',
      description: 'Graduate a prospect to a confirmed engagement when they have been booked. Triggers an automatic AI scan that flags whether a contract is required and which prep materials are needed.',
      inputSchema: { engagement_id: z.string() },
    }, async ({ engagement_id }) => {
      const { error } = await supabase.from('engagements').update({ section: 'engagements', prospect_step: null, booking_review_needed: true, confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', engagement_id)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      try { await scanEngagement(supabase, engagement_id, 'booking') } catch (err) { console.error('scanEngagement (booking):', err) }
      return { content: [{ type: 'text' as const, text: 'Moved to confirmed engagements. An AI scan has flagged whether a contract is required and which prep materials are needed — review in the "Needs Review" section.' }] }
    })

    // ── 8. move_to_wrapup ─────────────────────────────────────────────────────
    server.registerTool('move_to_wrapup', {
      title: 'Move to Wrap-Up',
      description: 'Move a confirmed engagement to wrap-up after the event has occurred. Triggers an automatic AI scan that flags which post-event items are likely needed.',
      inputSchema: { engagement_id: z.string() },
    }, async ({ engagement_id }) => {
      const { error } = await supabase.from('engagements').update({ section: 'wrap-up', wrap_up_review_needed: true, updated_at: new Date().toISOString() }).eq('id', engagement_id)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      try { await scanEngagement(supabase, engagement_id, 'wrapup') } catch (err) { console.error('scanEngagement (wrapup):', err) }
      return { content: [{ type: 'text' as const, text: 'Moved to wrap-up. An AI scan has flagged which post-event items are likely needed — review in the "Needs Review" section.' }] }
    })

    // ── 9. update_engagement_field ────────────────────────────────────────────
    server.registerTool('update_engagement_field', {
      title: 'Update Engagement Field',
      description: 'Update any field on an engagement. Field formatting rules: flight_details — one leg per line WITH date prefix, format each as "Thu Jun 4 · AA 1234 JFK→LAX 8:00 AM–11:30 AM"; connection on its own line as "Connection: 1h 15m in CLT"; return flights after a blank line. run_of_show — JSON string: \'[{"date":"Thu Jun 5","time":"9:30 AM","end_time":"11:00 AM","what":"Session title","notes":"Mori\'s role"}]\'. company_id — pass the company UUID. All other fields are plain strings/numbers/booleans.',
      inputSchema: {
        engagement_id: z.string(),
        field: z.enum([
          // Core
          'organization','event_name','event_date','event_end_date','event_time','event_city','event_location',
          'event_format','topic','fee','deposit_amount','payment_notes','session_length','audience_size',
          'travel_covered','travel_destination','hotel_covered','av_needs','source',
          'booker_name','notes','outstanding_items','follow_up_details','company_id',
          // Briefing — prep
          'purpose','audience_description','dress_code','moderator_info','panelist_info','vip_info',
          // Briefing — virtual
          'join_link','dial_in_backup','green_room_time','go_live_time',
          // Briefing — venue
          'arrival_time','venue_maps_link','venue_special_instructions',
          // Briefing — travel
          'flight_details','flight_confirmation','hotel_name','hotel_checkin',
          'hotel_confirmation','hotel_maps_link','ground_transport',
          'drive_time','drive_route_link','parking_details',
          // Structured JSON
          'run_of_show',
        ]),
        value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
      },
    }, async ({ engagement_id, field, value }) => {
      // run_of_show is JSONB — parse from string if needed
      const dbValue = field === 'run_of_show' && typeof value === 'string'
        ? (() => { try { return JSON.parse(value) } catch { return value } })()
        : value
      const { error } = await supabase.from('engagements').update({ [field]: dbValue, updated_at: new Date().toISOString() }).eq('id', engagement_id)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: `Updated ${field}.` }] }
    })

    // ── 10. set_engagement_flag ───────────────────────────────────────────────
    server.registerTool('set_engagement_flag', {
      title: 'Set Engagement Flag',
      description: 'Mark a workflow flag on an engagement. For not_needed: pass flag="not_needed", item="<field>" and value=true to opt it out. For needed: pass flag="needed", item="<field>" and value=true to flag something as explicitly required but not yet provided. Use booking_reviewed/wrap_up_reviewed to clear review flags. Flags: contract_sent, contract_signed, materials_sent, briefing_complete, materials_requested, deposit_invoice_sent, deposit_received, not_needed, needed, booking_reviewed, wrap_up_reviewed.',
      inputSchema: {
        engagement_id: z.string(),
        flag: z.enum(['contract_sent','contract_signed','materials_sent','briefing_complete','materials_requested','deposit_invoice_sent','deposit_received','not_needed','needed','wrap_up_reviewed','booking_reviewed']),
        value: z.boolean(),
        item: z.string().optional(),
      },
    }, async ({ engagement_id, flag, value, item }) => {
      const now = new Date().toISOString()
      // Array flags: not_needed and needed share the same pattern
      if (flag === 'not_needed' || flag === 'needed') {
        if (!item) return { content: [{ type: 'text' as const, text: `item is required when flag is ${flag}.` }] }
        const col = flag === 'not_needed' ? 'not_needed' : 'needed'
        const { data: row } = await supabase.from('engagements').select(col).eq('id', engagement_id).single()
        const current: string[] = (row as Record<string, unknown>)?.[col] as string[] ?? []
        const updated = value
          ? Array.from(new Set([...current, item]))
          : current.filter((x: string) => x !== item)
        const { error } = await supabase.from('engagements').update({ [col]: updated, updated_at: now }).eq('id', engagement_id)
        if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
        return { content: [{ type: 'text' as const, text: `"${item}" ${value ? `marked ${flag}` : `removed from ${flag}`}.` }] }
      }
      const colMap: Record<string, Record<string, unknown>> = {
        contract_sent:        { contract_sent_at: value ? now : null },
        contract_signed:      { contract_signed_at: value ? now : null },
        materials_sent:       { client_deliverables_sent: value },
        briefing_complete:    { briefing_complete: value, briefing_complete_at: value ? now : null },
        materials_requested:  { materials_requested: value },
        deposit_invoice_sent: { deposit_invoice_sent_at: value ? now : null },
        deposit_received:     { deposit_received_at: value ? now : null },
        wrap_up_reviewed:     { wrap_up_review_needed: false },
        booking_reviewed:     { booking_review_needed: false },
      }
      const { error } = await supabase.from('engagements').update({ ...colMap[flag], updated_at: now }).eq('id', engagement_id)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: `Flag "${flag}" set to ${value}.` }] }
    })

    // ── 11. set_post_event_flag ───────────────────────────────────────────────
    server.registerTool('set_post_event_flag', {
      title: 'Set Post-Event Flag',
      description: 'Mark a post-event wrap-up flag: invoice_sent, payment_received, thank_you_sent, testimonial_requested, media_received, media_uploaded, media_processed, social_media_complete.',
      inputSchema: {
        engagement_id: z.string(),
        flag: z.enum(['invoice_sent','payment_received','thank_you_sent','testimonial_requested','media_received','media_uploaded','media_processed','social_media_complete']),
        value: z.boolean(),
      },
    }, async ({ engagement_id, flag, value }) => {
      const now = new Date().toISOString()
      const colMap: Record<string, Record<string, unknown>> = {
        invoice_sent:         { invoice_sent_at: value ? now : null },
        payment_received:     { payment_received_at: value ? now : null },
        thank_you_sent:       { thank_you_sent: value },
        testimonial_requested:{ testimonial_requested: value },
        media_received:       { media_received: value },
        media_uploaded:       { media_uploaded: value },
        media_processed:      { media_processed: value },
        social_media_complete:{ social_media_complete: value },
      }
      const { error } = await supabase.from('engagements').update({ ...colMap[flag], updated_at: now }).eq('id', engagement_id)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: `Post-event flag "${flag}" set to ${value}.` }] }
    })

    // ── 12. add_communication ─────────────────────────────────────────────────
    server.registerTool('add_communication', {
      title: 'Add Communication',
      description: 'Log a communication against an engagement — inbound email, outbound email, call, or note. Set needs_response: true if a reply is required.',
      inputSchema: {
        engagement_id: z.string(),
        type: z.enum(['email_inbound','email_outbound','call','note','stage_change']),
        body: z.string(),
        subject: z.string().optional(),
        from_name: z.string().optional(),
        to_name: z.string().optional(),
        staff_name: z.string().optional(),
        needs_response: z.boolean().optional(),
        date: z.string().optional(),
      },
    }, async ({ engagement_id, type, body, subject, from_name, to_name, staff_name, needs_response, date }) => {
      const now = date ?? new Date().toISOString()
      const { error } = await supabase.from('communications').insert({ engagement_id, type, body, subject, from_name, to_name, staff_name, needs_response: needs_response ?? false, date: now, channel: type === 'call' ? 'phone' : 'email' })
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      await supabase.from('engagements').update({ last_activity_at: now, updated_at: now }).eq('id', engagement_id)
      return { content: [{ type: 'text' as const, text: 'Communication logged.' }] }
    })

    // ── 13. add_briefing_note ─────────────────────────────────────────────────
    server.registerTool('add_briefing_note', {
      title: 'Add / Resolve Briefing Note',
      description: 'Add a timestamped note to an engagement briefing log. To resolve an existing note, pass the note_id instead of body.',
      inputSchema: {
        engagement_id: z.string(),
        body: z.string().optional(),
        note_id: z.string().optional(),
        resolve: z.boolean().optional(),
      },
    }, async ({ engagement_id, body, note_id, resolve }) => {
      if (note_id || resolve) {
        const id = note_id
        if (!id) return { content: [{ type: 'text' as const, text: 'note_id required to resolve.' }] }
        const { error } = await supabase.from('briefing_notes').update({ resolved: true }).eq('id', id)
        if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
        return { content: [{ type: 'text' as const, text: 'Briefing note resolved.' }] }
      }
      if (!body) return { content: [{ type: 'text' as const, text: 'body required to add a note.' }] }
      const { error } = await supabase.from('briefing_notes').insert({ engagement_id, body, resolved: false })
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: 'Briefing note added.' }] }
    })

    // ── 14. list_calls ────────────────────────────────────────────────────────
    server.registerTool('list_calls', {
      title: 'List Calls',
      description: 'List calls across engagements, optionally filtered by status or engagement.',
      inputSchema: {
        status: z.enum(['requested','scheduled','completed']).optional(),
        engagement_id: z.string().optional(),
      },
    }, async ({ status, engagement_id }) => {
      let q = supabase.from('calls').select('*, engagements(organization)').order('scheduled_at', { ascending: true })
      if (status) q = q.eq('status', status)
      if (engagement_id) q = q.eq('engagement_id', engagement_id)
      const { data, error } = await q
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(data ?? [], null, 2) }] }
    })

    // ── 15. add_call ──────────────────────────────────────────────────────────
    server.registerTool('add_call', {
      title: 'Add Call',
      description: 'Schedule or log a call for an engagement. type: discovery = team prep call, mori = Mori is on the call.',
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
      return { content: [{ type: 'text' as const, text: 'Call added.' }] }
    })

    // ── 16. update_call ───────────────────────────────────────────────────────
    server.registerTool('update_call', {
      title: 'Update Call',
      description: 'Update an existing call record — change status, scheduled time, or notes. Use instead of add_call when a call already exists.',
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

    // ── 17. add_material ──────────────────────────────────────────────────────
    server.registerTool('add_material', {
      title: 'Add Material',
      description: 'Add a material item to an engagement. outgoing = sent to client (bio, headshot etc), incoming = received from client (agenda, attendee list etc).',
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

    // ── 18. create_prospect ───────────────────────────────────────────────────
    server.registerTool('create_prospect', {
      title: 'Create Prospect',
      description: 'Create a new prospect in the pipeline from a new inquiry or lead. Returns the new engagement id.',
      inputSchema: {
        organization: z.string(),
        prospect_step: z.enum(['inquiry','outreach','in_contact']).optional(),
        event_type: z.enum(['speaking','podcast','interview','panel','livestream','coaching']).optional(),
        event_name: z.string().optional(),
        event_date: z.string().optional(),
        event_city: z.string().optional(),
        event_format: z.enum(['in_person','virtual','hybrid']).optional(),
        fee: z.number().optional(),
        source: z.string().optional(),
        booker_name: z.string().optional(),
        topic: z.string().optional(),
        notes: z.string().optional(),
      },
    }, async ({ organization, prospect_step, event_type, event_name, event_date, event_city, event_format, fee, source, booker_name, topic, notes }) => {
      const now = new Date().toISOString()
      const { data, error } = await supabase.from('engagements').insert({
        organization, section: 'prospects',
        prospect_step: prospect_step ?? 'inquiry',
        event_type: event_type ?? 'speaking',
        event_name, event_date, event_city, event_format, fee, source, booker_name, topic, notes,
        archived: false, created_at: now, updated_at: now, last_activity_at: now,
      }).select('id').single()
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: `Prospect created. id: ${data.id}` }] }
    })

    // ── 19. add_contact ───────────────────────────────────────────────────────
    server.registerTool('add_contact', {
      title: 'Add Contact',
      description: 'Add a new contact to an engagement. Set is_point_of_contact: true for the primary person to communicate with.',
      inputSchema: {
        engagement_id: z.string(),
        first_name: z.string(),
        last_name: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        title: z.string().optional(),
        role: z.enum(['primary','bureau','legal','logistics','av','assistant','other','unknown']).optional(),
        is_point_of_contact: z.boolean().optional(),
        notes: z.string().optional(),
      },
    }, async ({ engagement_id, first_name, last_name, email, phone, title, role, is_point_of_contact, notes }) => {
      const { error } = await supabase.from('contacts').insert({
        engagement_id, first_name, last_name: last_name ?? '', email, phone, title,
        role: role ?? 'primary',
        is_current_point_of_contact: is_point_of_contact ?? false,
        status: 'prospect_active', watching: false, notes,
      })
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: `Contact ${first_name} ${last_name ?? ''} added.` }] }
    })

    // ── 20. update_contact ────────────────────────────────────────────────────
    server.registerTool('update_contact', {
      title: 'Update Contact',
      description: 'Update an existing contact by their id. Get the id from get_engagement.',
      inputSchema: {
        contact_id: z.string(),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        title: z.string().optional(),
        role: z.enum(['primary','bureau','legal','logistics','av','assistant','other','unknown']).optional(),
        is_point_of_contact: z.boolean().optional(),
        company_id: z.string().optional(),
        notes: z.string().optional(),
      },
    }, async ({ contact_id, first_name, last_name, email, phone, title, role, is_point_of_contact, company_id, notes }) => {
      const updates: Record<string, unknown> = {}
      if (first_name !== undefined) updates.first_name = first_name
      if (last_name !== undefined) updates.last_name = last_name
      if (email !== undefined) updates.email = email
      if (phone !== undefined) updates.phone = phone
      if (title !== undefined) updates.title = title
      if (role !== undefined) updates.role = role
      if (is_point_of_contact !== undefined) updates.is_current_point_of_contact = is_point_of_contact
      if (company_id !== undefined) updates.company_id = company_id
      if (notes !== undefined) updates.notes = notes
      const { error } = await supabase.from('contacts').update(updates).eq('id', contact_id)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: 'Contact updated.' }] }
    })

    // ── 21. remove_contact ────────────────────────────────────────────────────
    server.registerTool('remove_contact', {
      title: 'Remove Contact',
      description: 'Remove a contact from an engagement by their contact id.',
      inputSchema: { contact_id: z.string() },
    }, async ({ contact_id }) => {
      const { error } = await supabase.from('contacts').delete().eq('id', contact_id)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: 'Contact removed.' }] }
    })

    // ── 22. archive_engagement ────────────────────────────────────────────────
    server.registerTool('archive_engagement', {
      title: 'Archive Engagement',
      description: 'Archive an engagement so it no longer appears in the active pipeline.',
      inputSchema: { engagement_id: z.string(), reason: z.string().optional() },
    }, async ({ engagement_id, reason }) => {
      const now = new Date().toISOString()
      const patch: Record<string, unknown> = { archived: true, archived_at: now, updated_at: now }
      if (reason) patch.cancellation_reason = reason
      const { error } = await supabase.from('engagements').update(patch).eq('id', engagement_id)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: 'Engagement archived.' }] }
    })

    // ── 23. get_companies ─────────────────────────────────────────────────────
    server.registerTool('get_companies', {
      title: 'Get Companies',
      description: 'List all companies or search by name.',
      inputSchema: { name: z.string().optional(), watching_only: z.boolean().optional() },
    }, async ({ name, watching_only }) => {
      let q = supabase.from('companies').select('id,name,industry,website,watching,notes').order('name')
      if (name) q = q.ilike('name', `%${name}%`)
      if (watching_only) q = q.eq('watching', true)
      const { data, error } = await q
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: JSON.stringify(data ?? [], null, 2) }] }
    })

    // ── 24. create_company ────────────────────────────────────────────────────
    server.registerTool('create_company', {
      title: 'Create Company',
      description: 'Create a new company record. Returns the new company id.',
      inputSchema: {
        name: z.string(),
        industry: z.string().optional(),
        website: z.string().optional(),
        watching: z.boolean().optional(),
        notes: z.string().optional(),
      },
    }, async ({ name, industry, website, watching, notes }) => {
      const { data, error } = await supabase.from('companies').insert({ name, industry, website, watching: watching ?? false, notes }).select('id').single()
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: `Company "${name}" created. id: ${data.id}` }] }
    })

    // ── 25. update_company ────────────────────────────────────────────────────
    server.registerTool('update_company', {
      title: 'Update Company',
      description: 'Update a company record by id. Use get_companies to find the id.',
      inputSchema: {
        company_id: z.string(),
        name: z.string().optional(),
        industry: z.string().optional(),
        website: z.string().optional(),
        watching: z.boolean().optional(),
        notes: z.string().optional(),
      },
    }, async ({ company_id, name, industry, website, watching, notes }) => {
      const updates: Record<string, unknown> = {}
      if (name !== undefined) updates.name = name
      if (industry !== undefined) updates.industry = industry
      if (website !== undefined) updates.website = website
      if (watching !== undefined) updates.watching = watching
      if (notes !== undefined) updates.notes = notes
      const { error } = await supabase.from('companies').update(updates).eq('id', company_id)
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      return { content: [{ type: 'text' as const, text: 'Company updated.' }] }
    })

    // ── 26. get_document_text ─────────────────────────────────────────────────
    server.registerTool('get_document_text', {
      title: 'Get Document Text',
      description: 'Fetch and read the text content of an uploaded document or linked URL. Use this to read PDFs, schedules, agendas, fireside chat questions, or any file attached to an engagement. Pass the file_url or link from a material item returned by get_engagement.',
      inputSchema: { url: z.string() },
    }, async ({ url }) => {
      try {
        const res = await fetch(url)
        if (!res.ok) return { content: [{ type: 'text' as const, text: `Failed to fetch: ${res.status}` }] }

        const contentType = res.headers.get('content-type') || ''

        if (contentType.includes('pdf') || url.toLowerCase().endsWith('.pdf')) {
          const pdfParse = require('pdf-parse')
          const buffer = Buffer.from(await res.arrayBuffer())
          const data = await pdfParse(buffer)
          const text = data.text.trim().slice(0, 20000) // cap at 20k chars
          return { content: [{ type: 'text' as const, text: `[PDF — ${data.numpages} pages]\n\n${text}` }] }
        }

        // For HTML/text content
        const text = await res.text()
        return { content: [{ type: 'text' as const, text: text.slice(0, 20000) }] }
      } catch (err: unknown) {
        return { content: [{ type: 'text' as const, text: `Error reading document: ${err instanceof Error ? err.message : String(err)}` }] }
      }
    })

    // ── 27. generate_briefing_pdf ─────────────────────────────────────────────
    server.registerTool('generate_briefing_pdf', {
      title: 'Generate Briefing PDF',
      description: 'Generate the briefing document PDF for an engagement, upload it to storage, and return a public URL to share directly in chat. Call this whenever asked to produce or send the briefing doc.',
      inputSchema: { engagement_id: z.string() },
    }, async ({ engagement_id }) => {
      const [{ data: eng, error: engErr }, { data: contacts }] = await Promise.all([
        supabase.from('engagements').select('*').eq('id', engagement_id).single(),
        supabase.from('contacts').select('*').eq('engagement_id', engagement_id),
      ])
      if (engErr || !eng) return { content: [{ type: 'text' as const, text: 'Engagement not found.' }] }

      const client = {
        ...(eng as Record<string, unknown>),
        contacts: (contacts ?? []).map((c: Record<string, unknown>) => ({ ...c, is_current_point_of_contact: c.is_current_point_of_contact ?? false })),
        comms: [], calls: [], alerts: [],
        engagement_flags: [], media_flags: [], post_event_flags: [], post_event_needed: [], post_event_not_needed: [],
      }

      const { generateBriefingDocBytes } = await import('@/lib/documents')
      const buffer = generateBriefingDocBytes(client as any)

      const filename = `briefings/${engagement_id}.pdf`
      const { data: upload, error: uploadErr } = await supabase.storage
        .from('materials')
        .upload(filename, buffer, { contentType: 'application/pdf', upsert: true })

      if (uploadErr) return { content: [{ type: 'text' as const, text: `Upload error: ${uploadErr.message}` }] }

      const { data: { publicUrl } } = supabase.storage.from('materials').getPublicUrl(upload.path)
      await supabase.from('engagements').update({ briefing_pdf_url: publicUrl }).eq('id', engagement_id)

      return { content: [{ type: 'text' as const, text: `Briefing PDF for ${(eng as Record<string, unknown>).organization}: ${publicUrl}` }] }
    })

  },
  {},
  {
    basePath: '/api',
    maxDuration: 60,
  }
)

export { handler as GET, handler as POST }
