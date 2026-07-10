"use client"

// ─────────────────────────────────────────────────────────────────────────────
// Mori Platform — Invoices data layer
// Persists generated invoices (sequential numbering via the create_invoice RPC)
// and keeps their status in sync with the existing per-engagement payment fields.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from '@/lib/supabase'
import type { Engagement, Invoice, InvoiceKind, InvoiceSnapshot, InvoiceStatus } from '@/types'
import { primaryContact as pc } from '@/types'

export async function createInvoice(input: {
  engagementId?: string
  type: InvoiceKind
  organization: string
  amount: number
  dueAt?: string
  snapshot: InvoiceSnapshot
}): Promise<Invoice> {
  const { data, error } = await supabase.rpc('create_invoice', {
    p_engagement_id: input.engagementId ?? null,
    p_type: input.type,
    p_organization: input.organization,
    p_amount: input.amount,
    p_due_at: input.dueAt ?? null,
    p_snapshot: input.snapshot,
  })
  if (error) throw new Error(`createInvoice: ${error.message}`)
  return data as Invoice
}

export async function fetchInvoices(opts: {
  status?: InvoiceStatus
  type?: InvoiceKind
  offset: number
  limit: number
}): Promise<{ rows: Invoice[]; count: number }> {
  let query = supabase
    .from('invoices')
    .select('*', { count: 'exact' })
    .order('sequence_number', { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1)

  if (opts.status) query = query.eq('status', opts.status)
  if (opts.type) query = query.eq('type', opts.type)

  const { data, error, count } = await query
  if (error) throw new Error(`fetchInvoices: ${error.message}`)
  return { rows: (data ?? []) as Invoice[], count: count ?? 0 }
}

// Updates the invoice row and, if it's linked to an engagement, best-effort
// mirrors the status onto the existing field that the wrap-up / deposit-card
// UI already reads — so both surfaces agree without either owning the other.
export async function setInvoiceStatus(invoice: Invoice, status: InvoiceStatus): Promise<void> {
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = { status }
  if (status === 'finalized') patch.finalized_at = now
  if (status === 'sent') patch.sent_at = now
  if (status === 'paid') patch.paid_at = now

  const { error } = await supabase.from('invoices').update(patch).eq('id', invoice.id)
  if (error) throw new Error(`setInvoiceStatus: ${error.message}`)

  if (!invoice.engagement_id) return

  const engagementPatch: Record<string, unknown> =
    invoice.type === 'deposit'
      ? status === 'finalized' ? { deposit_finalized_at: now }
        : status === 'sent' ? { deposit_invoice_sent_at: now }
        : status === 'paid' ? { deposit_received_at: now }
        : {}
      : status === 'finalized' ? { invoice_finalized_at: now }
        : status === 'sent' ? { invoice_sent_at: now }
        : status === 'paid' ? { payment_received_at: now }
        : {}

  if (Object.keys(engagementPatch).length === 0) return
  await supabase.from('engagements').update(engagementPatch).eq('id', invoice.engagement_id)
}

// Convenience wrapper — marks an invoice reviewed/ready-to-send.
export function finalizeInvoice(invoice: Invoice): Promise<void> {
  return setInvoiceStatus(invoice, 'finalized')
}

// Finds the most recent invoice row for an engagement + type (used when the
// existing wrap-up/deposit-card controls change status, to mirror it back).
export async function findLatestInvoice(engagementId: string, type: InvoiceKind): Promise<Invoice | null> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('engagement_id', engagementId)
    .eq('type', type)
    .order('sequence_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`findLatestInvoice: ${error.message}`)
  return data as Invoice | null
}

// Idempotent auto-draft — called the moment an invoice/deposit is flagged as
// needed. Reuses whatever's already in flight (draft/finalized/sent) for that
// engagement + type; only starts a new one if none exists yet or the last one
// already closed out (paid), e.g. a repeat deposit on the same engagement.
export async function ensureDraftInvoice(input: {
  engagementId: string
  type: InvoiceKind
  organization: string
  amount: number
  dueAt?: string
  snapshot: InvoiceSnapshot
}): Promise<Invoice> {
  const existing = await findLatestInvoice(input.engagementId, input.type)
  if (existing && existing.status !== 'paid') return existing
  return createInvoice(input)
}

// Merges field edits into an invoice's snapshot (and keeps the denormalized
// organization/amount columns used by the Invoices list in sync).
export async function updateInvoiceSnapshot(invoice: Invoice, patch: Partial<InvoiceSnapshot>): Promise<Invoice> {
  const snapshot = { ...invoice.snapshot, ...patch }
  const amount = invoice.type === 'deposit' ? snapshot.deposit_amount ?? invoice.amount : snapshot.fee ?? invoice.amount
  const { data, error } = await supabase
    .from('invoices')
    .update({ snapshot, organization: snapshot.organization, amount })
    .eq('id', invoice.id)
    .select('*')
    .single()
  if (error) throw new Error(`updateInvoiceSnapshot: ${error.message}`)
  return data as Invoice
}

export function buildInvoiceSnapshot(client: Engagement): InvoiceSnapshot {
  const c = pc(client)
  return {
    organization: client.organization,
    event_name: client.event_name,
    topic: client.topic,
    event_date: client.event_date,
    event_city: client.event_city,
    fee: client.fee,
    deposit_amount: client.deposit_amount,
    travel_covered: client.travel_covered,
    contact_first_name: c?.first_name,
    contact_last_name: c?.last_name,
    contact_title: c?.title,
    contact_email: c?.email,
    contact_phone: c?.phone,
  }
}

// Rebuilds a minimal engagement-shaped object from a stored snapshot, for
// feeding back into generateInvoice/generateDepositInvoice when re-downloading.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function snapshotToClient(inv: Invoice): any {
  const s = inv.snapshot
  return {
    id: inv.id,
    organization: s.organization,
    event_name: s.event_name,
    topic: s.topic,
    event_date: s.event_date,
    event_city: s.event_city,
    fee: s.fee,
    deposit_amount: s.deposit_amount,
    travel_covered: s.travel_covered,
    contacts: [{
      id: '1',
      first_name: s.contact_first_name ?? '',
      last_name: s.contact_last_name ?? '',
      title: s.contact_title,
      email: s.contact_email ?? '',
      phone: s.contact_phone,
      address: s.contact_address,
      is_current_point_of_contact: true,
      role: 'primary',
      status: 'client',
      watching: false,
    }],
  }
}
