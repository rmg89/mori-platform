'use client'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Check, Plus, Wand2, Loader2 } from 'lucide-react'
import { useStore } from '@/lib/store'
import { getInitials } from '@/lib/utils'
import type { ProspectStep, EngagementContact } from '@/types'

function Field({
  label, value, onChange, placeholder, type = 'text', id,
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; id?: string
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1.5">{label}</label>
      <input
        id={id}
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
  const { addProspect, companies, engagements, createCompany } = useStore()
  const [organization, setOrganization] = useState('')
  const [orgMode, setOrgMode] = useState<'search' | 'add'>('search')
  const [newOrgWebsite, setNewOrgWebsite] = useState('')
  const [newOrgAiSuggested, setNewOrgAiSuggested] = useState(false)
  const [lookingUpOrg, setLookingUpOrg] = useState(false)
  const [lookupNote, setLookupNote] = useState<string | null>(null)
  const [creatingCompany, setCreatingCompany] = useState(false)
  const [contactMode, setContactMode] = useState<'search' | 'add'>('search')
  const [contactQuery, setContactQuery] = useState('')
  const [selectedContacts, setSelectedContacts] = useState<EngagementContact[]>([])
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
  const orgNameInputRef = useRef<HTMLInputElement>(null)
  const contactFirstNameInputRef = useRef<HTMLInputElement>(null)

  // Focus explicitly (rather than relying on the autoFocus prop) — the trigger
  // button that had focus gets unmounted in the same render that mounts these
  // inputs, and the browser can drop focus to <body> in that swap.
  useEffect(() => {
    if (orgMode === 'add') orgNameInputRef.current?.focus()
  }, [orgMode])
  useEffect(() => {
    if (contactMode === 'add') contactFirstNameInputRef.current?.focus()
  }, [contactMode])

  // ── Company match/link ──────────────────────────────────────────────────────
  const trimmedOrg = organization.trim()
  const exactCompanyMatch = companies.find(c => c.name.toLowerCase() === trimmedOrg.toLowerCase())
  const companyMatches = trimmedOrg && !exactCompanyMatch
    ? companies.filter(c => c.name.toLowerCase().includes(trimmedOrg.toLowerCase())).slice(0, 5)
    : []

  // ── Existing contact search (mirrors the contact linker on the engagement page) ──
  const orgLower = trimmedOrg.toLowerCase()
  const addedEmails = new Set(selectedContacts.map(c => c.email.toLowerCase()))
  const pool: { contact: EngagementContact; organization: string }[] = []
  const otherPool: { contact: EngagementContact; organization: string }[] = []
  const seen = new Set<string>()
  const otherSeen = new Set<string>()
  for (const eng of engagements) {
    const sameOrg = orgLower.length > 0 && eng.organization.toLowerCase() === orgLower
    for (const c of eng.contacts) {
      const key = c.email.toLowerCase()
      if (!key || addedEmails.has(key)) continue
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
  const canAddContact = contactFirstName.trim().length > 0 && contactLastName.trim().length > 0 && contactEmail.trim().length > 0

  async function handleLookupOrg() {
    if (!trimmedOrg || lookingUpOrg) return
    setLookingUpOrg(true)
    setLookupNote(null)
    try {
      const res = await fetch('/api/ai/enrich-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedOrg }),
      })
      if (!res.ok) throw new Error('Lookup request failed')
      const data: { website: string | null } = await res.json()
      if (data.website) {
        setNewOrgWebsite(data.website)
        setNewOrgAiSuggested(true)
      } else {
        setLookupNote('No public info found — enter manually.')
      }
    } catch {
      setLookupNote('Lookup failed — enter manually.')
    } finally {
      setLookingUpOrg(false)
    }
  }

  async function handleCreateCompany() {
    if (!trimmedOrg || exactCompanyMatch || creatingCompany) return
    setCreatingCompany(true)
    try {
      await createCompany({ name: trimmedOrg, website: newOrgWebsite.trim() || undefined })
      setOrgMode('search')
      setNewOrgWebsite('')
      setNewOrgAiSuggested(false)
      setLookupNote(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create company')
    } finally {
      setCreatingCompany(false)
    }
  }

  function handleSelectExistingContact(c: EngagementContact) {
    setSelectedContacts(prev => [...prev, { ...c, id: `lnk_${Date.now()}_${prev.length}`, is_current_point_of_contact: prev.length === 0 }])
    setContactQuery('')
  }

  function handleAddManualContact() {
    if (!canAddContact) return
    setSelectedContacts(prev => [...prev, {
      id: `new_${Date.now()}_${prev.length}`,
      first_name: contactFirstName.trim(),
      last_name: contactLastName.trim(),
      email: contactEmail.trim(),
      phone: contactPhone.trim() || undefined,
      title: contactTitle.trim() || undefined,
      role: 'primary',
      is_current_point_of_contact: prev.length === 0,
      company_id: exactCompanyMatch?.id,
    }])
    setContactFirstName(''); setContactLastName(''); setContactTitle(''); setContactEmail(''); setContactPhone('')
    setContactMode('search')
  }

  function removeSelectedContact(id: string) {
    setSelectedContacts(prev => prev.filter(c => c.id !== id))
  }

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      const contacts = selectedContacts.map(c => ({
        first_name: c.first_name,
        last_name: c.last_name || undefined,
        email: c.email || undefined,
        phone: c.phone || undefined,
        title: c.title || undefined,
        company_id: c.company_id,
        is_current_point_of_contact: c.is_current_point_of_contact,
      }))

      const engagement = await addProspect({
        organization: trimmedOrg,
        company_id: exactCompanyMatch?.id,
        prospect_step: prospectStep,
        source: source.trim() || undefined,
        topic: topic.trim() || undefined,
        event_city: eventCity.trim() || undefined,
        notes: notes.trim() || undefined,
        contacts: contacts.length > 0 ? contacts : undefined,
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
          {/* Organization: search existing or add new */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1.5">Organization</label>

            {exactCompanyMatch ? (
              <div>
                <input
                  id="new-inquiry-organization"
                  value={organization}
                  onChange={e => setOrganization(e.target.value)}
                  placeholder="Canyon Ranch"
                  className="w-full text-sm bg-parchment border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-gold/40 text-ink placeholder:text-ink-300 transition-all"
                />
                <p className="text-[11px] text-sage mt-1.5 flex items-center gap-1">
                  <Check size={11} /> Linked to company record
                </p>
              </div>
            ) : orgMode === 'search' ? (
              <div>
                <input
                  id="new-inquiry-organization"
                  value={organization}
                  onChange={e => setOrganization(e.target.value)}
                  placeholder="Canyon Ranch"
                  className="w-full text-sm bg-parchment border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-gold/40 text-ink placeholder:text-ink-300 transition-all"
                />
                {companyMatches.length > 0 && (
                  <div className="mt-1 border border-ink-100 rounded-lg overflow-hidden bg-white shadow-sm">
                    {companyMatches.map(c => (
                      <button key={c.id} type="button" onClick={() => setOrganization(c.name)}
                        className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-parchment transition-colors">
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => setOrgMode('add')}
                  className="mt-1.5 text-xs text-gold hover:text-gold-dark transition-colors flex items-center gap-1 px-1">
                  <Plus size={11} /> Add new organization
                </button>
              </div>
            ) : (
              <div className="space-y-2 p-3 bg-parchment/60 rounded-lg border border-ink-100">
                <input ref={orgNameInputRef} value={organization} onChange={e => setOrganization(e.target.value)} placeholder="Company name *"
                  className="w-full text-sm text-ink bg-white border border-ink-100 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gold/50 placeholder:text-ink-300" />
                <div className="flex items-center justify-between gap-2">
                  <input
                    value={newOrgWebsite}
                    onChange={e => { setNewOrgWebsite(e.target.value); setNewOrgAiSuggested(false) }}
                    placeholder="Company URL (optional)" type="url"
                    className="flex-1 text-sm text-ink bg-white border border-ink-100 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gold/50 placeholder:text-ink-300" />
                  <button type="button" onClick={handleLookupOrg} disabled={!trimmedOrg || lookingUpOrg}
                    className="flex items-center gap-1 text-[11px] font-medium text-gold hover:text-gold-dark transition-colors flex-shrink-0 disabled:opacity-50">
                    {lookingUpOrg ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                    {lookingUpOrg ? 'Looking up…' : 'Look up with AI'}
                  </button>
                </div>
                {newOrgAiSuggested && (
                  <p className="text-[10px] text-gold-dark bg-gold/10 border border-gold/20 rounded-md px-2 py-1 flex items-center gap-1">
                    <Wand2 size={9} /> AI-suggested — please verify before saving
                  </p>
                )}
                {lookupNote && <p className="text-[11px] text-ink-300 italic">{lookupNote}</p>}
                <div className="flex items-center justify-between pt-1">
                  <button type="button" onClick={() => setOrgMode('search')}
                    className="text-xs text-ink-300 hover:text-ink transition-colors px-1">
                    ‹ Search existing organizations instead
                  </button>
                  <button type="button" onClick={handleCreateCompany} disabled={creatingCompany || !trimmedOrg}
                    className="text-xs font-medium text-ink-400 hover:text-ink border border-ink-200 hover:border-ink-400 bg-white rounded-lg px-3 py-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    {creatingCompany ? 'Adding…' : 'Create organization'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Contact: search existing or add new — supports multiple */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1.5">Contact</label>

            {selectedContacts.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {selectedContacts.map(c => (
                  <div key={c.id} className="flex items-center gap-2.5 bg-parchment border border-ink-100 rounded-lg px-3 py-2">
                    <div className="w-7 h-7 rounded-full bg-ink-800 flex items-center justify-center text-[11px] font-bold text-gold flex-shrink-0">
                      {getInitials(c.first_name, c.last_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink truncate">{c.first_name} {c.last_name}</p>
                      <p className="text-xs text-ink-300 truncate">{c.email}</p>
                    </div>
                    <button onClick={() => removeSelectedContact(c.id)}
                      className="p-1 rounded text-ink-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {contactMode === 'search' ? (
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
                      <button key={h.contact.id} onClick={() => handleSelectExistingContact(h.contact)}
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
                          <button key={h.contact.id} onClick={() => handleSelectExistingContact(h.contact)}
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
                  <input ref={contactFirstNameInputRef} value={contactFirstName} onChange={e => setContactFirstName(e.target.value)} placeholder="First name *"
                    className="text-sm text-ink bg-white border border-ink-100 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gold/50 placeholder:text-ink-300" />
                  <input value={contactLastName} onChange={e => setContactLastName(e.target.value)} placeholder="Last name *"
                    className="text-sm text-ink bg-white border border-ink-100 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gold/50 placeholder:text-ink-300" />
                </div>
                <input value={contactTitle} onChange={e => setContactTitle(e.target.value)} placeholder="Title"
                  className="w-full text-sm text-ink bg-white border border-ink-100 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gold/50 placeholder:text-ink-300" />
                <div className="grid grid-cols-2 gap-2">
                  <input value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="Email *" type="email"
                    className="text-sm text-ink bg-white border border-ink-100 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gold/50 placeholder:text-ink-300" />
                  <input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="Phone" type="tel"
                    className="text-sm text-ink bg-white border border-ink-100 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gold/50 placeholder:text-ink-300" />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <button onClick={() => setContactMode('search')}
                    className="text-xs text-ink-300 hover:text-ink transition-colors px-1">
                    ‹ Search existing contacts instead
                  </button>
                  <button onClick={handleAddManualContact} disabled={!canAddContact}
                    className="text-xs font-medium text-ink-400 hover:text-ink border border-ink-200 hover:border-ink-400 bg-white rounded-lg px-3 py-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    Add contact
                  </button>
                </div>
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
