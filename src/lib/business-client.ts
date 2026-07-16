"use client"

// ─────────────────────────────────────────────────────────────────────────────
// Mori Platform — client-side business profile access
// Same function names/signatures as business.ts (now server-only).
// ─────────────────────────────────────────────────────────────────────────────

import type { BusinessProfile } from '@/types'

const FALLBACK: BusinessProfile = {
  name: 'MT Global Strategies',
  address: '2425 L Street, NW, #409, Washington, DC',
  phone: '510-385-7917',
  fax: '202-223-1655',
}

export async function fetchBusinessProfile(): Promise<BusinessProfile> {
  try {
    const res = await fetch('/api/business-profile')
    if (!res.ok) return FALLBACK
    return await res.json()
  } catch {
    return FALLBACK
  }
}

export async function updateBusinessProfile(patch: Partial<BusinessProfile>): Promise<void> {
  const res = await fetch('/api/business-profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `updateBusinessProfile: ${res.status}`)
  }
}
