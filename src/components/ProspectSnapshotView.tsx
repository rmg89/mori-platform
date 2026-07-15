'use client'
import { Engagement, EngagementCall, EngagementContact, CommEntry } from '@/types'
import { formatDate, formatCurrency, getInitials } from '@/lib/utils'
import { History, Phone } from 'lucide-react'
import StageHistoryNav from './StageHistoryNav'

const STEP_LABELS: Record<string, string> = {
  inquiry: 'Inquiry', outreach: 'Outreach', in_contact: 'In Contact', confirmed: 'Confirmed', declined: 'Declined',
}

function str(snap: Record<string, unknown>, key: string): string | undefined {
  const v = snap[key]
  return typeof v === 'string' && v ? v : undefined
}
function num(snap: Record<string, unknown>, key: string): number | undefined {
  const v = snap[key]
  return typeof v === 'number' ? v : undefined
}
function list<T>(snap: Record<string, unknown>, key: string): T[] {
  const v = snap[key]
  return Array.isArray(v) ? (v as T[]) : []
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-300 w-20 flex-shrink-0 mt-0.5">{label}</span>
      <span className="text-sm text-ink flex-1">{value}</span>
    </div>
  )
}

// Read-only reconstruction of the Prospects-stage page, sourced from the frozen
// prospect_snapshot captured when this record left the Prospects stage
// (confirmProspect / declineProspect in src/lib/store.tsx) — not live fields,
// which keep changing after the record moves on.
export default function ProspectSnapshotView({ engagement: e }: { engagement: Engagement }) {
  const snap = e.prospect_snapshot ?? {}
  const contacts = list<EngagementContact>(snap, 'contacts')
  const calls = list<EngagementCall>(snap, 'calls')
  const comms = list<CommEntry>(snap, 'comms')
  const proposedDates = list<{ date: string; times?: string[] }>(snap, 'proposed_dates')
  const prospectStep = str(snap, 'prospect_step')
  const source = str(snap, 'source')
  const notes = str(snap, 'notes')
  const eventDate = str(snap, 'event_date')
  const eventCity = str(snap, 'event_city')
  const fee = num(snap, 'fee')
  const topic = str(snap, 'topic')
  const audienceSize = num(snap, 'audience_size')
  const eventFormat = str(snap, 'event_format')

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fade-in">
      <div className="mb-6">
        <StageHistoryNav engagement={e} current="prospects" />
      </div>

      <div className="mb-6">
        <h1 className="font-display text-3xl font-semibold text-ink">{e.event_name || e.organization}</h1>
        <p className="text-ink-400 text-sm mt-1">{e.organization}{e.booker_name ? ` · via ${e.booker_name}` : ''}</p>
        <div className="accent-line mt-3 w-24" />
      </div>

      <div className="flex items-center gap-2 mb-6 px-4 py-3 rounded-xl border bg-parchment/60 border-ink-100 text-ink-400 text-xs">
        <History size={13} className="flex-shrink-0" />
        Read-only snapshot of the Prospects stage, frozen when this record moved on — for reference only.
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-ink-100 rounded-xl p-5">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Pipeline</p>
          <div className="space-y-2">
            <Row label="Stage" value={prospectStep ? (STEP_LABELS[prospectStep] ?? prospectStep) : undefined} />
            <Row label="Source" value={source} />
          </div>
        </div>
        <div className="bg-white border border-ink-100 rounded-xl p-5">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Event Details</p>
          <div className="space-y-2">
            <Row label="Topic" value={topic} />
            <Row label="Target Date" value={eventDate ? formatDate(eventDate) : undefined} />
            <Row label="City" value={eventCity} />
            <Row label="Format" value={eventFormat} />
            <Row label="Audience" value={audienceSize ? audienceSize.toLocaleString() : undefined} />
            <Row label="Fee" value={fee ? formatCurrency(fee) : undefined} />
          </div>
        </div>
      </div>

      {proposedDates.length > 0 && (
        <div className="bg-white border border-ink-100 rounded-xl p-5 mb-6">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-3">Proposed Dates</p>
          <div className="space-y-1 text-sm text-ink">
            {proposedDates.map((d, i) => (
              <p key={i}>{formatDate(d.date)}{d.times?.length ? ` · ${d.times.join(', ')}` : ''}</p>
            ))}
          </div>
        </div>
      )}

      {contacts.length > 0 && (
        <div className="bg-white border border-ink-100 rounded-xl p-5 mb-6">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Contacts</p>
          <div className="space-y-3">
            {contacts.map(c => (
              <div key={c.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-ink-800 flex items-center justify-center text-xs font-bold text-gold flex-shrink-0">
                  {getInitials(c.first_name, c.last_name)}
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">{c.first_name} {c.last_name}</p>
                  <p className="text-xs text-ink-400">{c.title}{c.title && c.role ? ' · ' : ''}{c.role}</p>
                  <p className="text-xs text-ink-300">{c.email}</p>
                </div>
                {c.is_current_point_of_contact && (
                  <span className="ml-auto text-[10px] text-gold bg-gold/10 px-2 py-0.5 rounded-full border border-gold/20 flex-shrink-0">POC</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {notes && (
        <div className="bg-white border border-ink-100 rounded-xl p-5 mb-6">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-3">Notes</p>
          <p className="text-sm text-ink whitespace-pre-line">{notes}</p>
        </div>
      )}

      {calls.length > 0 && (
        <div className="bg-white border border-ink-100 rounded-xl p-5 mb-6">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Calls</p>
          <div className="space-y-2">
            {calls.map(call => (
              <div key={call.id} className="flex items-center gap-2 text-sm">
                <Phone size={11} className="text-ink-300 flex-shrink-0" />
                <span className="text-ink">{call.type === 'discovery' ? 'Discovery Call' : 'Mori Call'}{call.number > 1 ? ` #${call.number}` : ''}</span>
                <span className="text-ink-300 ml-auto capitalize">{call.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {comms.length > 0 && (
        <div className="bg-white border border-ink-100 rounded-xl p-5">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Timeline</p>
          <div className="space-y-4">
            {[...comms].reverse().map(comm => (
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
      )}
    </div>
  )
}
