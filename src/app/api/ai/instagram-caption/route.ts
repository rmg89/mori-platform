import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  const { image_description, topic_prompt, tone } = await req.json()

  const toneGuide: Record<string, string> = {
    professional: 'polished, authoritative, expert — appropriate for a business audience',
    inspiring: 'motivational, uplifting, thought-provoking — designed to resonate and inspire action',
    conversational: 'warm, approachable, personal — like talking directly to a follower',
    bold: 'direct, powerful, confident — short punchy sentences, strong statements',
  }

  const toneDesc = toneGuide[tone] ?? toneGuide.inspiring

  const systemPrompt = `You are a social media strategist for Mori Taheripour — a Wharton professor, author, keynote speaker, and negotiation expert. She has a warm but authoritative public presence.

Your job is to write Instagram captions that feel authentic to her voice. Her audience includes corporate professionals, executives, students, and people interested in negotiation, leadership, and self-advocacy.

Guidelines:
- Write exactly 3 caption options, clearly labeled Option 1, Option 2, Option 3
- Each caption should feel distinct — vary length, opening hook, structure
- Include 5-8 relevant hashtags at the end of each caption
- Never use generic or cringe phrases like "Excited to share!", "So grateful!", "Humbled and honored"
- Emojis are fine but use sparingly — 1-2 max per caption
- Tone: ${toneDesc}
- Return only the three captions, no preamble or explanation`

  const userMessage = `Photo context: ${image_description || 'No photo description provided'}

Topic / direction: ${topic_prompt || 'General professional content'}

Write 3 Instagram caption options for Mori.`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1200,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''

    // Parse the three options
    const raw = text.split(/Option\s+[123][:\.\s]/i).filter(Boolean).map(s => s.trim())

    return NextResponse.json({ captions: raw.length >= 3 ? raw.slice(0, 3) : [text] })
  } catch (err: any) {
    console.error('Caption generation error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
