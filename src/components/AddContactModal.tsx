'use client'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Search } from 'lucide-react'
import { useStore } from '@/lib/store'

interface AddContactModalProps {
  onClose: () => void
}

export default function AddContactModal({ onClose }: AddContactModalProps) {
  const { companies, createContact } = useStore()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [title, setTitle] = useState('')
  const [companyQuery, setCompanyQuery] = useState('')
  const [companyId, setCompanyId] = useState<string | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedFirst = firstName.trim()
  const canSave = trimmedFirst.length > 0 && !saving

  const selectedCompany = companies.find(c => c.id === companyId)
  const companyMatches = companyQuery.trim() && !selectedCompany
    ? companies.filter(c => c.name.toLowerCase().includes(companyQuery.trim().toLowerCase())).slice(0, 5)
    : []

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      await createContact({
        first_name: trimmedFirst,
        last_name: lastName.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        title: title.trim() || undefined,
        company_id: companyId,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create contact')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white border border-ink-100 rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={ev => ev.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-ink">Add Contact</h3>
            <p className="text-xs text-ink-300 mt-0.5">Add a new contact to your network.</p>
          </div>
          <button onClick={onClose} className="text-ink-300 hover:text-ink-500 transition-colors flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1.5">First name</label>
              <input
                value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jane" autoFocus
                className="w-full text-sm bg-parchment border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-gold/40 text-ink placeholder:text-ink-300 transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1.5">Last name</label>
              <input
                value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Doe"
                className="w-full text-sm bg-parchment border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-gold/40 text-ink placeholder:text-ink-300 transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1.5">Email (optional)</label>
            <input
              value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" type="email"
              className="w-full text-sm bg-parchment border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-gold/40 text-ink placeholder:text-ink-300 transition-all"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1.5">Phone (optional)</label>
            <input
              value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 555-5555" type="tel"
              className="w-full text-sm bg-parchment border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-gold/40 text-ink placeholder:text-ink-300 transition-all"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1.5">Title (optional)</label>
            <input
              value={title} onChange={e => setTitle(e.target.value)} placeholder="Bureau Agent"
              className="w-full text-sm bg-parchment border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-gold/40 text-ink placeholder:text-ink-300 transition-all"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1.5">Company (optional)</label>
            {selectedCompany ? (
              <div className="flex items-center justify-between gap-2 bg-parchment border border-ink-100 rounded-lg px-3 py-2">
                <span className="text-sm text-ink truncate">{selectedCompany.name}</span>
                <button type="button" onClick={() => { setCompanyId(undefined); setCompanyQuery('') }}
                  className="text-ink-300 hover:text-ink-500 flex-shrink-0">
                  <X size={13} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center gap-2 bg-parchment border border-ink-100 rounded-lg px-3 py-2">
                  <Search size={12} className="text-ink-300 flex-shrink-0" />
                  <input
                    value={companyQuery} onChange={e => setCompanyQuery(e.target.value)} placeholder="Search companies..."
                    className="w-full text-sm bg-transparent outline-none text-ink placeholder:text-ink-300"
                  />
                </div>
                {companyMatches.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-ink-100 rounded-lg shadow-md overflow-hidden">
                    {companyMatches.map(c => (
                      <button key={c.id} type="button"
                        onClick={() => { setCompanyId(c.id); setCompanyQuery('') }}
                        className="w-full text-left text-sm text-ink px-3 py-2 hover:bg-parchment transition-all">
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
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
            {saving ? 'Creating…' : 'Add Contact'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
