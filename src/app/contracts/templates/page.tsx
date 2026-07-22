'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { fetchContractTemplates, createContractTemplate } from '@/lib/contract-templates-client'
import type { ContractTemplate } from '@/types'
import { ArrowLeft, Plus } from 'lucide-react'

export default function ContractTemplatesPage() {
  const [templates, setTemplates] = useState<ContractTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchContractTemplates()
      .then(setTemplates)
      .catch(err => console.error('fetchContractTemplates:', err))
      .finally(() => setLoading(false))
  }, [])

  async function handleNewTemplate() {
    setCreating(true)
    try {
      const created = await createContractTemplate({ name: 'New Template', blocks: [] })
      window.location.href = `/contracts/templates/${created.id}`
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto animate-fade-in">
      <Link href="/contracts" className="flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink transition-colors mb-4">
        <ArrowLeft size={12} /> Back to Contracts
      </Link>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-ink">Contract Templates</h1>
        <p className="text-ink-400 text-sm mt-1">The legal and business terms used when drafting a contract — editable here, not in code.</p>
        <div className="accent-line mt-3 w-24" />
      </div>

      {loading ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : (
        <div className="bg-white border border-ink-100 rounded-2xl overflow-hidden mb-4">
          <div className="divide-y divide-ink-100">
            {templates.map(t => (
              <Link key={t.id} href={`/contracts/templates/${t.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-parchment/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink">{t.name}</span>
                    {t.is_default && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gold/10 text-gold-dark">Default</span>
                    )}
                  </div>
                  <span className="text-xs text-ink-300">{t.blocks.length} block{t.blocks.length === 1 ? '' : 's'}</span>
                </div>
              </Link>
            ))}
            {templates.length === 0 && (
              <p className="text-sm text-ink-400 px-5 py-4">No templates yet.</p>
            )}
          </div>
        </div>
      )}

      <button onClick={handleNewTemplate} disabled={creating}
        className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg border border-dashed border-ink-200 text-xs text-ink-300 hover:border-gold/40 hover:text-ink-500 transition-all disabled:opacity-40">
        <Plus size={11} /> {creating ? 'Creating…' : 'New Template'}
      </button>
    </div>
  )
}
