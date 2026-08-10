import { NextRequest, NextResponse } from 'next/server'
import { anthropic, AI_MODEL, callAI } from '@/lib/ai-client'
import { serverError, logServerError } from '@/lib/error-log'

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

// Basic web_search tool (works across model tiers incl. Haiku) — predates this SDK
// version's tool types, so the shape is cast rather than typed.
const WEB_SEARCH_TOOL = { type: 'web_search_20250305', name: 'web_search' } as const

export async function POST(req: NextRequest) {
  const { name } = await req.json()
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const system = `You research organizations for a speaker-booking CRM. Given an organization name, use web search to find its real official website.

Only report a website you actually found via search. Never guess, estimate, or infer it from the name alone — if you can't confidently confirm it via search results, return null.

Respond with ONLY a JSON object (no markdown fences) in this exact shape:
{
  "website": "https://example.com" or null
}`

  try {
    const message = await callAI(() => anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 1500,
      system,
      messages: [{ role: 'user', content: `Organization name: ${name}` }],
      tools: [WEB_SEARCH_TOOL] as never,
    }))

    const textBlock = message.content.find(b => b.type === 'text')
    const text = textBlock && textBlock.type === 'text' ? textBlock.text : ''
    const result = parseJson(text)
    if (!result) {
      // A null website reads to the user as "no website found" rather than
      // "the lookup broke", so the failure has to be recorded here.
      await logServerError({
        message: 'enrich-company: AI returned output that could not be parsed as JSON — reported as no website found',
        route: '/api/ai/enrich-company',
        action: 'enrich company',
        severity: 'warning',
        context: { model: AI_MODEL, response: text.slice(0, 1000) },
      })
    }

    return NextResponse.json({
      website: typeof result?.website === 'string' ? result.website : null,
    })
  } catch (err) {
    return serverError(err, req)
  }
}
