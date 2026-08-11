"use client"

// ─────────────────────────────────────────────────────────────────────────────
// Mori Platform — client-side data layer
// Same function names/signatures as db.ts (now server-only); each body calls
// the matching API route instead of Supabase directly.
// ─────────────────────────────────────────────────────────────────────────────

import type { Engagement, EngagementContact, Company, ReviewItem } from '@/types'
import { apiRequest as req } from '@/lib/api-client'

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
  // Throws on failure, like every sibling write here. It used to log and return
  // null, which left each caller responsible for remembering a null check.
  const { id } = await req<{ id: string }>('/api/contacts', {
    method: 'POST',
    body: JSON.stringify({ engagement_id, ...contact }),
  })
  return id
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
  // Returning [] on failure rendered a dead backend as "you have no companies",
  // with a clean console and no way to tell the difference.
  return req('/api/companies')
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

export async function deleteCommRow(id: string): Promise<void> {
  await req(`/api/communications/${id}`, { method: 'DELETE' })
}

export async function fetchReviewItems(): Promise<ReviewItem[]> {
  return req('/api/review-items')
}

export async function updateReviewItemRow(id: string, patch: Record<string, unknown>): Promise<void> {
  await req(`/api/review-items/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

export async function fetchReviewItemExtracted(id: string): Promise<Record<string, unknown> | null> {
  return req(`/api/review-items/${id}/extracted`)
}

export async function upsertCall(call: Record<string, unknown> & { engagement_id: string }): Promise<void> {
  await req('/api/calls', { method: 'PUT', body: JSON.stringify(call) })
}

export async function insertBriefingNoteRow(note: Record<string, unknown>): Promise<void> {
  await req('/api/briefing-notes', { method: 'POST', body: JSON.stringify(note) })
}

export async function updateBriefingNoteRow(id: string, patch: Record<string, unknown>): Promise<void> {
  await req(`/api/briefing-notes/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

export async function deleteBriefingNoteRow(id: string): Promise<void> {
  await req(`/api/briefing-notes/${id}`, { method: 'DELETE' })
}
