'use client'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { Invoice, InvoiceSnapshot } from '@/types'
import { updateInvoiceSnapshot } from '@/lib/invoices'

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

interface InvoiceEditModalProps {
  invoice: Invoice
  onClose: () => void
  onSaved: (invoice: Invoice) => void
}

export default function InvoiceEditModal({ invoice, onClose, onSaved }: InvoiceEditModalProps) {
  const s = invoice.snapshot
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
  const [amount, setAmount] = useState(String((invoice.type === 'deposit' ? s.deposit_amount : s.fee) ?? ''))
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const amountNum = parseFloat(amount.replace(/[^0-9.]/g, '')) || 0
      const patch: Partial<InvoiceSnapshot> = {
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
        ...(invoice.type === 'deposit' ? { deposit_amount: amountNum } : { fee: amountNum }),
      }
      const updated = await updateInvoiceSnapshot(invoice, patch)
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
            <h3 className="font-display text-lg font-semibold text-ink">Edit Invoice Details</h3>
            <p className="text-xs text-ink-300 mt-0.5">{invoice.invoice_number} — editing the fields used to build the PDF, not the document itself.</p>
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
          <Field
            label={invoice.type === 'deposit' ? 'Deposit amount' : 'Speaking fee'}
            value={amount} onChange={setAmount} placeholder="1000"
          />
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
