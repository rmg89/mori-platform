"use client"

// ─────────────────────────────────────────────────────────────────────────────
// Mori Platform — client-side business profile access
// Same function names/signatures as business.ts (now server-only).
// ─────────────────────────────────────────────────────────────────────────────

import type { BusinessProfile } from '@/types'
import { apiRequest } from '@/lib/api-client'
import { captureError } from '@/lib/error-reporting'

const FALLBACK: BusinessProfile = {
  name: 'MT Global Strategies',
  address: '2425 L Street, NW, #409, Washington, DC',
  phone: '510-385-7917',
  fax: '202-223-1655',
}

export async function fetchBusinessProfile(): Promise<BusinessProfile> {
  try {
    const res = await fetch('/api/business-profile')
    if (!res.ok) {
      // Falling back to hardcoded details still renders a working page, which
      // is precisely why this needs reporting: the user sees stale letterhead
      // on a contract and has no way to tell the lookup failed.
      captureError({
        kind: 'api',
        severity: 'warning',
        message: `Business profile lookup failed (${res.status}) — showing hardcoded fallback`,
        action: 'GET /api/business-profile',
        method: 'GET',
        httpStatus: res.status,
      })
      return FALLBACK
    }
    return await res.json()
  } catch (err) {
    captureError({
      kind: 'api',
      severity: 'warning',
      message: `Business profile lookup failed (${err instanceof Error ? err.message : 'network error'}) — showing hardcoded fallback`,
      action: 'GET /api/business-profile',
      method: 'GET',
    })
    return FALLBACK
  }
}

export async function updateBusinessProfile(patch: Partial<BusinessProfile>): Promise<void> {
  await apiRequest('/api/business-profile', { method: 'PUT', body: JSON.stringify(patch) })
}
