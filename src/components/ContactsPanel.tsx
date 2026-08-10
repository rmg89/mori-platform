'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Contacts panel — link an existing contact, add a new one, edit, remove, and set
// the point of contact. Extracted from the engagement detail page 2026-08-10 so the
// prospect page can render the same thing instead of a read-only list. Keeping one
// copy matters here specifically: the remove and set-POC paths were both silently
// not saving until recently, and a second copy would have needed the same fix twice.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { Pencil, Plus, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { getInitials } from '@/lib/utils'
import type { Engagement, EngagementContact } from '@/types'

type ContactDraft = { first_name: string; last_name: string; title: string; email: string; company_id: string }

const emptyDraft = (): ContactDraft => ({ first_name: '', last_name: '', title: '', email: '', company_id: '' })

const contactToDraft = (c: EngagementContact): ContactDraft => ({
  first_name: c.first_name, last_name: c.last_name, title: c.title ?? '',
  email: c.email, company_id: c.company_id ?? '',
})

function ContactForm({ initial, onSave, onCancel }: {
  initial: ContactDraft
  onSave: (d: ContactDraft) => void
  onCancel: () => void
}) {
  const { companies } = useStore()
  const [d, setD] = useState(initial)
  const set = (k: keyof ContactDraft) => (ev: React.ChangeEvent<HTMLInputElement>) =>
    setD((prev: ContactDraft) => ({ ...prev, [k]: ev.target.value }))

  const canSave = d.first_name.trim() !== '' && d.email.trim() !== ''

  return (
    <div className="space-y-2 p-3 bg-parchment/60 rounded-lg border border-ink-100">
      <div className="grid grid-cols-2 gap-2">
        <input value={d.first_name} onChange={set('first_name')} placeholder="First name"
          className="text-sm text-ink bg-white border border-ink-100 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gold/50 placeholder:text-ink-200" />
        <input value={d.last_name} onChange={set('last_name')} placeholder="Last name"
          className="text-sm text-ink bg-white border border-ink-100 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gold/50 placeholder:text-ink-200" />
      </div>
      <input value={d.title} onChange={set('title')} placeholder="Title"
        className="w-full text-sm text-ink bg-white border border-ink-100 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gold/50 placeholder:text-ink-200" />
      <input value={d.email} onChange={set('email')} placeholder="Email" type="email"
        className="w-full text-sm text-ink bg-white border border-ink-100 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gold/50 placeholder:text-ink-200" />
      <select value={d.company_id}
        onChange={(ev: React.ChangeEvent<HTMLSelectElement>) => setD((prev: ContactDraft) => ({ ...prev, company_id: ev.target.value }))}
        className="w-full text-sm text-ink-400 bg-white border border-ink-100 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gold/50 appearance-none cursor-pointer">
        <option value="">Company (optional)…</option>
        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button onClick={onCancel} className="text-xs text-ink-300 hover:text-ink transition-colors">Cancel</button>
        <button onClick={() => canSave && onSave(d)} disabled={!canSave}
          title={canSave ? undefined : 'First name and email are required'}
          className="text-xs font-medium text-ink-400 hover:text-ink border border-ink-200 hover:border-ink-400 bg-white rounded-lg px-3 py-1.5 transition-all disabled:opacity-40 disabled:hover:text-ink-400 disabled:hover:border-ink-200">
          Save
        </button>
      </div>
    </div>
  )
}

export default function ContactsPanel({ engagement: e }: { engagement: Engagement }) {
  const { engagements, updateEngagement, updateContact, setPointOfContact, deleteContact } = useStore()
  const [mode, setMode] = useState<'idle' | 'search' | 'add'>('idle')
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  // Contacts on other records, split into this organization's and everyone else's,
  // excluding anyone already on this record.
  const linkedEmails = new Set(e.contacts.map(c => c.email.toLowerCase()))
  const pool: EngagementContact[] = []
  const seen = new Set<string>()
  const otherPool: EngagementContact[] = []
  const otherSeen = new Set<string>()

  for (const eng of engagements) {
    const sameOrg = eng.organization.toLowerCase() === e.organization.toLowerCase()
    for (const c of eng.contacts) {
      const key = c.email.toLowerCase()
      if (!key || linkedEmails.has(key)) continue
      if (sameOrg && !seen.has(key)) { seen.add(key); pool.push(c) }
      else if (!sameOrg && !otherSeen.has(key) && !seen.has(key)) { otherSeen.add(key); otherPool.push(c) }
    }
  }

  const trimmed = query.trim().toLowerCase()
  const filter = (c: EngagementContact) =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(trimmed)
    || c.email.toLowerCase().includes(trimmed)
    || (c.title ?? '').toLowerCase().includes(trimmed)
  const orgResults = trimmed ? pool.filter(filter) : pool.slice(0, 6)
  const otherResults = trimmed ? otherPool.filter(filter) : []

  function linkContact(c: EngagementContact) {
    updateEngagement(e.id, {
      contacts: [...e.contacts, { ...c, id: `lnk_${Date.now()}`, is_current_point_of_contact: e.contacts.length === 0 }],
    })
    setQuery(''); setMode('idle')
  }

  function addNewContact(d: ContactDraft) {
    if (!d.first_name.trim() || !d.email.trim()) return
    const c: EngagementContact = {
      id: `new_${Date.now()}`, first_name: d.first_name.trim(), last_name: d.last_name.trim(),
      email: d.email.trim(), title: d.title.trim() || undefined, role: 'primary',
      is_current_point_of_contact: e.contacts.length === 0,
      company_id: d.company_id || undefined,
    }
    updateEngagement(e.id, { contacts: [...e.contacts, c] })
    setMode('idle')
  }

  function editContact(originalEmail: string, d: ContactDraft) {
    // Writes globally — updates this contact everywhere it appears.
    updateContact(originalEmail, {
      first_name: d.first_name.trim(), last_name: d.last_name.trim(),
      title: d.title.trim() || undefined, email: d.email.trim(),
      company_id: d.company_id || undefined,
    })
    setEditingId(null)
  }

  return (
    <div className="bg-white border border-ink-100 rounded-xl p-5">
      <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Contacts</p>

      {e.contacts.length === 0 && mode === 'idle' && (
        <p className="text-sm text-ink-300 italic mb-3">No contacts yet.</p>
      )}

      <div className="space-y-3 mb-3">
        {e.contacts.map(c => (
          <div key={c.id}>
            {editingId === c.id ? (
              <ContactForm
                initial={contactToDraft(c)}
                onSave={d => editContact(c.email, d)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="flex items-center gap-3 group/contact">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${c.role === 'unknown' ? 'bg-amber-100 text-amber-600 ring-1 ring-amber-300' : 'bg-ink-800 text-gold'}`}>
                  {getInitials(c.first_name, c.last_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-ink">{c.first_name} {c.last_name}</p>
                    {c.role === 'unknown' && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 flex-shrink-0">
                        Role unknown
                      </span>
                    )}
                  </div>
                  {c.title && <p className="text-xs text-ink-400">{c.title}</p>}
                  <p className="text-xs text-ink-300 truncate">{c.email}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover/contact:opacity-100 transition-all">
                  {c.is_current_point_of_contact
                    ? <span className="text-[10px] text-gold bg-gold/10 px-2 py-0.5 rounded-full border border-gold/20">POC</span>
                    : <button onClick={() => setPointOfContact(e.id, c.id)}
                        className="text-[10px] text-ink-300 hover:text-gold px-2 py-0.5 rounded-full border border-transparent hover:border-gold/20 transition-all">
                        Set POC
                      </button>
                  }
                  <button onClick={() => setEditingId(c.id)} title="Edit contact"
                    className="p-1.5 rounded text-ink-300 hover:text-ink hover:bg-parchment transition-colors">
                    <Pencil size={11} />
                  </button>
                  <button onClick={() => deleteContact(c.id)} title="Remove contact"
                    className="p-1.5 rounded text-ink-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <X size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add / search area */}
      {mode === 'add' ? (
        <div className="border-t border-ink-100 pt-3">
          <ContactForm initial={emptyDraft()} onSave={addNewContact} onCancel={() => setMode('idle')} />
        </div>
      ) : mode === 'search' ? (
        <div className="border-t border-ink-100 pt-3">
          <div className="flex items-center gap-2 mb-2">
            <input autoFocus value={query}
              onChange={(ev: React.ChangeEvent<HTMLInputElement>) => setQuery(ev.target.value)}
              placeholder="Search by name, title, or email…"
              className="flex-1 text-sm text-ink bg-parchment border border-ink-100 rounded-lg px-3 py-2 focus:outline-none focus:border-gold/50 placeholder:text-ink-200" />
            <button onClick={() => { setMode('idle'); setQuery('') }}
              className="p-2 text-ink-300 hover:text-ink transition-colors">
              <X size={13} />
            </button>
          </div>
          {(orgResults.length > 0 || otherResults.length > 0) ? (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {orgResults.map(c => (
                <button key={c.id} onClick={() => linkContact(c)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-parchment transition-colors text-left">
                  <div className="w-7 h-7 rounded-full bg-ink-800 flex items-center justify-center text-[11px] font-bold text-gold flex-shrink-0">
                    {getInitials(c.first_name, c.last_name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{c.first_name} {c.last_name}</p>
                    {c.title && <p className="text-[11px] text-ink-400 truncate">{c.title}</p>}
                  </div>
                </button>
              ))}
              {otherResults.length > 0 && (
                <>
                  <div className="flex items-center gap-2 py-1 px-1">
                    <div className="h-px flex-1 bg-ink-100" />
                    <span className="text-[10px] text-ink-300 uppercase tracking-widest">Other clients</span>
                    <div className="h-px flex-1 bg-ink-100" />
                  </div>
                  {otherResults.map(c => (
                    <button key={c.id} onClick={() => linkContact(c)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-parchment transition-colors text-left">
                      <div className="w-7 h-7 rounded-full bg-ink-800 flex items-center justify-center text-[11px] font-bold text-gold flex-shrink-0">
                        {getInitials(c.first_name, c.last_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">{c.first_name} {c.last_name}</p>
                        {c.title && <p className="text-[11px] text-ink-400 truncate">{c.title}</p>}
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-ink-300 italic px-1">No matching contacts found.</p>
              <button onClick={() => setMode('add')}
                className="text-xs text-gold hover:text-gold-dark transition-colors flex items-center gap-1 px-1">
                <Plus size={11} /> Add new contact
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="border-t border-ink-100 pt-3 flex items-center gap-2">
          <button onClick={() => setMode('search')}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs text-ink-300 hover:text-gold transition-colors font-medium border border-dashed border-ink-200 hover:border-gold/40 rounded-lg px-3 py-2">
            <Plus size={11} /> Link a contact
          </button>
          <button onClick={() => setMode('add')}
            className="flex items-center justify-center gap-1.5 text-xs text-ink-300 hover:text-gold transition-colors font-medium border border-dashed border-ink-200 hover:border-gold/40 rounded-lg px-3 py-2">
            <Plus size={11} /> New
          </button>
        </div>
      )}
    </div>
  )
}
