import { NextRequest, NextResponse } from 'next/server'
import { anthropic, AI_MODEL, callAI } from '@/lib/ai-client'

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

  const system = `You research organizations for a speaker-booking CRM. Given an organization name, use web search to find its real official website and industry/sector.

Only report information you actually found via search. Never guess, estimate, or infer a website/industry from the name alone — if you can't confidently confirm it via search results, return null for that field.

Respond with ONLY a JSON object (no markdown fences) in this exact shape:
{
  "website": "https://example.com" or null,
  "industry": "Hospitality" or null
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

    return NextResponse.json({
      website: typeof result?.website === 'string' ? result.website : null,
      industry: typeof result?.industry === 'string' ? result.industry : null,
    })
  } catch (err: any) {
    console.error('enrich-company error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
