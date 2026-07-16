"use client"

// ─────────────────────────────────────────────────────────────────────────────
// Mori Platform — client-side data layer
// Same function names/signatures as db.ts (now server-only); each body calls
// the matching API route instead of Supabase directly.
// ─────────────────────────────────────────────────────────────────────────────

import type { Engagement, EngagementContact, Company } from '@/types'

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `${url}: ${res.status}`)
  }
  return res.json()
}

export async function fetchAllEngagements(): Promise<Engagement[]> {
  return req('/api/engagements')
}

export async function updateEngagementRow(id: string, patch: Record<string, unknown>): Promise<void> {
  await req(`/api/engagements/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

export async function deleteEngagementRow(id: string): Promise<void> {
  await req(`/api/engagements/${id}`, { method: 'DELETE' })
}

export async function insertEngagementRow(input: Record<string, unknown>): Promise<Engagement> {
  return req('/api/engagements', { method: 'POST', body: JSON.stringify(input) })
}

export async function insertContact(engagement_id: string | null, contact: Record<string, unknown>): Promise<string | null> {
  try {
    const { id } = await req<{ id: string }>('/api/contacts', {
      method: 'POST',
      body: JSON.stringify({ engagement_id, ...contact }),
    })
    return id
  } catch (err) {
    console.error('insertContact:', err)
    return null
  }
}

export async function upsertContact(contact: Record<string, unknown> & { id?: string; engagement_id: string | null }): Promise<void> {
  // Only upsert if the id looks like a real UUID (not a temp id from the UI)
  if (!contact.id || /^(new_|lnk_)/.test(contact.id)) return
  await req(`/api/contacts/${contact.id}`, { method: 'PUT', body: JSON.stringify(contact) })
}

export async function fetchUnassignedContacts(): Promise<EngagementContact[]> {
  return req('/api/contacts?unassigned=true')
}

export async function deleteContactRow(id: string): Promise<void> {
  await req(`/api/contacts/${id}`, { method: 'DELETE' })
}

export async function fetchCompanies(): Promise<Company[]> {
  try {
    return await req('/api/companies')
  } catch (err) {
    console.warn('fetchCompanies:', err)
    return []
  }
}

export async function updateCompanyRow(id: string, patch: Record<string, unknown>): Promise<void> {
  await req(`/api/companies/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

export async function deleteCompanyRow(id: string): Promise<void> {
  await req(`/api/companies/${id}`, { method: 'DELETE' })
}

export async function insertCompanyRow(input: { name: string; website?: string; industry?: string }): Promise<Company> {
  return req('/api/companies', { method: 'POST', body: JSON.stringify(input) })
}

export async function insertComm(comm: Record<string, unknown>): Promise<void> {
  await req('/api/communications', { method: 'POST', body: JSON.stringify(comm) })
}

export async function updateCommRow(id: string, patch: Record<string, unknown>): Promise<void> {
  await req(`/api/communications/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

export async function upsertCall(call: Record<string, unknown> & { engagement_id: string }): Promise<void> {
  await req('/api/calls', { method: 'PUT', body: JSON.stringify(call) })
}
