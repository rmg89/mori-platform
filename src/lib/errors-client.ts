'use client'

import type { ErrorReport } from '@/types'

export async function fetchErrorReports(includeResolved = false): Promise<ErrorReport[]> {
  const res = await fetch(`/api/errors?resolved=${includeResolved}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to load error reports (${res.status})`)
  return res.json()
}

export async function setErrorResolved(
  target: { id: string } | { fingerprint: string },
  resolved: boolean,
  note?: string,
): Promise<void> {
  const res = await fetch('/api/errors', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...target, resolved, note }),
  })
  if (!res.ok) throw new Error(`Failed to update error report (${res.status})`)
}
