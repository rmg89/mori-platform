import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_OUTGOING_MATERIALS, DEFAULT_INCOMING_MATERIALS, POST_EVENT_FLAGS, PostEventFlag } from '@/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export type ScanType = 'booking' | 'declined' | 'wrapup'

const POST_EVENT_FLAG_IDS = POST_EVENT_FLAGS.map(f => f.id)
const OUTGOING_IDS = DEFAULT_OUTGOING_MATERIALS.map(m => m.id)
const INCOMING_IDS = DEFAULT_INCOMING_MATERIALS.map(m => m.id)

function buildContext(row: Record<string, unknown>, contacts: Record<string, unknown>[], comms: Record<string, unknown>[]): string {
  const lines: string[] = []
  lines.push(`Organization: ${row.organization}`)
  if (row.event_name) lines.push(`Event name: ${row.event_name}`)
  if (row.event_type) lines.push(`Event type: ${row.event_type}`)
  if (row.topic) lines.push(`Topic: ${row.topic}`)
  if (row.fee != null) lines.push(`Fee: ${row.fee}`)
  if (row.event_date) lines.push(`Event date: ${row.event_date}`)
  if (row.event_format) lines.push(`Event format: ${row.event_format}`)
  if (row.audience_size != null) lines.push(`Audience size: ${row.audience_size}`)
  if (row.deposit_amount != null) lines.push(`Deposit amount: ${row.deposit_amount}`)
  if (row.deposit_received_at) lines.push(`Deposit received at: ${row.deposit_received_at}`)
  if (row.notes) lines.push(`Notes: ${row.notes}`)
  if (row.cancellation_reason) lines.push(`Cancellation reason: ${row.cancellation_reason}`)

  if (contacts.length) {
    lines.push('', 'Contacts:')
    for (const c of contacts) {
      lines.push(`- ${c.first_name} ${c.last_name ?? ''} (${c.role ?? 'unknown'})${c.email ? `, ${c.email}` : ''}`)
    }
  }

  if (comms.length) {
    lines.push('', 'Recent communications:')
    for (const c of comms) {
      const body = typeof c.body === 'string' ? c.body.slice(0, 300) : ''
      lines.push(`- [${c.date}] ${c.subject ?? '(no subject)'}${body ? ` — ${body}` : ''}`)
    }
  }

  return lines.join('\n')
}

function systemPromptFor(scanType: ScanType): string {
  if (scanType === 'booking') {
    return `A speaker booking has just been confirmed. Based on the engagement details below, determine:
- Whether a signed contract is required (true/false)
- Whether any outgoing prep materials need to be sent to the client, and if so which ones
- Whether any materials are needed back from the client, and if so which ones

Outgoing material ids: ${OUTGOING_IDS.join(', ')}
Incoming material ids: ${INCOMING_IDS.join(', ')}

Respond with ONLY a JSON object (no markdown fences) in this exact shape:
{
  "contract_required": true,
  "outgoing_not_needed": false,
  "incoming_not_needed": false,
  "outgoing_material_ids": ["bio","headshot"],
  "incoming_material_ids": ["in_agenda"],
  "summary": "1-3 sentence summary of what was determined and why"
}`
  }

  if (scanType === 'declined') {
    return `This prospect has just declined — no event will occur. Based on the details below, determine which post-event items still apply (e.g. a thank-you note or relationship follow-up may still make sense) versus which clearly don't apply since there was no event (invoice, testimonial, media, social_media — these should be "not needed" unless the context shows a deposit was already paid or work was already done).

Post-event flag ids: ${POST_EVENT_FLAG_IDS.join(', ')}

Respond with ONLY a JSON object (no markdown fences) in this exact shape:
{
  "post_event_needed": ["thank_you","follow_up"],
  "post_event_not_needed": ["invoice","testimonial","media","social_media"],
  "follow_up_details": "optional — what the follow-up should cover",
  "summary": "1-3 sentence summary of what was determined and why"
}`
  }

  return `This engagement's event date has passed and it has moved to wrap-up. Based on the details below (fee, deposit status, event type, communications), determine which post-event items are likely needed versus not needed.

Post-event flag ids: ${POST_EVENT_FLAG_IDS.join(', ')}

Respond with ONLY a JSON object (no markdown fences) in this exact shape:
{
  "post_event_needed": ["invoice","thank_you","testimonial","media","social_media","follow_up"],
  "post_event_not_needed": [],
  "follow_up_details": "optional — what the follow-up should cover",
  "summary": "1-3 sentence summary of what was determined and why"
}`
}

function parseJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (match) {
      try { return JSON.parse(match[1]) } catch { return null }
    }
    return null
  }
}

export async function scanEngagement(supabase: SupabaseClient, engagementId: string, scanType: ScanType): Promise<{ patch: Record<string, unknown>; summary?: string }> {
  try {
    const [{ data: row, error }, { data: contacts }, { data: comms }] = await Promise.all([
      supabase.from('engagements').select('*').eq('id', engagementId).single(),
      supabase.from('contacts').select('first_name,last_name,email,role').eq('engagement_id', engagementId),
      supabase.from('communications').select('date,subject,body').eq('engagement_id', engagementId).order('date', { ascending: false }).limit(10),
    ])

    if (error || !row) return { patch: {} }

    const context = buildContext(row, contacts ?? [], comms ?? [])
    const system = systemPromptFor(scanType)

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 700,
      system,
      messages: [{ role: 'user', content: context }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const result = parseJson(text)
    if (!result) return { patch: {} }

    const now = new Date().toISOString()
    let patch: Record<string, unknown> = {}

    if (scanType === 'booking') {
      const outgoingIds = new Set((result.outgoing_material_ids as string[] | undefined) ?? [])
      const incomingIds = new Set((result.incoming_material_ids as string[] | undefined) ?? [])
      patch = {
        contract_required: typeof result.contract_required === 'boolean' ? result.contract_required : null,
        outgoing_not_needed: !!result.outgoing_not_needed,
        incoming_not_needed: !!result.incoming_not_needed,
        outgoing_materials: DEFAULT_OUTGOING_MATERIALS
          .filter(m => outgoingIds.has(m.id))
          .map(m => ({ ...m, done: false, added_at: now })),
        incoming_materials: DEFAULT_INCOMING_MATERIALS
          .filter(m => incomingIds.has(m.id))
          .map(m => ({ ...m, received: false, added_at: now })),
      }
    } else {
      const needed = ((result.post_event_needed as string[] | undefined) ?? []).filter((id): id is PostEventFlag => (POST_EVENT_FLAG_IDS as string[]).includes(id))
      const notNeeded = ((result.post_event_not_needed as string[] | undefined) ?? []).filter((id): id is PostEventFlag => (POST_EVENT_FLAG_IDS as string[]).includes(id))
      patch = {
        post_event_needed: needed,
        post_event_not_needed: notNeeded,
      }
      if (typeof result.follow_up_details === 'string' && result.follow_up_details) {
        patch.follow_up_details = result.follow_up_details
      }
    }

    await supabase.from('engagements').update(patch).eq('id', engagementId)

    const summary = typeof result.summary === 'string' ? result.summary : undefined
    if (summary) {
      await supabase.from('briefing_notes').insert({ engagement_id: engagementId, body: summary, resolved: false })
    }

    return { patch, summary }
  } catch (err) {
    console.error('scanEngagement error:', err)
    return { patch: {} }
  }
}
