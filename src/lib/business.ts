"use client"

// ─────────────────────────────────────────────────────────────────────────────
// Mori Platform — Business profile (invoice letterhead: name/address/phone/fax)
// Single-row table, id fixed at 1.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from '@/lib/supabase'
import type { BusinessProfile } from '@/types'

const FALLBACK: BusinessProfile = {
  name: 'MT Global Strategies',
  address: '2425 L Street, NW, #409, Washington, DC',
  phone: '510-385-7917',
  fax: '202-223-1655',
}

export async function fetchBusinessProfile(): Promise<BusinessProfile> {
  const { data, error } = await supabase.from('business_profile').select('*').eq('id', 1).maybeSingle()
  if (error || !data) return FALLBACK
  return {
    name: data.name ?? FALLBACK.name,
    address: data.address ?? undefined,
    phone: data.phone ?? undefined,
    fax: data.fax ?? undefined,
  }
}

export async function updateBusinessProfile(patch: Partial<BusinessProfile>): Promise<void> {
  const { error } = await supabase.from('business_profile').upsert({ id: 1, ...patch, updated_at: new Date().toISOString() })
  if (error) throw new Error(`updateBusinessProfile: ${error.message}`)
}
