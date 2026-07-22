// ─────────────────────────────────────────────────────────────────────────────
// Mori Platform — pure contract snapshot helpers (no DB access)
// Safe to import from client components; contracts.ts (server-only) doesn't need these.
// ─────────────────────────────────────────────────────────────────────────────

import type { Contract, ContractSnapshot, Engagement } from '@/types'
import { primaryContact as pc } from '@/types'

export function buildContractSnapshot(client: Engagement): ContractSnapshot {
  const c = pc(client)
  return {
    organization: client.organization,
    event_name: client.event_name,
    topic: client.topic,
    event_date: client.event_date,
    event_time: client.event_time,
    event_city: client.event_city,
    event_location: client.event_location,
    event_format: client.event_format,
    estimated_attendees: client.audience_size,
    attendee_location: client.event_city,
    fee: client.fee,
    deposit_amount: client.deposit_amount,
    travel_fee: 'TBD',
    run_of_show: client.run_of_show,
    contact_first_name: c?.first_name,
    contact_last_name: c?.last_name,
    contact_title: c?.title,
    contact_email: c?.email,
    contact_phone: c?.phone,
  }
}

// Rebuilds a minimal engagement-shaped object from a stored snapshot, for
// feeding back into generateContract when re-downloading from the list page.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function snapshotToClient(contract: Contract): any {
  const s = contract.snapshot
  return {
    id: contract.id,
    organization: s.organization,
    event_name: s.event_name,
    topic: s.topic,
    event_date: s.event_date,
    event_time: s.event_time,
    event_city: s.event_city,
    event_location: s.event_location,
    event_format: s.event_format,
    audience_size: s.estimated_attendees,
    fee: s.fee,
    deposit_amount: s.deposit_amount,
    run_of_show: s.run_of_show,
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
    // contract-only fields carried alongside the Engagement shape
    tech_platform: s.tech_platform,
    attendee_location: s.attendee_location,
    project_scope: s.project_scope,
    travel_fee: s.travel_fee,
  }
}
