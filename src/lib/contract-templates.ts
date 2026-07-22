// ─────────────────────────────────────────────────────────────────────────────
// Mori Platform — Contract templates data layer (server-only, service-role client)
// The editable legal/business content of a "drafted" contract. Matches the
// pattern established by src/lib/contracts.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { supabaseAdmin } from '@/lib/supabase'
import type { ContractTemplate, ContractTemplateBlock } from '@/types'

const supabase = supabaseAdmin()

export async function fetchContractTemplates(): Promise<ContractTemplate[]> {
  const { data, error } = await supabase.from('contract_templates').select('*').order('created_at', { ascending: true })
  if (error) throw new Error(`fetchContractTemplates: ${error.message}`)
  return (data ?? []) as ContractTemplate[]
}

export async function fetchContractTemplateById(id: string): Promise<ContractTemplate | null> {
  const { data, error } = await supabase.from('contract_templates').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(`fetchContractTemplateById: ${error.message}`)
  return data as ContractTemplate | null
}

export async function createContractTemplate(input: { name: string; blocks?: ContractTemplateBlock[] }): Promise<ContractTemplate> {
  const { data, error } = await supabase
    .from('contract_templates')
    .insert({ name: input.name, blocks: input.blocks ?? [] })
    .select('*')
    .single()
  if (error) throw new Error(`createContractTemplate: ${error.message}`)
  return data as ContractTemplate
}

export async function updateContractTemplate(id: string, patch: Partial<Pick<ContractTemplate, 'name' | 'blocks' | 'is_default'>>): Promise<ContractTemplate> {
  const { data, error } = await supabase
    .from('contract_templates')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(`updateContractTemplate: ${error.message}`)
  return data as ContractTemplate
}

// Refuses to delete the current default — a "+ Add document" template picker
// always needs somewhere to default to. Mark a different template default first.
export async function deleteContractTemplate(id: string): Promise<void> {
  const existing = await fetchContractTemplateById(id)
  if (existing?.is_default) {
    throw new Error('Cannot delete the default template — mark a different template as default first')
  }
  const { error } = await supabase.from('contract_templates').delete().eq('id', id)
  if (error) throw new Error(`deleteContractTemplate: ${error.message}`)
}
