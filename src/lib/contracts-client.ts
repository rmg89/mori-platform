"use client"

// ─────────────────────────────────────────────────────────────────────────────
// Mori Platform — client-side contracts access
// Same function names/signatures as contracts.ts (server-only); pure snapshot
// helpers are re-exported from contract-utils.ts for convenience.
// ─────────────────────────────────────────────────────────────────────────────

import type { Contract, ContractSnapshot, ContractStatus } from '@/types'

export { buildContractSnapshot, snapshotToClient } from '@/lib/contract-utils'

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

export async function createContract(input: {
  engagementId?: string
  organization: string
  amount: number
  snapshot: ContractSnapshot
}): Promise<Contract> {
  return req('/api/contracts', { method: 'POST', body: JSON.stringify(input) })
}

export async function fetchContracts(opts: {
  status?: ContractStatus
  search?: string
  offset: number
  limit: number
}): Promise<{ rows: Contract[]; count: number }> {
  const params = new URLSearchParams()
  if (opts.status) params.set('status', opts.status)
  if (opts.search) params.set('search', opts.search)
  params.set('offset', String(opts.offset))
  params.set('limit', String(opts.limit))
  return req(`/api/contracts?${params}`)
}

export async function setContractStatus(contract: Contract, status: ContractStatus): Promise<void> {
  await req(`/api/contracts/${contract.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
}

// Convenience wrapper — marks a contract reviewed/ready-to-send.
export function finalizeContract(contract: Contract): Promise<void> {
  return setContractStatus(contract, 'finalized')
}

export async function findLatestContract(engagementId: string): Promise<Contract | null> {
  const params = new URLSearchParams({ engagement_id: engagementId })
  return req(`/api/contracts/latest?${params}`)
}

export async function ensureDraftContract(input: {
  engagementId: string
  organization: string
  amount: number
  snapshot: ContractSnapshot
}): Promise<Contract> {
  return req('/api/contracts/ensure-draft', { method: 'POST', body: JSON.stringify(input) })
}

export async function updateContractSnapshot(contract: Contract, patch: Partial<ContractSnapshot>): Promise<Contract> {
  return req(`/api/contracts/${contract.id}/snapshot`, { method: 'PATCH', body: JSON.stringify(patch) })
}
