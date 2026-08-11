'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Mori Platform — client-side error capture
//
// Records anything that goes wrong in the browser (render crashes, unhandled
// rejections, failed API calls) and posts it to /api/errors. The point is that
// a user hitting a problem produces a full report without having to notice,
// remember, or describe it.
//
// Everything here fails silently on purpose: the reporter must never be the
// reason a page breaks.
// ─────────────────────────────────────────────────────────────────────────────

import type { ErrorKind } from '@/types'
import { fingerprint } from '@/lib/fingerprint'

const SESSION_KEY = 'mori.error.session'
const LABEL_KEY = 'mori.error.userLabel'
const MAX_BREADCRUMBS = 25
const MAX_RECENT = 10
const DEDUPE_MS = 10_000
const MAX_TRACKED = 500

export interface Breadcrumb {
  at: string
  label: string
}

export interface CaptureInput {
  kind: ErrorKind
  message: string
  stack?: string
  severity?: 'error' | 'warning'
  action?: string
  method?: string
  httpStatus?: number
  context?: Record<string, unknown>
  userNote?: string
}

export interface RecentError extends CaptureInput {
  at: string
  route: string
}

let installed = false
const breadcrumbs: Breadcrumb[] = []
const recent: RecentError[] = []
const lastSent = new Map<string, number>()

// ── identity (no auth on this app, so this is self-reported + a stable id) ────

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* private mode / storage disabled — reports just lose this field */
  }
}

export function getSessionId(): string {
  if (typeof window === 'undefined') return 'server'
  let id = readStorage(SESSION_KEY)
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `s_${Date.now()}`
    writeStorage(SESSION_KEY, id)
  }
  return id
}

export function getUserLabel(): string {
  if (typeof window === 'undefined') return ''
  return readStorage(LABEL_KEY) ?? ''
}

export function setUserLabel(label: string) {
  writeStorage(LABEL_KEY, label.trim())
}

// ── breadcrumbs ──────────────────────────────────────────────────────────────

/** Record a user action so a later failure carries the steps that led to it. */
export function addBreadcrumb(label: string) {
  // Skip a repeat of the step already at the top. React re-invokes effects in
  // development, which otherwise logged every navigation twice and made the
  // trail read as though the user had clicked twice.
  if (breadcrumbs[breadcrumbs.length - 1]?.label === label) return
  breadcrumbs.push({ at: new Date().toISOString(), label })
  if (breadcrumbs.length > MAX_BREADCRUMBS) breadcrumbs.shift()
}

export function getRecentErrors(): RecentError[] {
  return [...recent]
}

// ── subscribers ──────────────────────────────────────────────────────────────

// Several pages handle a failed load with `.catch(err => console.error(...))`,
// which leaves the user staring at an empty table with no idea anything broke.
// Reporting it to the operator is only half the job: the person in front of the
// screen has to see it too, or they carry on believing the data is real.
type Listener = (error: RecentError) => void
const listeners = new Set<Listener>()

export function onErrorCaptured(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

// ── noise filter ─────────────────────────────────────────────────────────────

// Browser and framework chatter that says nothing about this app. Left
// unfiltered these drown the real reports, which is how an error list stops
// being read.
const IGNORED = [
  'ResizeObserver loop',            // benign layout notification, fires constantly
  'Script error.',                  // cross-origin script, no detail available
  'NEXT_REDIRECT',                  // control flow, not a failure
  'NEXT_NOT_FOUND',
  'Load failed',                    // Safari's wording for a cancelled fetch
  'The operation was aborted',      // navigating away mid-request
  'AbortError',
]

function isNoise(message: string): boolean {
  return IGNORED.some(pattern => message.includes(pattern))
}

// ── capture ──────────────────────────────────────────────────────────────────

/**
 * Send one error report. Deduped per fingerprint so a render loop can't post
 * hundreds of rows. Never throws.
 */
export function captureError(input: CaptureInput): void {
  if (typeof window === 'undefined') return

  // A user's own report is never noise, whatever words are in it.
  if (input.kind !== 'user_report' && isNoise(input.message)) return

  try {
    const route = window.location.pathname
    const fp = fingerprint(input.kind, input.message, route)

    const entry: RecentError = { ...input, at: new Date().toISOString(), route }
    recent.unshift(entry)
    if (recent.length > MAX_RECENT) recent.pop()

    // Tell the UI before the dedupe below, but never for the user's own report
    // (they already know) — they'd get a toast echoing their own words back.
    if (input.kind !== 'user_report') {
      listeners.forEach(listener => {
        try { listener(entry) } catch { /* a bad listener can't break capture */ }
      })
    }

    const now = Date.now()
    const previous = lastSent.get(fp)
    if (previous && now - previous < DEDUPE_MS) return

    // Bounded: a message carrying a changing value produces a new fingerprint
    // every time, and this tab may stay open all day.
    if (lastSent.size > MAX_TRACKED) {
      lastSent.forEach((t, k) => { if (now - t >= DEDUPE_MS) lastSent.delete(k) })
      if (lastSent.size > MAX_TRACKED) lastSent.clear()
    }
    lastSent.set(fp, now)

    const payload = {
      kind: input.kind,
      severity: input.severity ?? 'error',
      message: input.message.slice(0, 2000),
      stack: input.stack?.slice(0, 8000),
      fingerprint: fp,
      url: window.location.href.slice(0, 1000),
      route,
      action: input.action,
      method: input.method,
      http_status: input.httpStatus,
      user_label: getUserLabel() || null,
      session_id: getSessionId(),
      user_agent: navigator.userAgent.slice(0, 500),
      context: input.context ?? null,
      breadcrumbs: breadcrumbs.slice(-MAX_BREADCRUMBS),
      user_note: input.userNote ?? null,
    }

    void fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true, // survives a navigation or tab close mid-report
    }).catch(() => {
      /* nothing useful to do — the network is what failed */
    })
  } catch {
    /* reporting must never break the page */
  }
}

/** Post a user-written report, carrying whatever was captured automatically. */
export function submitUserReport(note: string, extra?: Record<string, unknown>): void {
  captureError({
    kind: 'user_report',
    severity: 'warning',
    message: note.slice(0, 200) || 'User reported a problem',
    userNote: note,
    context: { recentErrors: getRecentErrors(), ...extra },
  })
}

// ── global handlers ──────────────────────────────────────────────────────────

/** Installs window-level handlers once. Safe to call on every mount. */
export function installErrorReporting(): () => void {
  if (typeof window === 'undefined' || installed) return () => {}
  installed = true

  const onError = (event: ErrorEvent) => {
    captureError({
      kind: 'window',
      message: event.message || 'Unknown window error',
      stack: event.error?.stack,
      context: { filename: event.filename, line: event.lineno, column: event.colno },
    })
  }

  const onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason
    captureError({
      kind: 'promise',
      message:
        reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : 'Unhandled promise rejection',
      stack: reason instanceof Error ? reason.stack : undefined,
    })
  }

  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)

  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
    installed = false
  }
}
