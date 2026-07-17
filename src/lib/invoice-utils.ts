// ─────────────────────────────────────────────────────────────────────────────
// Mori Platform — pure invoice snapshot helpers (no DB access)
// Safe to import from client components; invoices.ts (server-only) uses these too.
// ─────────────────────────────────────────────────────────────────────────────

import type { Engagement, Invoice, InvoiceSnapshot } from '@/types'
import { primaryContact as pc } from '@/types'

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
