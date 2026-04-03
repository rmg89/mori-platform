'use client'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { useStore } from '@/lib/store'
import { PROSPECT_STEPS, ProspectStep, EngagementCall, CallFormat, CommEntry, primaryContact } from '@/types'
import { formatDate, getInitials } from '@/lib/utils'
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Circle,
  Phone, Edit3, Check, X, Plus
} from 'lucide-react'
import Link from 'next/link'

function formatDT(iso?: string) {
  if (!iso) return null
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

const STEP_COLORS: Record<string, string> = {
  inquiry:    'bg-red-50 text-red-500 border-red-100',
  outreach:   'bg-red-50 text-red-500 border-red-100',
  in_contact: 'bg-gold/10 text-gold border-gold/20',
  confirmed:  'bg-sage/10 text-sage border-sage/20',
  declined:   'bg-parchment text-ink-400 border-ink-200',
}
const STEP_INACTIVE = 'bg-parchment text-ink-300 border-ink-100'

function EditableField({ label, value, onSave, type = 'text', prefix, placeholder }: {
  label: string; value?: string | number | null; onSave: (val: string) => void
  type?: 'text' | 'number' | 'date'; prefix?: string; placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value ?? ''))
  const save = () => { onSave(draft); setEditing(false) }
  const cancel = () => { setDraft(String(value ?? '')); setEditing(false) }

  const displayValue = () => {
    if (!value) return null
    if (type === 'date' && typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Parse as local date to avoid timezone shift
      const [y, m, d] = value.split('-').map(Number)
      const date = new Date(y, m - 1, d)
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    }
    if (prefix && value) return `${prefix}${Number(value).toLocaleString()}`
    return String(value)
  }

  return (
    <div className="group flex items-start gap-2 min-h-[28px]">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-300 w-20 flex-shrink-0 mt-1">{label}</span>
      {editing ? (
        <div className="flex items-center gap-1.5 flex-1">
          {prefix && <span className="text-sm text-ink-400">{prefix}</span>}
          <input autoFocus type={type} value={draft}
            placeholder={placeholder}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
            className="flex-1 text-sm border border-gold/40 rounded-md px-2 py-1 bg-white outline-none focus:border-gold" />
          <button onClick={save} className="text-sage hover:text-sage-dark"><Check size={13} /></button>
          <button onClick={cancel} className="text-ink-300 hover:text-ink-500"><X size={13} /></button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 flex-1">
          <span className="text-sm text-ink">
            {displayValue() ?? <span className="text-ink-200 italic">—</span>}
          </span>
          <button onClick={() => { setDraft(String(value ?? '')); setEditing(true) }}
            className="opacity-0 group-hover:opacity-100 transition-all text-ink-300 hover:text-gold">
            <Edit3 size={11} />
          </button>
        </div>
      )}
    </div>
  )
}

function formatDateDisplay(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function LocationField({ engagementId, city, format }: {
  engagementId: string
  city?: string | null
  format?: string | null
}) {
  const { updateEngagement } = useStore()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(city ?? '')
  const isVirtual = format === 'virtual'

  const save = () => { updateEngagement(engagementId, { event_city: draft }); setEditing(false) }
  const cancel = () => { setDraft(city ?? ''); setEditing(false) }
  const toggleVirtual = () => {
    if (isVirtual) {
      updateEngagement(engagementId, { event_format: undefined as any })
    } else {
      updateEngagement(engagementId, { event_format: 'virtual', event_city: undefined as any })
    }
  }

  return (
    <div className="group flex items-start gap-2 min-h-[28px]">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-300 w-20 flex-shrink-0 mt-1">Location</span>
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <button onClick={toggleVirtual}
            className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded border transition-all ${
              isVirtual ? 'bg-gold/10 text-gold-dark border-gold/20' : 'bg-parchment text-ink-300 border-ink-100 hover:border-ink-300'
            }`}>
            {isVirtual ? <CheckCircle2 size={9} /> : <Circle size={9} />} Virtual
          </button>
        </div>
        {!isVirtual && (
          editing ? (
            <div className="flex items-center gap-1.5">
              <input autoFocus type="text" value={draft} placeholder="City or venue"
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
                className="flex-1 text-sm border border-gold/40 rounded-md px-2 py-1 bg-white outline-none focus:border-gold" />
              <button onClick={save} className="text-sage"><Check size={13} /></button>
              <button onClick={cancel} className="text-ink-300"><X size={13} /></button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-ink">{city || <span className="text-ink-200 italic">—</span>}</span>
              <button onClick={() => { setDraft(city ?? ''); setEditing(true) }}
                className="opacity-0 group-hover:opacity-100 transition-all text-ink-300 hover:text-gold">
                <Edit3 size={11} />
              </button>
            </div>
          )
        )}
      </div>
    </div>
  )
}

function DatesField({ engagementId, proposedDates, confirmedDate, confirmedTime }: {
  engagementId: string
  proposedDates?: { date: string; times?: string[] }[]
  confirmedDate?: string
  confirmedTime?: string
}) {
  const { addProposedDate, removeProposedDate, confirmProposedDate, addProposedTime, removeProposedTime, updateEngagement } = useStore()
  const [addingDate, setAddingDate] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [addingTimeFor, setAddingTimeFor] = useState<string | null>(null)
  const [newTime, setNewTime] = useState('')
  const [editingConfirmed, setEditingConfirmed] = useState(false)
  const [confirmedDraft, setConfirmedDraft] = useState(confirmedDate ?? '')
  const hasProposed = proposedDates && proposedDates.length > 0

  return (
    <div className="space-y-2">
      {confirmedDate ? (
        <div className="group flex items-start gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-300 w-20 flex-shrink-0 mt-1">Confirmed</span>
          {editingConfirmed ? (
            <div className="flex items-center gap-1.5 flex-1">
              <input autoFocus type="date" value={confirmedDraft}
                onChange={e => setConfirmedDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { updateEngagement(engagementId, { event_date: confirmedDraft }); setEditingConfirmed(false) }
                  if (e.key === 'Escape') { setConfirmedDraft(confirmedDate); setEditingConfirmed(false) }
                }}
                className="flex-1 text-sm border border-gold/40 rounded-md px-2 py-1 bg-white outline-none focus:border-gold" />
              <button onClick={() => { updateEngagement(engagementId, { event_date: confirmedDraft }); setEditingConfirmed(false) }} className="text-sage"><Check size={13} /></button>
              <button onClick={() => { setConfirmedDraft(confirmedDate); setEditingConfirmed(false) }} className="text-ink-300"><X size={13} /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <div>
                <span className="text-sm font-medium text-sage-dark">{formatDateDisplay(confirmedDate)}</span>
                {confirmedTime && <span className="text-sm text-ink-500 ml-2">{confirmedTime}</span>}
              </div>
              <button onClick={() => { setConfirmedDraft(confirmedDate); setEditingConfirmed(true) }}
                className="opacity-0 group-hover:opacity-100 transition-all text-ink-300 hover:text-gold">
                <Edit3 size={11} />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-300 w-20 flex-shrink-0 mt-1">
            {hasProposed ? 'Proposed' : 'Date'}
          </span>
          <div className="flex-1 space-y-2">
            {hasProposed && proposedDates.map(entry => (
              <div key={entry.date} className="group/date space-y-1">
                {/* Date row */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink">{formatDateDisplay(entry.date)}</span>
                  <button
                    onClick={() => confirmProposedDate(engagementId, entry.date)}
                    className="opacity-0 group-hover/date:opacity-100 text-[10px] font-semibold text-sage-dark bg-sage/10 border border-sage/20 px-2 py-0.5 rounded-md hover:bg-sage/20 transition-all">
                    Confirm
                  </button>
                  <button
                    onClick={() => removeProposedDate(engagementId, entry.date)}
                    className="opacity-0 group-hover/date:opacity-100 text-ink-200 hover:text-red-400 transition-all ml-auto">
                    <X size={11} />
                  </button>
                </div>
                {/* Time slots */}
                <div className="pl-2 space-y-0.5">
                  {(entry.times ?? []).map(time => (
                    <div key={time} className="group/time flex items-center gap-2">
                      <span className="text-xs text-ink-500">{time}</span>
                      <button
                        onClick={() => confirmProposedDate(engagementId, entry.date, time)}
                        className="opacity-0 group-hover/time:opacity-100 text-[10px] font-semibold text-sage-dark bg-sage/10 border border-sage/20 px-1.5 py-0.5 rounded hover:bg-sage/20 transition-all">
                        Confirm
                      </button>
                      <button
                        onClick={() => removeProposedTime(engagementId, entry.date, time)}
                        className="opacity-0 group-hover/time:opacity-100 text-ink-200 hover:text-red-400 transition-all">
                        <X size={9} />
                      </button>
                    </div>
                  ))}
                  {/* Add time slot */}
                  {addingTimeFor === entry.date ? (
                    <div className="flex items-center gap-1.5 mt-1">
                      <input autoFocus type="text" value={newTime}
                        placeholder="e.g. 10–10:45am EST"
                        onChange={e => setNewTime(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && newTime) { addProposedTime(engagementId, entry.date, newTime); setNewTime(''); setAddingTimeFor(null) }
                          if (e.key === 'Escape') { setNewTime(''); setAddingTimeFor(null) }
                        }}
                        className="text-xs border border-gold/40 rounded px-2 py-1 bg-white outline-none focus:border-gold flex-1" />
                      <button onClick={() => { if (newTime) { addProposedTime(engagementId, entry.date, newTime); setNewTime('') }; setAddingTimeFor(null) }} className="text-sage"><Check size={11} /></button>
                      <button onClick={() => { setNewTime(''); setAddingTimeFor(null) }} className="text-ink-300"><X size={11} /></button>
                    </div>
                  ) : (
                    <button onClick={() => setAddingTimeFor(entry.date)}
                      className="text-[10px] text-ink-300 hover:text-gold transition-all flex items-center gap-0.5 mt-0.5">
                      <Plus size={9} /> Add time
                    </button>
                  )}
                </div>
              </div>
            ))}
            {/* Add date */}
            {addingDate ? (
              <div className="flex items-center gap-1.5">
                <input autoFocus type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newDate) { addProposedDate(engagementId, newDate); setNewDate(''); setAddingDate(false) }
                    if (e.key === 'Escape') { setNewDate(''); setAddingDate(false) }
                  }}
                  className="text-sm border border-gold/40 rounded-md px-2 py-1 bg-white outline-none focus:border-gold" />
                <button onClick={() => { if (newDate) { addProposedDate(engagementId, newDate); setNewDate('') }; setAddingDate(false) }} className="text-sage"><Check size={13} /></button>
                <button onClick={() => { setNewDate(''); setAddingDate(false) }} className="text-ink-300"><X size={13} /></button>
              </div>
            ) : (
              <button onClick={() => setAddingDate(true)}
                className="flex items-center gap-1 text-[11px] text-ink-300 hover:text-gold transition-all">
                <Plus size={10} /> Add date
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function EditableNotes({ value, onSave }: { value?: string | null; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const save = () => { onSave(draft); setEditing(false) }
  const cancel = () => { setDraft(value ?? ''); setEditing(false) }
  if (editing) return (
    <div className="space-y-2">
      <textarea autoFocus value={draft} onChange={e => setDraft(e.target.value)} rows={4}
        className="w-full text-sm border border-gold/40 rounded-lg px-3 py-2 bg-white outline-none focus:border-gold resize-none" />
      <div className="flex gap-2">
        <button onClick={save} className="text-xs font-medium text-white bg-ink px-3 py-1.5 rounded-lg hover:bg-ink-700 transition-all">Save</button>
        <button onClick={cancel} className="text-xs font-medium text-ink-400 px-3 py-1.5 rounded-lg hover:text-ink transition-all">Cancel</button>
      </div>
    </div>
  )
  return (
    <div className="group relative">
      <p className="text-sm text-ink-600 leading-relaxed pr-6">{value || <span className="text-ink-200 italic">No notes yet</span>}</p>
      <button onClick={() => { setDraft(value ?? ''); setEditing(true) }}
        className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-all text-ink-300 hover:text-gold">
        <Edit3 size={12} />
      </button>
    </div>
  )
}

function LogCommPanel({ engagementId, onClose }: { engagementId: string; onClose: () => void }) {
  const { addComm } = useStore()
  const [type, setType] = useState<'note' | 'call' | 'email_outbound'>('note')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const submit = () => {
    if (!body.trim()) return
    addComm(engagementId, {
      id: `cm_${Date.now()}`, type, date: new Date().toISOString(),
      subject: subject || undefined, body,
      from_name: "Mori's Team", staff_name: 'Ryan G.', needs_response: false,
    })
    onClose()
  }
  return (
    <div className="bg-parchment/60 border border-ink-100 rounded-xl p-4 mt-4 space-y-3">
      <div className="flex gap-2">
        {(['note', 'call', 'email_outbound'] as const).map(t => (
          <button key={t} onClick={() => setType(t)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${type === t ? 'bg-ink text-cream border-ink' : 'bg-white text-ink-400 border-ink-100 hover:border-ink-300'}`}>
            {t === 'note' ? 'Note' : t === 'call' ? 'Call' : 'Email Sent'}
          </button>
        ))}
      </div>
      <input type="text" placeholder="Subject (optional)" value={subject} onChange={e => setSubject(e.target.value)}
        className="w-full text-sm border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-gold bg-white" />
      <textarea placeholder="Notes..." value={body} onChange={e => setBody(e.target.value)} rows={3}
        className="w-full text-sm border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-gold resize-none bg-white" />
      <div className="flex gap-2">
        <button onClick={submit} className="text-xs font-medium text-white bg-ink px-4 py-2 rounded-lg hover:bg-ink-700 transition-all">Log</button>
        <button onClick={onClose} className="text-xs font-medium text-ink-400 px-4 py-2 rounded-lg hover:text-ink transition-all">Cancel</button>
      </div>
    </div>
  )
}

function CallRow({ call, engagementId, label }: {
  call: EngagementCall; engagementId: string; label: string
}) {
  const { updateCall } = useStore()
  const [scheduling, setScheduling] = useState(false)
  const [schedDate, setSchedDate] = useState('')
  const [schedTime, setSchedTime] = useState('')
  const [format, setFormat] = useState<'phone' | 'video' | 'in_person'>('video')
  const [details, setDetails] = useState(call.details ?? '')

  const saveSchedule = () => {
    const scheduled_at = schedDate ? `${schedDate}T${schedTime || '00:00'}:00Z` : undefined
    updateCall(engagementId, call.id, { status: 'scheduled', scheduled_at, format, details: details || undefined })
    setScheduling(false)
  }

  const handleStatusClick = (s: 'requested' | 'scheduled' | 'completed') => {
    if (s === 'scheduled' && call.status !== 'scheduled') {
      setScheduling(true)
      return
    }
    if (s === 'completed') {
      updateCall(engagementId, call.id, { status: 'completed', completed_at: new Date().toISOString() })
      return
    }
    updateCall(engagementId, call.id, { status: s })
  }

  const formatIcon = call.format === 'phone' ? '📞' : call.format === 'in_person' ? '📍' : '🎥'

  return (
    <div className="border border-ink-50 rounded-xl p-3 space-y-2.5">
      {/* Header row */}
      <div className="flex items-center gap-3">
        <Phone size={12} className="text-ink-300 flex-shrink-0" />
        <span className="text-sm font-medium text-ink flex-1">{label}</span>
        <div className="flex gap-1.5">
          {(['requested', 'scheduled', 'completed'] as const).map(s => (
            <button key={s} onClick={() => handleStatusClick(s)}
              className={`text-[10px] font-semibold px-2 py-1 rounded-md border capitalize transition-all ${
                call.status === s
                  ? s === 'completed' ? 'bg-sage/10 text-sage border-sage/20'
                    : s === 'scheduled' ? 'bg-gold/10 text-gold-dark border-gold/20'
                    : 'bg-parchment text-ink-400 border-ink-200'
                  : 'bg-transparent text-ink-200 border-ink-100 hover:border-ink-300 hover:text-ink-400'
              }`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Timestamps */}
      <div className="flex gap-4 text-[10px] text-ink-300 pl-5">
        {call.requested_at && (
          <span>Requested: <span className="text-ink-500">{formatDT(call.requested_at)}</span></span>
        )}
        {call.scheduled_at && (
          <span className="flex items-center gap-1">
            {formatIcon} Scheduled: <span className="text-gold-dark font-medium">{formatDT(call.scheduled_at)}</span>
          </span>
        )}
        {call.completed_at && (
          <span>Completed: <span className="text-sage-dark font-medium">{formatDT(call.completed_at)}</span></span>
        )}
      </div>

      {/* Existing details */}
      {call.details && !scheduling && (
        <div className="pl-5 text-[11px] text-ink-400 bg-parchment/60 rounded-lg px-3 py-2">
          {call.details}
        </div>
      )}

      {/* Inline scheduling form */}
      {scheduling && (
        <div className="pl-5 space-y-2.5 border-t border-ink-50 pt-2.5">
          <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Schedule this call</p>
          <div className="flex gap-2">
            <input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)}
              className="text-sm border border-ink-100 rounded-lg px-3 py-1.5 outline-none focus:border-gold bg-white flex-1" />
            <input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)}
              className="text-sm border border-ink-100 rounded-lg px-3 py-1.5 outline-none focus:border-gold bg-white w-32" />
          </div>
          <div className="flex gap-2">
            {(['phone', 'video', 'in_person'] as const).map(f => (
              <button key={f} onClick={() => setFormat(f)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                  format === f ? 'bg-ink text-cream border-ink' : 'bg-white text-ink-400 border-ink-100 hover:border-ink-300'
                }`}>
                {f === 'in_person' ? 'In Person' : f === 'video' ? 'Video' : 'Phone'}
              </button>
            ))}
          </div>
          <textarea value={details} onChange={e => setDetails(e.target.value)}
            placeholder="Link, phone number, who's calling, any other details..."
            rows={2}
            className="w-full text-sm border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-gold resize-none bg-white" />
          <div className="flex gap-2">
            <button onClick={saveSchedule}
              className="text-xs font-medium text-white bg-ink px-4 py-1.5 rounded-lg hover:bg-ink-700 transition-all">
              Save
            </button>
            <button onClick={() => setScheduling(false)}
              className="text-xs font-medium text-ink-400 px-4 py-1.5 rounded-lg hover:text-ink transition-all">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function AddCallPanel({ engagementId, existingCalls, onClose }: {
  engagementId: string; existingCalls?: EngagementCall[]; onClose: () => void
}) {
  const { addCall } = useStore()
  const [callType, setCallType] = useState<'discovery' | 'mori'>('discovery')
  const [status, setStatus] = useState<'requested' | 'scheduled'>('requested')
  const [date, setDate] = useState('')
  const submit = () => {
    const sameType = (existingCalls ?? []).filter(c => c.type === callType)
    addCall(engagementId, {
      id: `call_${Date.now()}`, type: callType, status, number: sameType.length + 1,
      scheduled_at: status === 'scheduled' ? date + 'T00:00:00Z' : undefined, added_by: 'manual',
    })
    onClose()
  }
  return (
    <div className="bg-parchment/60 border border-ink-100 rounded-xl p-4 mt-2 space-y-3">
      <div className="flex gap-2">
        {(['discovery', 'mori'] as const).map(t => (
          <button key={t} onClick={() => setCallType(t)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${callType === t ? 'bg-ink text-cream border-ink' : 'bg-white text-ink-400 border-ink-100 hover:border-ink-300'}`}>
            {t === 'discovery' ? 'Discovery Call' : 'Mori Call'}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        {(['requested', 'scheduled'] as const).map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border capitalize transition-all ${status === s ? 'bg-gold/10 text-gold-dark border-gold/20' : 'bg-white text-ink-400 border-ink-100 hover:border-ink-300'}`}>
            {s}
          </button>
        ))}
      </div>
      {status === 'scheduled' && (
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="w-full text-sm border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-gold bg-white" />
      )}
      <div className="flex gap-2">
        <button onClick={submit} className="text-xs font-medium text-white bg-ink px-4 py-2 rounded-lg hover:bg-ink-700 transition-all">Add</button>
        <button onClick={onClose} className="text-xs font-medium text-ink-400 px-4 py-2 rounded-lg hover:text-ink transition-all">Cancel</button>
      </div>
    </div>
  )
}

export default function ProspectDetailPage() {
  const { id } = useParams()
  const { engagements: allEngagements, setProspectStep, updateEngagement, updateCall } = useStore()
  const [showLogComm, setShowLogComm] = useState(false)
  const [showAddCall, setShowAddCall] = useState(false)

  const e = allEngagements.find(e => e.id === id)
  if (!e) return <div className="p-8 text-ink-400">Not found</div>

  const currentStep = e.prospect_step ?? 'inquiry'
  const entrySteps = ['inquiry', 'outreach']
  const middleSteps = ['in_contact']
  const terminalSteps = ['confirmed', 'declined']

  const isActive = (stepId: string) => stepId === currentStep
  const isPast = (stepId: string) => {
    const order = ['inquiry', 'outreach', 'in_contact', 'confirmed', 'declined']
    const currentIdx = order.indexOf(currentStep)
    const stepIdx = order.indexOf(stepId)
    if (entrySteps.includes(stepId) && middleSteps.concat(terminalSteps).includes(currentStep)) return true
    return stepIdx < currentIdx && !entrySteps.includes(stepId)
  }
  const stepClass = (stepId: string) => {
    if (isActive(stepId)) return STEP_COLORS[stepId] ?? STEP_INACTIVE
    if (isPast(stepId)) return 'bg-sage/8 text-sage border-sage/20 opacity-60'
    return STEP_INACTIVE
  }

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fade-in">
      <Link href="/prospects" className="flex items-center gap-2 text-sm text-ink-400 hover:text-ink mb-6 transition-all">
        <ArrowLeft size={14} /> Back to Prospects
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">{e.event_name || e.organization}</h1>
          <p className="text-ink-400 text-sm mt-1">{e.organization}{e.booker_name && ` · via ${e.booker_name}`}</p>
          <div className="accent-line mt-3 w-24" />
        </div>
      </div>

      {/* Pipeline stage */}
      <div className="bg-white border border-ink-100 rounded-xl p-5 mb-6">
        <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Prospect Stage</p>

        <table className="w-full border-collapse">
          {/* Row 1: the pipeline — In Contact always on this row */}
          <tr>
            <td className="pr-2 align-middle">
              <div className="flex flex-col gap-2">
                {entrySteps.map(stepId => {
                  const step = PROSPECT_STEPS.find(s => s.id === stepId)
                  if (!step) return null
                  return (
                    <button key={stepId} onClick={() => setProspectStep(e.id, stepId as ProspectStep)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all hover:opacity-80 ${stepClass(stepId)}`}>
                      {isActive(stepId) ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                      {step.label}
                    </button>
                  )
                })}
              </div>
            </td>
            <td className="px-1 align-middle text-center text-ink-200 whitespace-nowrap">
              <div>↘</div><div>↗</div>
            </td>
            <td className="align-middle w-full px-1">
              {/* Initial + last contact dates above In Contact */}
              {e.comms && e.comms.length > 0 && (() => {
                const sorted = [...e.comms].sort((a, b) => a.date > b.date ? 1 : -1)
                const first = sorted[0]
                const last = sorted[sorted.length - 1]
                return (
                  <div className="flex justify-between text-[9px] text-ink-300 mb-1 px-1">
                    <span>Initial: {formatDT(first.date)}</span>
                    <span>Most Recent: {formatDT(last.date)}</span>
                  </div>
                )
              })()}
              <button onClick={() => setProspectStep(e.id, 'in_contact')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all hover:opacity-80 w-full justify-center ${stepClass('in_contact')}`}>
                {isActive('in_contact') || isPast('in_contact') ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                In Contact
              </button>
            </td>
            <td className="px-1 align-middle text-center text-ink-200 whitespace-nowrap">
              <div>↗</div><div>↘</div>
            </td>
            <td className="pl-2 align-middle">
              <div className="flex flex-col gap-2">
                {terminalSteps.map(stepId => {
                  const step = PROSPECT_STEPS.find(s => s.id === stepId)
                  if (!step) return null
                  const ts = stepId === 'confirmed' ? e.confirmed_at : stepId === 'declined' ? e.declined_at : undefined
                  return (
                    <div key={stepId} className="flex flex-col items-stretch gap-0.5">
                      <button onClick={() => { setProspectStep(e.id, stepId as ProspectStep); if (stepId === 'confirmed') updateEngagement(e.id, { confirmed_at: new Date().toISOString() }); if (stepId === 'declined') updateEngagement(e.id, { declined_at: new Date().toISOString() }) }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all hover:opacity-80 ${stepClass(stepId)}`}>
                        {isActive(stepId) ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                        {step.label}
                      </button>
                      {ts && <span className="text-[9px] text-ink-300 text-center">{formatDT(ts)}</span>}
                    </div>
                  )
                })}
              </div>
            </td>
          </tr>

          {/* Call rows — empty first cell mirrors entry col, call spans middle col */}
          {e.calls && e.calls.map(call => {
            const typeLabel = call.type === 'discovery' ? 'Discovery Call' : 'Mori Call'
            const num = call.number > 1 ? ` #${call.number}` : ''
            const callSteps: { id: 'requested' | 'scheduled' | 'completed'; label: string }[] = [
              { id: 'requested', label: 'Requested' },
              { id: 'scheduled', label: 'Scheduled' },
              { id: 'completed', label: 'Completed' },
            ]
            const activeIdx = callSteps.findIndex(s => s.id === call.status)
            return (
              <tr key={call.id}>
                <td /><td />
                <td className="pt-2 px-1">
                  <p className="text-[9px] font-medium text-ink-400 flex items-center gap-1 mb-1.5">
                    <Phone size={8} />{typeLabel}{num}
                  </p>
                  <div className="flex items-center w-full">
                    {callSteps.map((step, i) => {
                      const isPastStep = i < activeIdx
                      const isActiveStep = i === activeIdx
                      const ts = step.id === 'requested' ? call.requested_at
                        : step.id === 'scheduled' ? call.scheduled_at
                        : call.completed_at
                      return (
                        <div key={step.id} className={`flex items-center ${i < callSteps.length - 1 ? 'flex-1' : ''}`}>
                          <div className="flex flex-col items-center gap-0.5">
                            <button
                              onClick={() => updateCall(e.id, call.id, {
                                status: step.id,
                                ...(step.id === 'completed' ? { completed_at: new Date().toISOString() } : {}),
                              })}
                              className="group/step"
                            >
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                                isPastStep || isActiveStep ? 'border-sage bg-sage/10' : 'border-ink-200 bg-white group-hover/step:border-ink-400'
                              }`}>
                                {(isPastStep || isActiveStep) && <CheckCircle2 size={8} className="text-sage" />}
                              </div>
                            </button>
                            <span className={`text-[9px] leading-tight whitespace-nowrap ${isActiveStep ? 'text-ink font-medium' : isPastStep ? 'text-sage-dark' : 'text-ink-300'}`}>
                              {step.label}
                            </span>
                            {ts && (
                              <span className="text-[8px] text-ink-300 whitespace-nowrap leading-tight">
                                {formatDT(ts)}
                              </span>
                            )}
                          </div>
                          {i < callSteps.length - 1 && (
                            <div className={`flex-1 h-px mb-6 ${isPastStep ? 'bg-sage/40' : 'bg-ink-100'}`} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </td>
                <td /><td />
              </tr>
            )
          })}
        </table>
      </div>

      {e.alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {e.alerts.map((alert, i) => (
            <div key={i} className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium ${alert.severity === 'high' ? 'text-red-500 bg-red-50 border-red-100' : 'text-gold bg-gold/8 border-gold/20'}`}>
              <AlertTriangle size={14} />{alert.label}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Event details — editable */}
        <div className="bg-white border border-ink-100 rounded-xl p-5">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Event Details</p>
          <div className="space-y-3">
            <EditableField label="Topic" value={e.topic} onSave={v => updateEngagement(e.id, { topic: v })} />
            <DatesField engagementId={e.id} proposedDates={e.proposed_dates} confirmedDate={e.event_date} confirmedTime={e.event_time} />
            <LocationField engagementId={e.id} city={e.event_city} format={e.event_format} />
            <EditableField label="Audience" value={e.audience_size} onSave={v => updateEngagement(e.id, { audience_size: Number(v) })} type="number" />
          </div>
        </div>

        {/* Contacts */}
        <div className="bg-white border border-ink-100 rounded-xl p-5">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Contacts</p>
          <div className="space-y-3">
            {e.contacts.map(c => (
              <div key={c.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-ink-800 flex items-center justify-center text-xs font-bold text-gold flex-shrink-0">
                  {getInitials(c.first_name, c.last_name)}
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">{c.first_name} {c.last_name}</p>
                  <p className="text-xs text-ink-400">{c.title} · {c.role}</p>
                  <p className="text-xs text-ink-300">{c.email}</p>
                </div>
                {c.is_current_point_of_contact && (
                  <span className="ml-auto text-[10px] text-gold bg-gold/10 px-2 py-0.5 rounded-full border border-gold/20 flex-shrink-0">POC</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white border border-ink-100 rounded-xl p-5 mb-6">
        <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-3">Notes</p>
        <EditableNotes value={e.notes} onSave={v => updateEngagement(e.id, { notes: v })} />
      </div>

      {/* Calls */}
      <div className="bg-white border border-ink-100 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium">Calls</p>
          <button onClick={() => setShowAddCall(!showAddCall)}
            className="flex items-center gap-1 text-xs font-medium text-gold hover:text-gold-dark transition-all">
            <Plus size={12} /> Add Call
          </button>
        </div>
        {e.calls && e.calls.length > 0 ? (
          <div className="space-y-3">
            {e.calls.map(call => {
              const typeLabel = call.type === 'discovery' ? 'Discovery Call' : 'Mori Call'
              const num = call.number > 1 ? ` #${call.number}` : ''
              return (
                <CallRow key={call.id} call={call} engagementId={e.id}
                  label={typeLabel + num} />
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-ink-200 italic">No calls logged yet</p>
        )}
        {showAddCall && <AddCallPanel engagementId={e.id} existingCalls={e.calls} onClose={() => setShowAddCall(false)} />}
      </div>


      {/* Timeline */}
      <div className="bg-white border border-ink-100 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium">Timeline</p>
          <button onClick={() => setShowLogComm(!showLogComm)}
            className="flex items-center gap-1 text-xs font-medium text-gold hover:text-gold-dark transition-all">
            <Plus size={12} /> Log Activity
          </button>
        </div>
        {showLogComm && <LogCommPanel engagementId={e.id} onClose={() => setShowLogComm(false)} />}
        <div className="space-y-4 mt-4">
          {[...e.comms].reverse().map(comm => (
            <div key={comm.id} className={`flex gap-3 ${comm.type === 'email_outbound' ? 'flex-row-reverse' : ''}`}>
              <div className={`text-xs px-3 py-2 rounded-xl max-w-lg ${
                comm.type === 'email_outbound' ? 'bg-ink text-cream ml-auto'
                : comm.type === 'stage_change' ? 'bg-parchment text-ink-400 italic'
                : 'bg-parchment text-ink'
              }`}>
                {comm.subject && <p className="font-semibold mb-1">{comm.subject}</p>}
                <p className="whitespace-pre-line">{comm.body}</p>
                <p className="text-[10px] opacity-60 mt-1">{comm.from_name} · {formatDate(comm.date, 'MMM d, h:mm a')}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}