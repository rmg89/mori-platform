"use client"

// ─────────────────────────────────────────────────────────────────────────────
// Mori Platform — client-side invoices access
// Same function names/signatures as invoices.ts (now server-only); pure
// snapshot helpers are re-exported from invoice-utils.ts for convenience.
// ─────────────────────────────────────────────────────────────────────────────

import type { Invoice, InvoiceKind, InvoiceSnapshot, InvoiceStatus } from '@/types'

export { buildInvoiceSnapshot, snapshotToClient } from '@/lib/invoice-utils'

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

export async function createInvoice(input: {
  engagementId?: string
  type: InvoiceKind
  organization: string
  amount: number
  dueAt?: string
  snapshot: InvoiceSnapshot
}): Promise<Invoice> {
  return req('/api/invoices', { method: 'POST', body: JSON.stringify(input) })
}

export async function fetchInvoices(opts: {
  status?: InvoiceStatus
  type?: InvoiceKind
  offset: number
  limit: number
}): Promise<{ rows: Invoice[]; count: number }> {
  const params = new URLSearchParams()
  if (opts.status) params.set('status', opts.status)
  if (opts.type) params.set('type', opts.type)
  params.set('offset', String(opts.offset))
  params.set('limit', String(opts.limit))
  return req(`/api/invoices?${params}`)
}

export async function setInvoiceStatus(invoice: Invoice, status: InvoiceStatus): Promise<void> {
  await req(`/api/invoices/${invoice.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
}

// Convenience wrapper — marks an invoice reviewed/ready-to-send.
export function finalizeInvoice(invoice: Invoice): Promise<void> {
  return setInvoiceStatus(invoice, 'finalized')
}

export async function findLatestInvoice(engagementId: string, type: InvoiceKind): Promise<Invoice | null> {
  const params = new URLSearchParams({ engagement_id: engagementId, type })
  return req(`/api/invoices/latest?${params}`)
}

export async function ensureDraftInvoice(input: {
  engagementId: string
  type: InvoiceKind
  organization: string
  amount: number
  dueAt?: string
  snapshot: InvoiceSnapshot
}): Promise<Invoice> {
  return req('/api/invoices/ensure-draft', { method: 'POST', body: JSON.stringify(input) })
}

export async function updateInvoiceSnapshot(invoice: Invoice, patch: Partial<InvoiceSnapshot>): Promise<Invoice> {
  return req(`/api/invoices/${invoice.id}/snapshot`, { method: 'PATCH', body: JSON.stringify(patch) })
}
