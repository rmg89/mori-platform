// ─────────────────────────────────────────────────────────────────────────────
// Mori Platform — Contracts data layer (server-only, uses the service-role client)
// Persists generated contracts (sequential numbering via the create_contract RPC)
// and keeps their status in sync with the existing per-engagement contract
// fields (contract_sent_at / contract_finalized_at / contract_signed_at).
// Direct mirror of src/lib/invoices.ts, minus the invoice/deposit type split.
// ─────────────────────────────────────────────────────────────────────────────

import { supabaseAdmin } from '@/lib/supabase'
import type { Contract, ContractOrigin, ContractSnapshot, ContractStatus } from '@/types'

const supabase = supabaseAdmin()

export async function createContract(input: {
  engagementId?: string
  organization: string
  amount?: number
  snapshot?: ContractSnapshot
  origin?: ContractOrigin
  label?: string
  templateId?: string
}): Promise<Contract> {
  const { data, error } = await supabase.rpc('create_contract', {
    p_engagement_id: input.engagementId ?? null,
    p_organization: input.organization,
    p_amount: input.amount ?? null,
    p_snapshot: input.snapshot ?? {},
    p_origin: input.origin ?? 'drafted',
    p_label: input.label ?? 'Speaking Agreement',
    p_template_id: input.templateId ?? null,
  })
  if (error) throw new Error(`createContract: ${error.message}`)
  return data as Contract
}

export async function fetchContractById(id: string): Promise<Contract | null> {
  const { data, error } = await supabase.from('contracts').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(`fetchContractById: ${error.message}`)
  return data as Contract | null
}

// All documents attached to an engagement, of any origin — an engagement can
// have several (e.g. the speaking agreement we draft, plus an NDA the client
// sent us). Ordered oldest-first, the order they'd naturally have been added.
export async function fetchContractsForEngagement(engagementId: string): Promise<Contract[]> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('engagement_id', engagementId)
    .order('sequence_number', { ascending: true })
  if (error) throw new Error(`fetchContractsForEngagement: ${error.message}`)
  return (data ?? []) as Contract[]
}

// Strip characters that would break PostgREST's comma-delimited `.or()` filter
// string before interpolating free-text search input into it.
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()%]/g, '').trim()
}

export async function fetchContracts(opts: {
  status?: ContractStatus
  search?: string
  offset: number
  limit: number
}): Promise<{ rows: Contract[]; count: number }> {
  let query = supabase
    .from('contracts')
    .select('*', { count: 'exact' })
    .order('sequence_number', { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1)

  if (opts.status) query = query.eq('status', opts.status)
  const term = opts.search ? sanitizeSearchTerm(opts.search) : ''
  if (term) query = query.or(`organization.ilike.%${term}%,contract_number.ilike.%${term}%`)

  const { data, error, count } = await query
  if (error) throw new Error(`fetchContracts: ${error.message}`)
  return { rows: (data ?? []) as Contract[], count: count ?? 0 }
}

// Updates the contract row and, if it's linked to an engagement, best-effort
// mirrors the status onto the existing fields the engagement/wrap-up "Contract"
// zone already reads — so both surfaces agree without either owning the other.
export async function setContractStatus(contract: Contract, status: ContractStatus): Promise<void> {
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = { status }
  if (status === 'finalized') patch.finalized_at = now
  if (status === 'sent') patch.sent_at = now
  if (status === 'signed') patch.signed_at = now

  const { error } = await supabase.from('contracts').update(patch).eq('id', contract.id)
  if (error) throw new Error(`setContractStatus: ${error.message}`)

  if (!contract.engagement_id) return

  const engagementPatch: Record<string, unknown> =
    status === 'finalized' ? { contract_finalized_at: now }
    : status === 'sent' ? { contract_sent_at: now }
    : status === 'signed' ? { contract_signed_at: now }
    : {}

  if (Object.keys(engagementPatch).length === 0) return
  await supabase.from('engagements').update(engagementPatch).eq('id', contract.engagement_id)
}

// Convenience wrapper — marks a contract reviewed/ready-to-send.
export function finalizeContract(contract: Contract): Promise<void> {
  return setContractStatus(contract, 'finalized')
}

// Attaches the client's signed/countersigned contract file. Uploading a file
// implies signed — same convention as incoming_materials' attachFile marking
// received: true — so this also advances status to 'signed' (and mirrors
// contract_signed_at onto the engagement) if it isn't already. Pass null/null
// to detach (e.g. removing a wrongly-uploaded file) without touching status.
export async function attachSignedContractFile(contract: Contract, fileUrl: string | null, fileName: string | null): Promise<Contract> {
  if (fileUrl && contract.status !== 'signed') {
    await setContractStatus(contract, 'signed')
  }
  const { data, error } = await supabase
    .from('contracts')
    .update({ signed_file_url: fileUrl, signed_file_name: fileName })
    .eq('id', contract.id)
    .select('*')
    .single()
  if (error) throw new Error(`attachSignedContractFile: ${error.message}`)
  return data as Contract
}

// Finds the most recent contract row for an engagement (used when the existing
// engagement/wrap-up controls change status, to mirror it back).
export async function findLatestContract(engagementId: string): Promise<Contract | null> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('engagement_id', engagementId)
    .order('sequence_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`findLatestContract: ${error.message}`)
  return data as Contract | null
}

// Idempotent auto-draft — called the moment a contract is downloaded for an
// engagement. Reuses whatever's already in flight (draft/finalized/sent) for
// that engagement; only starts a new one if none exists yet or the last one
// already closed out (signed), e.g. a renegotiated repeat engagement.
export async function ensureDraftContract(input: {
  engagementId: string
  organization: string
  amount: number
  snapshot: ContractSnapshot
}): Promise<Contract> {
  const existing = await findLatestContract(input.engagementId)
  if (existing && existing.status !== 'signed') return existing
  return createContract(input)
}

// Merges field edits into a contract's snapshot (and keeps the denormalized
// organization/amount columns used by the Contracts list in sync).
export async function updateContractSnapshot(contract: Contract, patch: Partial<ContractSnapshot>): Promise<Contract> {
  const snapshot = { ...contract.snapshot, ...patch }
  const amount = snapshot.fee ?? contract.amount
  const { data, error } = await supabase
    .from('contracts')
    .update({ snapshot, organization: snapshot.organization, amount })
    .eq('id', contract.id)
    .select('*')
    .single()
  if (error) throw new Error(`updateContractSnapshot: ${error.message}`)
  return data as Contract
}

// Removes a document — e.g. one added by mistake through "+ Add document".
export async function deleteContract(id: string): Promise<void> {
  const { error } = await supabase.from('contracts').delete().eq('id', id)
  if (error) throw new Error(`deleteContract: ${error.message}`)
}
