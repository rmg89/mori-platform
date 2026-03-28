import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  const { thread_subject, contact_name, contact_org, last_message } = await req.json()

  const systemPrompt = `You are drafting a professional email reply on behalf of Mori Taheripour's team (team@moritaheripour.com). Mori is a Wharton professor, bestselling author, and keynote speaker specializing in negotiation.

Tone: warm but professional, efficient, clear. Never sycophantic. The reply should feel like it came from a well-run, high-caliber office.

Guidelines:
- Keep replies concise — most replies should be 3-6 sentences
- Use proper salutation (Dear [Name] or Hi [Name] depending on context)
- Sign off as "Mori's Team" unless context suggests otherwise
- Never fabricate specific dates, fees, or commitments — leave those as [TBD] or ask the sender to confirm
- Match the formality of the incoming message`

  const userMessage = `Thread subject: ${thread_subject}
Contact: ${contact_name} at ${contact_org || 'their organization'}

Their message:
${last_message}

Draft a reply.`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const reply = message.content[0].type === 'text' ? message.content[0].text : ''
    return NextResponse.json({ reply })
  } catch (err: any) {
    console.error('Email reply error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
