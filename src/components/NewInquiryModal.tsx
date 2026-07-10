'use client'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { ProspectStep } from '@/types'

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
  const { addProspect } = useStore()
  const [organization, setOrganization] = useState('')
  const [contactFirstName, setContactFirstName] = useState('')
  const [contactLastName, setContactLastName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [topic, setTopic] = useState('')
  const [eventCity, setEventCity] = useState('')
  const [source, setSource] = useState('')
  const [prospectStep, setProspectStep] = useState<ProspectStep>('inquiry')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSave = organization.trim().length > 0 && !saving

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      const engagement = await addProspect({
        organization: organization.trim(),
        prospect_step: prospectStep,
        source: source.trim() || undefined,
        topic: topic.trim() || undefined,
        event_city: eventCity.trim() || undefined,
        notes: notes.trim() || undefined,
        contact: contactFirstName.trim()
          ? {
              first_name: contactFirstName.trim(),
              last_name: contactLastName.trim() || undefined,
              email: contactEmail.trim() || undefined,
              phone: contactPhone.trim() || undefined,
            }
          : undefined,
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
          <Field label="Organization" value={organization} onChange={setOrganization} placeholder="Canyon Ranch" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact first name" value={contactFirstName} onChange={setContactFirstName} />
            <Field label="Contact last name" value={contactLastName} onChange={setContactLastName} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact email" value={contactEmail} onChange={setContactEmail} type="email" />
            <Field label="Contact phone" value={contactPhone} onChange={setContactPhone} type="tel" />
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
