"use client"

// ─────────────────────────────────────────────────────────────────────────────
// Mori Platform — client-side contract templates access
// Same function names/signatures as contract-templates.ts (server-only).
// ─────────────────────────────────────────────────────────────────────────────

import type { ContractTemplate, ContractTemplateBlock } from '@/types'

import { apiRequest as req } from '@/lib/api-client'

export async function fetchContractTemplates(): Promise<ContractTemplate[]> {
  return req('/api/contract-templates')
}

export async function fetchContractTemplateById(id: string): Promise<ContractTemplate> {
  return req(`/api/contract-templates/${id}`)
}

export async function createContractTemplate(input: { name: string; blocks?: ContractTemplateBlock[] }): Promise<ContractTemplate> {
  return req('/api/contract-templates', { method: 'POST', body: JSON.stringify(input) })
}

export async function updateContractTemplate(id: string, patch: Partial<Pick<ContractTemplate, 'name' | 'blocks' | 'is_default'>>): Promise<ContractTemplate> {
  return req(`/api/contract-templates/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

export async function deleteContractTemplate(id: string): Promise<void> {
  await req(`/api/contract-templates/${id}`, { method: 'DELETE' })
}
