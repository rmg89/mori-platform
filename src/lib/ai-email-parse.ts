import type { SupabaseClient } from '@supabase/supabase-js'
import { anthropic, AI_MODEL, callAI } from '@/lib/ai-client'

// Confidence at/above this, for a clear-cut action, lets the review page
// auto-bucket the item (New Prospects / Ignore) instead of surfacing it
// under "Needs a Decision".
const AUTO_SORT_CONFIDENCE = 0.75

export interface InboundEmail {
  from_name: string
  from_email: string
  subject: string
  body: string
  received_at?: string
  account?: string
}

export interface ParsedReviewItem {
  received_at: string
  from_name: string
  from_email: string
  subject: string
  body_preview: string
  body: string
  account: string | null
  ai_confidence: number | null
  state: 'ai_sorted' | 'needs_review'
  ai_suggested_action: 'create_prospect' | 'add_to_existing' | 'update_prospect' | 'ignore' | null
  ai_suggested_engagement_id: string | null
  ai_reasoning: string | null
  ai_extracted: Record<string, unknown> | null
}

function domainOf(email: string): string {
  return email.split('@')[1]?.toLowerCase().trim() ?? ''
}

function hostOf(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return url.replace(/^www\./, '').toLowerCase()
  }
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

async function findCandidateMatches(supabase: SupabaseClient, fromEmail: string) {
  const domain = domainOf(fromEmail)

  const [{ data: contactMatches }, { data: companies }] = await Promise.all([
    supabase.from('contacts').select('engagement_id,first_name,last_name,email,title').ilike('email', fromEmail),
    supabase.from('companies').select('id,name,website'),
  ])

  const companyMatch = domain
    ? (companies ?? []).find((c: { website?: string | null }) => c.website && hostOf(c.website) === domain)
    : undefined

  return {
    contactMatch: contactMatches?.[0] as { engagement_id: string; first_name: string; last_name: string | null; email: string } | undefined,
    companyMatch: companyMatch as { id: string; name: string } | undefined,
  }
}

function buildContext(email: InboundEmail, contactMatch?: { engagement_id: string; first_name: string; last_name: string | null }, companyMatch?: { id: string; name: string }): string {
  const lines: string[] = []
  lines.push(`From: ${email.from_name} <${email.from_email}>`)
  lines.push(`Subject: ${email.subject}`)
  lines.push('', 'Body:', email.body)

  lines.push('', 'Known-record lookups (already matched deterministically — trust these over guessing):')
  lines.push(contactMatch
    ? `- This email address is already a contact (${contactMatch.first_name} ${contactMatch.last_name ?? ''}) on an existing engagement (id: ${contactMatch.engagement_id}).`
    : '- No existing contact matches this email address.')
  lines.push(companyMatch
    ? `- The sender's domain matches an existing company: "${companyMatch.name}" (id: ${companyMatch.id}).`
    : '- The sender\'s domain does not match any existing company.')

  return lines.join('\n')
}

const SYSTEM_PROMPT = `You triage inbound email for a professional speaker's booking pipeline. Classify this email and decide what should happen to it.

Actions:
- "create_prospect": a new speaking inquiry from someone not already in the system.
- "add_to_existing": relates to a contact/engagement that already exists (see the lookups below) — e.g. a reply in an ongoing conversation.
- "update_prospect": provides new details (date, fee, logistics) for an existing engagement.
- "ignore": not a business inquiry — newsletter, spam, personal, unrelated.

Respond with ONLY a JSON object (no markdown fences) in this exact shape:
{
  "suggested_action": "create_prospect",
  "confidence": 0.9,
  "reasoning": "1-2 sentence explanation",
  "suggested_engagement_id": null,
  "extracted": {
    "organization": "Acme Corp",
    "event_type": "keynote",
    "topic": "negotiation",
    "event_city": "Chicago",
    "fee": null,
    "contact_first_name": "Jane",
    "contact_last_name": "Doe",
    "contact_title": "Director of Events"
  }
}

Set "suggested_engagement_id" to the matched engagement id from the lookups when the action is "add_to_existing" or "update_prospect", otherwise null. Omit any "extracted" field you can't confidently determine (use null) rather than guessing.`

/**
 * Parses one inbound email into a review_items row shape. Deterministic
 * contact/company matching happens first (cheap, no AI needed); the match
 * results are handed to Claude alongside the email so it isn't guessing at
 * something the database already knows. Fails gracefully (state:
 * 'needs_review', no AI fields) if the AI call errors — e.g. no
 * ANTHROPIC_API_KEY configured yet — so ingestion still records the email.
 */
export async function parseInboundEmail(supabase: SupabaseClient, email: InboundEmail): Promise<ParsedReviewItem> {
  const base: ParsedReviewItem = {
    received_at: email.received_at ?? new Date().toISOString(),
    from_name: email.from_name,
    from_email: email.from_email,
    subject: email.subject,
    body_preview: email.body.slice(0, 240),
    body: email.body,
    account: email.account ?? null,
    ai_confidence: null,
    state: 'needs_review',
    ai_suggested_action: null,
    ai_suggested_engagement_id: null,
    ai_reasoning: null,
    ai_extracted: null,
  }

  try {
    const { contactMatch, companyMatch } = await findCandidateMatches(supabase, email.from_email)
    const context = buildContext(email, contactMatch, companyMatch)

    const message = await callAI(() => anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: context }],
    }))

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const result = parseJson(text)
    if (!result) return base

    const action = result.suggested_action as ParsedReviewItem['ai_suggested_action']
    const confidence = typeof result.confidence === 'number' ? result.confidence : null
    const validAction = action && ['create_prospect', 'add_to_existing', 'update_prospect', 'ignore'].includes(action)

    return {
      ...base,
      ai_confidence: confidence,
      ai_suggested_action: validAction ? action : null,
      ai_suggested_engagement_id: (typeof result.suggested_engagement_id === 'string' ? result.suggested_engagement_id : null) ?? contactMatch?.engagement_id ?? null,
      ai_reasoning: typeof result.reasoning === 'string' ? result.reasoning : null,
      ai_extracted: (result.extracted as Record<string, unknown>) ?? null,
      state: validAction && (action === 'create_prospect' || action === 'ignore') && confidence !== null && confidence >= AUTO_SORT_CONFIDENCE
        ? 'ai_sorted'
        : 'needs_review',
    }
  } catch (err) {
    console.error('parseInboundEmail error:', err)
    return base
  }
}
