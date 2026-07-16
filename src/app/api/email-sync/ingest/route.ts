import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { parseInboundEmail, InboundEmail } from '@/lib/ai-email-parse'

// Gate every request behind EMAIL_INGEST_SECRET_TOKEN (sent as "Authorization: Bearer <token>"),
// same pattern as the MCP endpoint (src/app/api/[transport]/route.ts) — this is the seam a
// Microsoft Graph webhook will call once live sync is wired up, so it must not be open to anyone
// who finds the URL. Fails closed if the token isn't configured.
function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.EMAIL_INGEST_SECRET_TOKEN
  if (!expected) return false

  const provided = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  const supabase = supabaseAdmin()
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body.from_email !== 'string' || typeof body.subject !== 'string' || typeof body.body !== 'string') {
    return NextResponse.json({ error: 'Required: from_email, subject, body (strings)' }, { status: 400 })
  }

  const email: InboundEmail = {
    from_name: typeof body.from_name === 'string' ? body.from_name : body.from_email,
    from_email: body.from_email,
    subject: body.subject,
    body: body.body,
    received_at: typeof body.received_at === 'string' ? body.received_at : undefined,
    account: typeof body.account === 'string' ? body.account : undefined,
  }

  try {
    const parsed = await parseInboundEmail(supabase, email)
    const { data, error } = await supabase.from('review_items').insert(parsed).select('*').single()
    if (error) throw new Error(error.message)
    return NextResponse.json(data)
  } catch (err: unknown) {
    console.error('email-sync/ingest error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Ingest failed' }, { status: 500 })
  }
}
