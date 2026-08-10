import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'

// POST is reachable from the browser bundle, so it validates hard and rate
// limits. The table itself is default-deny RLS: only this route can write it.

const MAX_BODY_BYTES = 64_000
const RATE_LIMIT_PER_MINUTE = 30

const buckets = new Map<string, { count: number; resetAt: number }>()

/**
 * Per-client rate limit. Keyed on the LAST x-forwarded-for entry, which the
 * proxy appends and a caller cannot forge by sending their own header.
 */
function rateLimited(req: Request): boolean {
  const forwarded = req.headers.get('x-forwarded-for') ?? ''
  const parts = forwarded.split(',').map(s => s.trim()).filter(Boolean)
  const key = parts.length ? parts[parts.length - 1] : 'unknown'

  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 })
    return false
  }
  bucket.count += 1
  return bucket.count > RATE_LIMIT_PER_MINUTE
}

const breadcrumbSchema = z.object({ at: z.string(), label: z.string().max(300) })

const reportSchema = z.object({
  kind: z.enum(['render', 'promise', 'window', 'api', 'server', 'user_report']),
  severity: z.enum(['error', 'warning']).default('error'),
  message: z.string().min(1).max(2000),
  stack: z.string().max(8000).nullish(),
  fingerprint: z.string().min(1).max(500),
  url: z.string().max(1000).nullish(),
  route: z.string().max(500).nullish(),
  action: z.string().max(300).nullish(),
  method: z.string().max(10).nullish(),
  http_status: z.number().int().nullish(),
  user_label: z.string().max(120).nullish(),
  session_id: z.string().max(120).nullish(),
  user_agent: z.string().max(500).nullish(),
  context: z.record(z.string(), z.unknown()).nullish(),
  breadcrumbs: z.array(breadcrumbSchema).max(50).nullish(),
  user_note: z.string().max(5000).nullish(),
})

export async function POST(req: Request) {
  if (rateLimited(req)) {
    return NextResponse.json({ error: 'Too many reports' }, { status: 429 })
  }

  const raw = await req.text()
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Report too large' }, { status: 413 })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = reportSchema.safeParse(parsed)
  if (!result.success) {
    return NextResponse.json({ error: 'Invalid report' }, { status: 400 })
  }

  const { error } = await supabaseAdmin().from('error_reports').insert(result.data)
  if (error) {
    // Unconditional: a reporting pipeline that swallows its own failure is
    // exactly the outage-looks-like-silence problem this feature exists to fix.
    console.error('[api/errors] insert failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const includeResolved = url.searchParams.get('resolved') === 'true'
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 200) || 200, 500)

  let query = supabaseAdmin()
    .from('error_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!includeResolved) query = query.is('resolved_at', null)

  const { data, error } = await query
  if (error) {
    console.error('[api/errors] list failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
}

const triageSchema = z
  .object({
    id: z.string().uuid().optional(),
    fingerprint: z.string().min(1).max(500).optional(),
    resolved: z.boolean(),
    note: z.string().max(1000).nullish(),
  })
  .refine(v => Boolean(v.id) !== Boolean(v.fingerprint), {
    message: 'Provide exactly one of id or fingerprint',
  })

/** Mark one report, or a whole fingerprint group, resolved or unresolved. */
export async function PATCH(req: Request) {
  const result = triageSchema.safeParse(await req.json().catch(() => null))
  if (!result.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const { id, fingerprint: fp, resolved, note } = result.data

  const patch = {
    resolved_at: resolved ? new Date().toISOString() : null,
    resolved_note: resolved ? note ?? null : null,
  }

  const table = supabaseAdmin().from('error_reports').update(patch)
  const { error } = id ? await table.eq('id', id) : await table.eq('fingerprint', fp!)

  if (error) {
    console.error('[api/errors] triage failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
