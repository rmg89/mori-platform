'use client'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useStore } from '@/lib/store'

interface AddCompanyModalProps {
  onClose: () => void
  onCreated: (companyId: string) => void
}

export default function AddCompanyModal({ onClose, onCreated }: AddCompanyModalProps) {
  const { createCompany } = useStore()
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [industry, setIndustry] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedName = name.trim()
  const canSave = trimmedName.length > 0 && !saving

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      const company = await createCompany({
        name: trimmedName,
        website: website.trim() || undefined,
        industry: industry.trim() || undefined,
      })
      onCreated(company.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create company')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white border border-ink-100 rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={ev => ev.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-ink">Add Company</h3>
            <p className="text-xs text-ink-300 mt-0.5">Add a new company to your network.</p>
          </div>
          <button onClick={onClose} className="text-ink-300 hover:text-ink-500 transition-colors flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1.5">Company name</label>
            <input
              value={name} onChange={e => setName(e.target.value)} placeholder="Canyon Ranch" autoFocus
              className="w-full text-sm bg-parchment border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-gold/40 text-ink placeholder:text-ink-300 transition-all"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1.5">Website (optional)</label>
            <input
              value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://example.com" type="url"
              className="w-full text-sm bg-parchment border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-gold/40 text-ink placeholder:text-ink-300 transition-all"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1.5">Industry (optional)</label>
            <input
              value={industry} onChange={e => setIndustry(e.target.value)} placeholder="Hospitality"
              className="w-full text-sm bg-parchment border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-gold/40 text-ink placeholder:text-ink-300 transition-all"
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-500 mt-3">{error}</p>}

        <div className="flex items-center justify-end gap-2 mt-6">
          <button onClick={onClose}
            className="text-xs font-medium text-ink-400 hover:text-ink px-4 py-2 rounded-lg hover:bg-parchment transition-all">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="text-xs font-medium text-white bg-ink hover:bg-ink-700 px-4 py-2 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Creating…' : 'Add Company'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
