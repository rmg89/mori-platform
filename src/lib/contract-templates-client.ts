"use client"

// ─────────────────────────────────────────────────────────────────────────────
// Mori Platform — client-side contract templates access
// Same function names/signatures as contract-templates.ts (server-only).
// ─────────────────────────────────────────────────────────────────────────────

import type { ContractTemplate, ContractTemplateBlock } from '@/types'

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
