'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Mori Platform — shared browser → /api fetch wrapper
//
// db-client, invoices-client, contracts-client and contract-templates-client
// each had their own identical copy of this. One copy means a failure is
// reported the same way no matter which data layer hit it.
// ─────────────────────────────────────────────────────────────────────────────

import { captureError } from '@/lib/error-reporting'

export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? 'GET'

  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
  } catch (err) {
    // Never reached the server, so only the browser can report it: offline,
    // DNS, a connection dropped mid-save.
    const message = err instanceof Error ? err.message : 'Network request failed'
    captureError({ kind: 'api', message, action: `${method} ${url}`, method })
    throw err
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const message = body.error ?? `${url}: ${res.status}`
    captureError({ kind: 'api', message, action: `${method} ${url}`, method, httpStatus: res.status })
    throw new Error(message)
  }

  return res.json()
}
