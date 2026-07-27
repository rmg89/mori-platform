'use client'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Search } from 'lucide-react'
import type { Contract, Engagement, ContractTemplate } from '@/types'
import { createContract, buildContractSnapshot } from '@/lib/contracts-client'
import { fetchContractTemplates } from '@/lib/contract-templates-client'
import { formatDate } from '@/lib/utils'

interface NewContractModalProps {
  engagements: Engagement[]
  onClose: () => void
  onCreated: (contract: Contract) => void
}

export default function NewContractModal({ engagements, onClose, onCreated }: NewContractModalProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Engagement | null>(null)
  const [label, setLabel] = useState('Speaking Agreement')
  const [templates, setTemplates] = useState<ContractTemplate[]>([])
  const [templateId, setTemplateId] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchContractTemplates()
      .then(found => {
        setTemplates(found)
        setTemplateId(found.find(t => t.is_default)?.id ?? found[0]?.id ?? '')
      })
      .catch(err => console.error('fetchContractTemplates:', err))
  }, [])

  // Close the results dropdown on outside click.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const q = query.trim().toLowerCase()
  const results = (q
    ? engagements.filter(e =>
        e.organization?.toLowerCase().includes(q) ||
        (e.event_name ?? '').toLowerCase().includes(q))
    : engagements
  ).slice(0, 8)

  function pick(e: Engagement) {
    setSelected(e)
    setQuery(e.organization)
    setOpen(false)
  }

  async function handleCreate() {
    if (!selected) { setError('Choose an engagement first.'); return }
    setCreating(true)
    setError(null)
    try {
      const created = await createContract({
        engagementId: selected.id,
        organization: selected.organization,
        origin: 'drafted',
        label: label.trim() || 'Speaking Agreement',
        amount: selected.fee,
        snapshot: buildContractSnapshot(selected),
        templateId: templateId || undefined,
      })
      onCreated(created)
      onClose()
    } catch (err: any) {
      setError(err?.message ?? 'Could not create the contract. Try again.')
    } finally {
      setCreating(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white border border-ink-100 rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={ev => ev.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-ink">New Contract</h3>
            <p className="text-xs text-ink-300 mt-0.5">Draft a contract tied to an existing engagement.</p>
          </div>
          <button onClick={onClose} className="text-ink-300 hover:text-ink-500 transition-colors flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div ref={searchRef} className="relative">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1.5">Engagement</label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
              <input
                value={query}
                onChange={e => { setQuery(e.target.value); setSelected(null); setOpen(true) }}
                onFocus={() => setOpen(true)}
                placeholder="Search by organization or event"
                className="w-full text-sm bg-parchment border border-ink-100 rounded-lg pl-8 pr-3 py-2 outline-none focus:border-gold/40 text-ink placeholder:text-ink-300"
              />
            </div>
            {open && results.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-ink-100 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                {results.map(e => (
                  <button key={e.id} onClick={() => pick(e)}
                    className="w-full text-left px-3 py-2 hover:bg-parchment/60 transition-colors">
                    <div className="text-sm font-medium text-ink truncate">{e.organization}</div>
                    <div className="text-xs text-ink-300 truncate">
                      {[e.event_name, e.event_date ? formatDate(e.event_date) : null].filter(Boolean).join(' · ') || 'No event details'}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {open && q && results.length === 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-ink-100 rounded-lg shadow-lg px-3 py-2 text-sm text-ink-400">
                No engagements match.
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1.5">Label</label>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Speaking Agreement"
              className="w-full text-sm bg-parchment border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-gold/40 text-ink placeholder:text-ink-300" />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1.5">Template</label>
            <select value={templateId} onChange={e => setTemplateId(e.target.value)}
              className="w-full text-sm bg-parchment border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-gold/40 text-ink-700">
              {templates.length === 0 && <option value="">Loading templates…</option>}
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}{t.is_default ? ' (default)' : ''}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-xs text-red-500 mt-4">{error}</p>}

        <div className="flex items-center justify-end gap-2 mt-6">
          <button onClick={onClose}
            className="text-xs font-medium text-ink-400 hover:text-ink px-4 py-2 rounded-lg hover:bg-parchment transition-all">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={creating || !selected}
            className="text-xs font-medium text-white bg-ink hover:bg-ink-700 px-4 py-2 rounded-lg transition-all disabled:opacity-40">
            {creating ? 'Creating…' : 'Create contract'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
