'use client'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Check, Plus } from 'lucide-react'
import { useStore } from '@/lib/store'
import { getInitials } from '@/lib/utils'
import type { ProspectStep, EngagementContact } from '@/types'

function Field({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm bg-parchment border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-gold/40 text-ink placeholder:text-ink-300 transition-all"
      />
    </div>
  )
}

interface NewInquiryModalProps {
  onClose: () => void
  onCreated: (engagementId: string) => void
}

export default function NewInquiryModal({ onClose, onCreated }: NewInquiryModalProps) {
  const { addProspect, companies, engagements } = useStore()
  const [organization, setOrganization] = useState('')
  const [contactMode, setContactMode] = useState<'search' | 'add'>('search')
  const [contactQuery, setContactQuery] = useState('')
  const [selectedContact, setSelectedContact] = useState<EngagementContact | null>(null)
  const [contactFirstName, setContactFirstName] = useState('')
  const [contactLastName, setContactLastName] = useState('')
  const [contactTitle, setContactTitle] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [topic, setTopic] = useState('')
  const [eventCity, setEventCity] = useState('')
  const [source, setSource] = useState('')
  const [prospectStep, setProspectStep] = useState<ProspectStep>('inquiry')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Company match/link ──────────────────────────────────────────────────────
  const trimmedOrg = organization.trim()
  const exactCompanyMatch = companies.find(c => c.name.toLowerCase() === trimmedOrg.toLowerCase())
  const companyMatches = trimmedOrg && !exactCompanyMatch
    ? companies.filter(c => c.name.toLowerCase().includes(trimmedOrg.toLowerCase())).slice(0, 5)
    : []

  // ── Existing contact search (mirrors the contact linker on the engagement page) ──
  const orgLower = trimmedOrg.toLowerCase()
  const pool: { contact: EngagementContact; organization: string }[] = []
  const otherPool: { contact: EngagementContact; organization: string }[] = []
  const seen = new Set<string>()
  const otherSeen = new Set<string>()
  for (const eng of engagements) {
    const sameOrg = orgLower.length > 0 && eng.organization.toLowerCase() === orgLower
    for (const c of eng.contacts) {
      const key = c.email.toLowerCase()
      if (!key) continue
      if (sameOrg && !seen.has(key)) { seen.add(key); pool.push({ contact: c, organization: eng.organization }) }
      else if (!sameOrg && !otherSeen.has(key) && !seen.has(key)) { otherSeen.add(key); otherPool.push({ contact: c, organization: eng.organization }) }
    }
  }
  const trimmedQuery = contactQuery.trim().toLowerCase()
  const filterHit = (h: { contact: EngagementContact }) =>
    `${h.contact.first_name} ${h.contact.last_name}`.toLowerCase().includes(trimmedQuery)
    || h.contact.email.toLowerCase().includes(trimmedQuery)
    || (h.contact.title ?? '').toLowerCase().includes(trimmedQuery)
  const orgResults = trimmedQuery ? pool.filter(filterHit) : pool.slice(0, 6)
  const otherResults = trimmedQuery ? otherPool.filter(filterHit) : []

  const canSave = trimmedOrg.length > 0 && !saving

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      const contact = selectedContact
        ? {
            first_name: selectedContact.first_name,
            last_name: selectedContact.last_name || undefined,
            email: selectedContact.email || undefined,
            phone: selectedContact.phone || undefined,
            title: selectedContact.title || undefined,
          }
        : contactFirstName.trim()
          ? {
              first_name: contactFirstName.trim(),
              last_name: contactLastName.trim() || undefined,
              email: contactEmail.trim() || undefined,
              phone: contactPhone.trim() || undefined,
              title: contactTitle.trim() || undefined,
            }
          : undefined

      const engagement = await addProspect({
        organization: trimmedOrg,
        company_id: exactCompanyMatch?.id,
        prospect_step: prospectStep,
        source: source.trim() || undefined,
        topic: topic.trim() || undefined,
        event_city: eventCity.trim() || undefined,
        notes: notes.trim() || undefined,
        contact,
      })
      onCreated(engagement.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create prospect')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white border border-ink-100 rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[85vh] overflow-y-auto" onClick={ev => ev.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-ink">New Inquiry</h3>
            <p className="text-xs text-ink-300 mt-0.5">Add a new prospect to the pipeline.</p>
          </div>
          <button onClick={onClose} className="text-ink-300 hover:text-ink-500 transition-colors flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          {/* Organization / company link */}
          <div>
            <Field label="Organization" value={organization} onChange={setOrganization} placeholder="Canyon Ranch" />
            {companyMatches.length > 0 && (
              <div className="mt-1 border border-ink-100 rounded-lg overflow-hidden bg-white shadow-sm">
                {companyMatches.map(c => (
                  <button key={c.id} type="button" onClick={() => setOrganization(c.name)}
                    className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-parchment transition-colors flex items-center justify-between">
                    <span>{c.name}</span>
                    <span className="text-[10px] text-ink-300">{c.engagement_ids.length} engagement{c.engagement_ids.length === 1 ? '' : 's'}</span>
                  </button>
                ))}
              </div>
            )}
            {exactCompanyMatch && (
              <p className="text-[11px] text-sage mt-1.5 flex items-center gap-1">
                <Check size={11} /> Linked to existing company
              </p>
            )}
          </div>

          {/* Contact: search existing or add new */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1.5">Contact</label>

            {selectedContact ? (
              <div className="flex items-center gap-2.5 bg-parchment border border-ink-100 rounded-lg px-3 py-2">
                <div className="w-7 h-7 rounded-full bg-ink-800 flex items-center justify-center text-[11px] font-bold text-gold flex-shrink-0">
                  {getInitials(selectedContact.first_name, selectedContact.last_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink truncate">{selectedContact.first_name} {selectedContact.last_name}</p>
                  <p className="text-xs text-ink-300 truncate">{selectedContact.email}</p>
                </div>
                <button onClick={() => setSelectedContact(null)}
                  className="p-1 rounded text-ink-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                  <X size={13} />
                </button>
              </div>
            ) : contactMode === 'search' ? (
              <div>
                <input
                  value={contactQuery}
                  onChange={e => setContactQuery(e.target.value)}
                  placeholder="Search by name, title, or email…"
                  className="w-full text-sm bg-parchment border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-gold/40 text-ink placeholder:text-ink-300 transition-all"
                />
                {(orgResults.length > 0 || otherResults.length > 0) ? (
                  <div className="mt-1.5 space-y-1 max-h-40 overflow-y-auto border border-ink-100 rounded-lg p-1.5">
                    {orgResults.map(h => (
                      <button key={h.contact.id} onClick={() => setSelectedContact(h.contact)}
                        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-parchment transition-colors text-left">
                        <div className="w-6 h-6 rounded-full bg-ink-800 flex items-center justify-center text-[10px] font-bold text-gold flex-shrink-0">
                          {getInitials(h.contact.first_name, h.contact.last_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink truncate">{h.contact.first_name} {h.contact.last_name}</p>
                          {h.contact.title && <p className="text-[11px] text-ink-400 truncate">{h.contact.title}</p>}
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
                        {otherResults.map(h => (
                          <button key={h.contact.id} onClick={() => setSelectedContact(h.contact)}
                            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-parchment transition-colors text-left">
                            <div className="w-6 h-6 rounded-full bg-ink-800 flex items-center justify-center text-[10px] font-bold text-gold flex-shrink-0">
                              {getInitials(h.contact.first_name, h.contact.last_name)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-ink truncate">{h.contact.first_name} {h.contact.last_name}</p>
                              <p className="text-[11px] text-ink-400 truncate">{h.organization}</p>
                            </div>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                ) : trimmedQuery ? (
                  <p className="text-xs text-ink-300 italic px-1 mt-1.5">No matching contacts found.</p>
                ) : null}
                <button onClick={() => setContactMode('add')}
                  className="mt-1.5 text-xs text-gold hover:text-gold-dark transition-colors flex items-center gap-1 px-1">
                  <Plus size={11} /> Add new contact
                </button>
              </div>
            ) : (
              <div className="space-y-2 p-3 bg-parchment/60 rounded-lg border border-ink-100">
                <div className="grid grid-cols-2 gap-2">
                  <input value={contactFirstName} onChange={e => setContactFirstName(e.target.value)} placeholder="First name"
                    className="text-sm text-ink bg-white border border-ink-100 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gold/50 placeholder:text-ink-300" />
                  <input value={contactLastName} onChange={e => setContactLastName(e.target.value)} placeholder="Last name"
                    className="text-sm text-ink bg-white border border-ink-100 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gold/50 placeholder:text-ink-300" />
                </div>
                <input value={contactTitle} onChange={e => setContactTitle(e.target.value)} placeholder="Title"
                  className="w-full text-sm text-ink bg-white border border-ink-100 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gold/50 placeholder:text-ink-300" />
                <div className="grid grid-cols-2 gap-2">
                  <input value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="Email" type="email"
                    className="text-sm text-ink bg-white border border-ink-100 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gold/50 placeholder:text-ink-300" />
                  <input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="Phone" type="tel"
                    className="text-sm text-ink bg-white border border-ink-100 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gold/50 placeholder:text-ink-300" />
                </div>
                <button onClick={() => setContactMode('search')}
                  className="text-xs text-ink-300 hover:text-ink transition-colors px-1">
                  ‹ Search existing contacts instead
                </button>
              </div>
            )}
          </div>

          <Field label="Topic" value={topic} onChange={setTopic} placeholder="Stress & Energy Reset" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Event city" value={eventCity} onChange={setEventCity} placeholder="Lenox, MA" />
            <Field label="Source" value={source} onChange={setSource} placeholder="Referral, website, etc." />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1.5">Pipeline step</label>
            <select
              value={prospectStep}
              onChange={e => setProspectStep(e.target.value as ProspectStep)}
              className="w-full text-sm bg-parchment border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-gold/40 text-ink transition-all"
            >
              <option value="inquiry">Inquiry</option>
              <option value="outreach">Outreach</option>
              <option value="in_contact">In Contact</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full text-sm bg-parchment border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-gold/40 text-ink placeholder:text-ink-300 transition-all resize-none"
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
            {saving ? 'Creating…' : 'Create Prospect'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
