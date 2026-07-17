'use client'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { Contract, ContractSnapshot } from '@/types'
import { updateContractSnapshot } from '@/lib/contracts-client'

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

function TextAreaField({
  label, value, onChange, placeholder, rows = 2,
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; rows?: number
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1.5">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full text-sm bg-parchment border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-gold/40 text-ink placeholder:text-ink-300 transition-all resize-none"
      />
    </div>
  )
}

interface ContractEditModalProps {
  contract: Contract
  onClose: () => void
  onSaved: (contract: Contract) => void
}

export default function ContractEditModal({ contract, onClose, onSaved }: ContractEditModalProps) {
  const s = contract.snapshot
  const [organization, setOrganization] = useState(s.organization ?? '')
  const [contactFirstName, setContactFirstName] = useState(s.contact_first_name ?? '')
  const [contactLastName, setContactLastName] = useState(s.contact_last_name ?? '')
  const [contactTitle, setContactTitle] = useState(s.contact_title ?? '')
  const [contactEmail, setContactEmail] = useState(s.contact_email ?? '')
  const [contactPhone, setContactPhone] = useState(s.contact_phone ?? '')
  const [contactAddress, setContactAddress] = useState(s.contact_address ?? '')
  const [eventName, setEventName] = useState(s.event_name ?? '')
  const [eventDate, setEventDate] = useState(s.event_date ?? '')
  const [eventCity, setEventCity] = useState(s.event_city ?? '')
  const [eventLocation, setEventLocation] = useState(s.event_location ?? '')
  const [techPlatform, setTechPlatform] = useState(s.tech_platform ?? '')
  const [estimatedAttendees, setEstimatedAttendees] = useState(String(s.estimated_attendees ?? ''))
  const [attendeeLocation, setAttendeeLocation] = useState(s.attendee_location ?? '')
  const [projectScope, setProjectScope] = useState((s.project_scope ?? []).join('\n'))
  const [travelFee, setTravelFee] = useState(s.travel_fee ?? 'TBD')
  const [fee, setFee] = useState(String(s.fee ?? ''))
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const feeNum = parseFloat(fee.replace(/[^0-9.]/g, '')) || 0
      const attendeesNum = parseInt(estimatedAttendees.replace(/[^0-9]/g, ''), 10)
      const patch: Partial<ContractSnapshot> = {
        organization: organization.trim(),
        contact_first_name: contactFirstName.trim() || undefined,
        contact_last_name: contactLastName.trim() || undefined,
        contact_title: contactTitle.trim() || undefined,
        contact_email: contactEmail.trim() || undefined,
        contact_phone: contactPhone.trim() || undefined,
        contact_address: contactAddress.trim() || undefined,
        event_name: eventName.trim() || undefined,
        topic: eventName.trim() || undefined,
        event_date: eventDate || undefined,
        event_city: eventCity.trim() || undefined,
        event_location: eventLocation.trim() || undefined,
        tech_platform: techPlatform.trim() || undefined,
        estimated_attendees: isNaN(attendeesNum) ? undefined : attendeesNum,
        attendee_location: attendeeLocation.trim() || undefined,
        project_scope: projectScope.split('\n').map(x => x.trim()).filter(Boolean),
        travel_fee: travelFee.trim() || 'TBD',
        fee: feeNum,
      }
      const updated = await updateContractSnapshot(contract, patch)
      onSaved(updated)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white border border-ink-100 rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[85vh] overflow-y-auto" onClick={ev => ev.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-ink">Edit Contract Details</h3>
            <p className="text-xs text-ink-300 mt-0.5">{contract.contract_number} — editing the fields used to build the PDF, not the document itself.</p>
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
          <Field label="Contact title" value={contactTitle} onChange={setContactTitle} placeholder="Sr. Director, Health & Performance" />
          <TextAreaField label="Contact address" value={contactAddress} onChange={setContactAddress} placeholder={'200 West Street\nNew York, NY 10282'} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact phone" value={contactPhone} onChange={setContactPhone} placeholder="212-357-7289" />
            <Field label="Contact email" value={contactEmail} onChange={setContactEmail} type="email" />
          </div>
          <Field label="Event name" value={eventName} onChange={setEventName} placeholder="Stress & Energy Reset Retreat" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Event date" value={eventDate} onChange={setEventDate} type="date" />
            <Field label="Event city" value={eventCity} onChange={setEventCity} placeholder="Lenox, MA" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Venue / location" value={eventLocation} onChange={setEventLocation} placeholder="Canyon Ranch Lenox" />
            <Field label="Tech platform" value={techPlatform} onChange={setTechPlatform} placeholder="Zoom" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Estimated attendees" value={estimatedAttendees} onChange={setEstimatedAttendees} placeholder="150" />
            <Field label="Attendee location" value={attendeeLocation} onChange={setAttendeeLocation} placeholder="On-site" />
          </div>
          <TextAreaField
            label="Project scope includes (one item per line)"
            value={projectScope} onChange={setProjectScope}
            placeholder={'60-minute keynote\nQ&A session\nBook signing'}
            rows={3}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Travel fee" value={travelFee} onChange={setTravelFee} placeholder="TBD" />
            <Field label="Services fee" value={fee} onChange={setFee} placeholder="25000" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-6">
          <button onClick={onClose}
            className="text-xs font-medium text-ink-400 hover:text-ink px-4 py-2 rounded-lg hover:bg-parchment transition-all">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-xs font-medium text-white bg-ink hover:bg-ink-700 px-4 py-2 rounded-lg transition-all disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
