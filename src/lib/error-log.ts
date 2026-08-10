// ─────────────────────────────────────────────────────────────────────────────
// Mori Platform — server-side error capture
//
// Server counterpart to error-reporting.ts. Route handlers wrap themselves in
// `withErrorLogging` so a thrown exception is recorded with its route, method
// and stack before the 500 goes back to the browser.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fingerprint } from '@/lib/fingerprint'

// Next.js signals redirect(), notFound() and "this route must be dynamic" by
// throwing. Those are control flow, not failures: recording them fills the
// error list with noise (a `npm run build` alone logged one per dynamic route)
// and swallowing them breaks the behaviour they were thrown to trigger.
const CONTROL_FLOW_DIGESTS = ['NEXT_REDIRECT', 'NEXT_NOT_FOUND', 'DYNAMIC_SERVER_USAGE']

export function isFrameworkControlFlow(err: unknown): boolean {
  const digest = (err as { digest?: unknown } | null)?.digest
  if (typeof digest === 'string' && CONTROL_FLOW_DIGESTS.some(d => digest.startsWith(d))) return true
  return err instanceof Error && err.message.startsWith('Dynamic server usage:')
}

export interface ServerErrorInput {
  message: string
  stack?: string
  route?: string
  method?: string
  action?: string
  httpStatus?: number
  severity?: 'error' | 'warning'
  context?: Record<string, unknown>
}

// A failure on a hot read path (the dashboard refetches on every load) would
// otherwise write thousands of identical rows. One per fingerprint per minute
// per instance is enough to see the problem and its recency.
const THROTTLE_MS = 60_000
const lastLogged = new Map<string, number>()

/** Write one server-side error row. Never throws — logging can't break a route. */
export async function logServerError(input: ServerErrorInput): Promise<void> {
  try {
    const route = input.route ?? 'unknown'
    const fp = fingerprint('server', input.message, route)

    const now = Date.now()
    const previous = lastLogged.get(fp)
    if (previous && now - previous < THROTTLE_MS) return
    lastLogged.set(fp, now)

    await supabaseAdmin()
      .from('error_reports')
      .insert({
        kind: 'server',
        severity: input.severity ?? 'error',
        message: input.message.slice(0, 2000),
        stack: input.stack?.slice(0, 8000) ?? null,
        fingerprint: fp,
        route,
        method: input.method ?? null,
        action: input.action ?? null,
        http_status: input.httpStatus ?? 500,
        context: input.context ?? null,
      })
  } catch (err) {
    // Last resort: the platform log. Deliberately unconditional — a swallowed
    // logging failure is how an outage turns into "no data".
    console.error('[logServerError] failed to record error:', err, '| original:', input.message)
  }
}

/**
 * Records a route failure and returns the 500 the route was going to return
 * anyway. Drop-in for `return NextResponse.json({ error: err.message }, { status: 500 })`.
 *
 * Awaited rather than fire-and-forget: a serverless function can be frozen the
 * moment it returns a response, which would drop an un-awaited insert.
 */
export async function serverError(err: unknown, req: Request, action?: string): Promise<NextResponse> {
  if (isFrameworkControlFlow(err)) throw err
  const error = err instanceof Error ? err : new Error(String(err))
  let route = action ?? 'unknown'
  try {
    route = new URL(req.url).pathname
  } catch {
    /* keep the fallback */
  }
  await logServerError({
    message: error.message,
    stack: error.stack,
    route,
    method: req.method,
    action,
  })
  return NextResponse.json({ error: error.message }, { status: 500 })
}

type RouteHandler<R extends Request, A extends unknown[]> = (req: R, ...args: A) => Promise<Response> | Response

/**
 * Wraps a route handler so any thrown error is recorded and turned into a 500
 * with a stable shape — including errors thrown before the handler's own
 * try block, such as a malformed `await req.json()`. `action` labels the route
 * in the error list.
 */
export function withErrorLogging<R extends Request, A extends unknown[]>(
  action: string,
  handler: RouteHandler<R, A>,
): RouteHandler<R, A> {
  return async (req: R, ...args: A) => {
    try {
      return await handler(req, ...args)
    } catch (err) {
      if (isFrameworkControlFlow(err)) throw err
      const error = err instanceof Error ? err : new Error(String(err))
      let route = action
      try {
        route = new URL(req.url).pathname
      } catch {
        /* keep the action label */
      }
      await logServerError({
        message: error.message,
        stack: error.stack,
        route,
        method: req.method,
        action,
      })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }
}
