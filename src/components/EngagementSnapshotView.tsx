'use client'
import { Engagement, OutgoingMaterial, IncomingMaterial, BriefingNote } from '@/types'
import { formatDate, getInitials } from '@/lib/utils'
import {
  History, CheckCircle2, Circle, FileText, Receipt, Mic, Newspaper, Users, Radio,
  Calendar, Clock, MapPin,
} from 'lucide-react'
import StageHistoryNav from './StageHistoryNav'

function eventTypeIcon(type: string) {
  const cls = 'text-ink-300'
  if (type === 'podcast')    return <Mic size={14} className={cls} />
  if (type === 'interview')  return <Newspaper size={14} className={cls} />
  if (type === 'panel')      return <Users size={14} className={cls} />
  if (type === 'livestream') return <Radio size={14} className={cls} />
  return <FileText size={14} className={cls} />
}
function eventTypeLabel(type: string) {
  const map: Record<string, string> = {
    speaking: 'Speaking Engagement', podcast: 'Podcast', interview: 'Interview',
    panel: 'Panel', livestream: 'Livestream',
  }
  return map[type] || 'Engagement'
}

function str(snap: Record<string, unknown>, key: string): string | undefined {
  const v = snap[key]
  return typeof v === 'string' && v ? v : undefined
}
function num(snap: Record<string, unknown>, key: string): number | undefined {
  const v = snap[key]
  return typeof v === 'number' ? v : undefined
}
function bool(snap: Record<string, unknown>, key: string): boolean | undefined {
  const v = snap[key]
  return typeof v === 'boolean' ? v : undefined
}
function list<T>(snap: Record<string, unknown>, key: string): T[] {
  const v = snap[key]
  return Array.isArray(v) ? (v as T[]) : []
}

function ProgressTile({ label, complete, sub }: { label: string; complete: boolean; sub: string }) {
  return (
    <div className="flex-1 flex flex-col gap-1.5 px-4 py-3.5 border-r border-ink-100 last:border-r-0">
      <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${complete ? 'text-ink-200' : 'text-ink-400'}`}>{label}</span>
      <div className="flex items-center gap-1.5">
        {complete
          ? <CheckCircle2 size={12} className="text-sage/60 flex-shrink-0" />
          : <Circle size={12} className="text-ink-200 flex-shrink-0" />}
        <span className={`text-sm font-medium ${complete ? 'text-ink-300' : 'text-ink'}`}>{sub}</span>
      </div>
    </div>
  )
}

function BSectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="h-px flex-1 bg-gold/25" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-gold">{children}</span>
      <div className="h-px flex-1 bg-gold/25" />
    </div>
  )
}

function BRow({ label, value, multiline }: { label: string; value?: string; multiline?: boolean }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-300 w-24 flex-shrink-0 mt-0.5">{label}</span>
      <span className={`text-sm text-ink flex-1 ${multiline ? 'whitespace-pre-line' : ''}`}>{value}</span>
    </div>
  )
}

// Read-only reconstruction of the Engagements-stage page, sourced from the frozen
// engagement_snapshot captured when this record left the Engagements stage
// (moveToWrapUp in src/lib/store.tsx) — not live fields, which keep changing
// after the record moves on. Mirrors the layout of the live engagements/[id]
// page so it reads as the same page, just frozen. Event details, contacts, and
// timeline come from the live record since those aren't stage-specific data
// (never reset between stages) and engagement_snapshot doesn't capture them.
export default function EngagementSnapshotView({ engagement: e }: { engagement: Engagement }) {
  const snap = e.engagement_snapshot ?? {}
  const outgoingMaterials = list<OutgoingMaterial>(snap, 'outgoing_materials')
  const incomingMaterials = list<IncomingMaterial>(snap, 'incoming_materials')
  const briefingNotes = list<BriefingNote>(snap, 'briefing_notes')
  const runOfShow = list<{ date?: string; time: string; end_time?: string; what: string; notes?: string }>(snap, 'run_of_show')

  const contractRequired = bool(snap, 'contract_required')
  const contractSentAt = str(snap, 'contract_sent_at')
  const contractSignedAt = str(snap, 'contract_signed_at')
  const briefingComplete = bool(snap, 'briefing_complete') ?? false
  const purpose = str(snap, 'purpose')
  const audienceDescription = str(snap, 'audience_description')
  const joinLink = str(snap, 'join_link')
  const arrivalTime = str(snap, 'arrival_time')
  const venueMapsLink = str(snap, 'venue_maps_link')
  const flightDetails = str(snap, 'flight_details')
  const hotelName = str(snap, 'hotel_name')
  const depositAmount = num(snap, 'deposit_amount')
  const depositInvoiceSentAt = str(snap, 'deposit_invoice_sent_at')
  const depositReceivedAt = str(snap, 'deposit_received_at')

  const eventType = (e as any).event_type || 'speaking'

  const outgoingDone = outgoingMaterials.filter(m => m.done).length
  const incomingDone = incomingMaterials.filter(m => m.received).length
  const contractComplete = contractRequired === false || (contractRequired === true && !!contractSentAt && !!contractSignedAt)
  const outgoingComplete = outgoingMaterials.length > 0 && outgoingDone === outgoingMaterials.length
  const incomingComplete = incomingMaterials.length > 0 && incomingDone === incomingMaterials.length

  const contractSub = contractRequired === undefined ? 'Not set'
    : contractRequired === false ? 'Not required'
    : contractSignedAt ? 'Signed'
    : contractSentAt ? 'Sent — client signature pending'
    : 'Pending'
  const outgoingSub = outgoingComplete ? 'All sent' : outgoingMaterials.length === 0 ? '0 of 0 sent' : `${outgoingDone} of ${outgoingMaterials.length} sent`
  const incomingSub = incomingComplete ? 'All received' : `${incomingDone} of ${incomingMaterials.length} received`
  const briefingSub = briefingComplete ? 'Complete' : 'Incomplete'

  const depositStatus = depositReceivedAt ? 'received' : depositInvoiceSentAt ? 'sent' : depositAmount ? 'draft' : 'pending'

  const hasBriefingContent = purpose || audienceDescription || joinLink || arrivalTime || venueMapsLink || flightDetails || hotelName || runOfShow.length > 0 || briefingNotes.length > 0

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fade-in">
      <div className="mb-6">
        <StageHistoryNav engagement={e} current="engagements" />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {eventTypeIcon(eventType)}
            <span className="text-xs text-ink-400 uppercase tracking-widest font-medium">{eventTypeLabel(eventType)}</span>
          </div>
          <h1 className="font-display text-3xl font-semibold text-ink">{e.event_name || e.organization}</h1>
          <p className="text-ink-400 text-sm mt-1">{e.organization}{e.booker_name ? ` · via ${e.booker_name}` : ''}</p>
          <div className="accent-line mt-3 w-24" />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6 px-4 py-3 rounded-xl border bg-parchment/60 border-ink-100 text-ink-400 text-xs">
        <History size={13} className="flex-shrink-0" />
        Read-only snapshot of the Engagements stage, frozen when this record moved on — for reference only.
      </div>

      {/* Progress track */}
      <div className="bg-white border border-ink-100 rounded-xl mb-6 overflow-hidden">
        <div className="flex divide-x divide-ink-100">
          <ProgressTile label="Contract" complete={contractComplete} sub={contractSub} />
          <ProgressTile label="Materials Sent" complete={outgoingComplete} sub={outgoingSub} />
          <ProgressTile label="Materials Received" complete={incomingComplete} sub={incomingSub} />
          <ProgressTile label="Briefing doc" complete={briefingComplete} sub={briefingSub} />
        </div>

        {(contractRequired !== undefined || outgoingMaterials.length > 0 || incomingMaterials.length > 0) && (
          <div className="border-t border-ink-100 px-5 py-4 bg-parchment/30 space-y-4">
            {contractRequired === true && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400 mb-2">Contract</p>
                <div className="flex gap-2">
                  <span className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${contractSentAt ? 'bg-sage/8 border-sage/20 text-sage' : 'bg-white border-ink-200 text-ink-400'}`}>
                    {contractSentAt ? <CheckCircle2 size={13} /> : <Circle size={13} />} Contract Sent to Client
                  </span>
                  <span className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${contractSignedAt ? 'bg-sage/8 border-sage/20 text-sage' : 'bg-white border-ink-200 text-ink-400'}`}>
                    {contractSignedAt ? <CheckCircle2 size={13} /> : <Circle size={13} />} Contract Signed
                  </span>
                </div>
              </div>
            )}
            {outgoingMaterials.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400 mb-2">Materials Sent</p>
                <div className="grid grid-cols-2 gap-2">
                  {outgoingMaterials.map(m => (
                    <div key={m.id}
                      className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${
                        m.done ? 'bg-sage/8 border-sage/20 text-sage' : 'bg-white border-ink-100 text-ink-400'
                      }`}>
                      {m.done ? <CheckCircle2 size={13} className="flex-shrink-0 mt-0.5" /> : <Circle size={13} className="flex-shrink-0 mt-0.5" />}
                      <span className="truncate">{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {incomingMaterials.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400 mb-2">Materials Received</p>
                <div className="grid grid-cols-2 gap-2">
                  {incomingMaterials.map(m => (
                    <div key={m.id}
                      className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${
                        m.received ? 'bg-sage/8 border-sage/20 text-sage' : 'bg-white border-ink-100 text-ink-400'
                      }`}>
                      {m.received ? <CheckCircle2 size={13} className="flex-shrink-0 mt-0.5" /> : <Circle size={13} className="flex-shrink-0 mt-0.5" />}
                      <span className="truncate">{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Event details + contacts */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-ink-100 rounded-xl p-5">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Event Details</p>
          <div className="space-y-3">
            {e.event_date && (
              <div className="flex items-center gap-2.5">
                <Calendar size={14} className="text-ink-300 flex-shrink-0" />
                <span className="text-sm text-ink">{formatDate(e.event_date)}</span>
              </div>
            )}
            {(e as any).event_time && (
              <div className="flex items-center gap-2.5">
                <Clock size={14} className="text-ink-300 flex-shrink-0" />
                <span className="text-sm text-ink">{(e as any).event_time}</span>
              </div>
            )}
            {e.event_city && (
              <div className="flex items-center gap-2.5">
                <MapPin size={14} className="text-ink-300 flex-shrink-0" />
                <span className="text-sm text-ink">{e.event_city}</span>
              </div>
            )}
            {e.session_length && (
              <div className="flex items-center gap-2.5">
                <Clock size={14} className="text-ink-300 flex-shrink-0" />
                <span className="text-sm text-ink">{e.session_length} min</span>
              </div>
            )}
            {e.audience_size && (
              <div className="flex items-center gap-2.5">
                <Users size={14} className="text-ink-300 flex-shrink-0" />
                <span className="text-sm text-ink">{e.audience_size.toLocaleString()} attendees</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-ink-100 rounded-xl p-5">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Contacts</p>
          <div className="space-y-3">
            {e.contacts.length > 0 ? e.contacts.map(c => (
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
            )) : (
              <p className="text-sm text-ink-200 italic">No contacts</p>
            )}
          </div>
        </div>
      </div>

      {/* Deposit Invoice */}
      <div className="bg-white border border-ink-100 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Receipt size={14} className="text-gold" />
            <p className="text-xs text-ink-400 uppercase tracking-widest font-medium">Deposit Invoice</p>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            depositStatus === 'received' ? 'bg-sage/10 text-sage' :
            depositStatus === 'sent'     ? 'bg-gold/10 text-gold-dark' :
            depositStatus === 'draft'    ? 'bg-parchment text-ink-400' :
            'bg-parchment text-ink-300'
          }`}>
            {depositStatus === 'received' ? 'Received' : depositStatus === 'sent' ? 'Invoice Sent' : depositStatus === 'draft' ? 'Draft' : 'Not Sent'}
          </span>
        </div>
        <div className="space-y-2">
          <BRow label="Amount" value={depositAmount ? `$${depositAmount.toLocaleString()}` : undefined} />
          <BRow label="Invoice Sent" value={depositInvoiceSentAt ? formatDate(depositInvoiceSentAt) : undefined} />
          <BRow label="Received" value={depositReceivedAt ? formatDate(depositReceivedAt) : undefined} />
        </div>
      </div>

      {/* Briefing Document */}
      {hasBriefingContent && (
        <div className="bg-white border border-ink-100 rounded-xl mb-6 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-ink-100">
            <FileText size={15} className="text-gold" />
            <span className="text-sm font-semibold text-ink">Briefing Document</span>
          </div>
          <div className="px-6 py-5 space-y-5">
            {(purpose || audienceDescription) && (
              <div className="space-y-3">
                <BRow label="Purpose" value={purpose} multiline />
                <BRow label="Audience" value={audienceDescription} />
              </div>
            )}

            {(venueMapsLink || arrivalTime) && (
              <div className="space-y-3">
                <BSectionHeader>Venue</BSectionHeader>
                <BRow label="Maps Link" value={venueMapsLink} />
                <BRow label="Arrival Time" value={arrivalTime} />
              </div>
            )}

            {(flightDetails || hotelName || joinLink) && (
              <div className="space-y-3">
                <BSectionHeader>Travel</BSectionHeader>
                {flightDetails && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-300">Flight</span>
                    <p className="text-xs text-ink bg-parchment/60 rounded-lg px-3 py-2 whitespace-pre-line font-mono">{flightDetails}</p>
                  </div>
                )}
                <BRow label="Hotel" value={hotelName} />
                <BRow label="Join Link" value={joinLink} />
              </div>
            )}

            {runOfShow.length > 0 && (
              <div className="space-y-3">
                <BSectionHeader>Schedule / Run of Show</BSectionHeader>
                <div className="rounded-xl border border-ink-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-parchment border-b border-ink-100">
                        {runOfShow.some(r => r.date) && <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-ink-300 w-28">Day</th>}
                        <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-ink-300 w-24">Time</th>
                        <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-ink-300">What&apos;s Happening</th>
                        <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-ink-300 w-40">Her Role / Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {runOfShow.map((r, i) => (
                        <tr key={i} className={`border-b border-ink-50 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-parchment/20'}`}>
                          {runOfShow.some(row => row.date) && <td className="px-3 py-1.5 text-xs text-ink">{r.date}</td>}
                          <td className="px-3 py-1.5 text-xs text-ink">{r.time}{r.end_time ? `–${r.end_time}` : ''}</td>
                          <td className="px-3 py-1.5 text-xs text-ink">{r.what}</td>
                          <td className="px-3 py-1.5 text-xs text-ink-400">{r.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {briefingNotes.length > 0 && (
              <div className="space-y-3">
                <BSectionHeader>Briefing Notes</BSectionHeader>
                <div className="space-y-3">
                  {briefingNotes.map(n => (
                    <div key={n.id} className="flex items-start gap-2 text-sm">
                      {n.resolved ? <CheckCircle2 size={13} className="text-sage flex-shrink-0 mt-0.5" /> : <Circle size={13} className="text-ink-200 flex-shrink-0 mt-0.5" />}
                      <div>
                        <p className={n.resolved ? 'text-ink-400 line-through' : 'text-ink'}>{n.body}</p>
                        <p className="text-[10px] text-ink-300 mt-0.5">{formatDate(n.created_at, 'MMM d, h:mm a')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="bg-white border border-ink-100 rounded-xl p-5">
        <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Timeline</p>
        {e.comms.length > 0 ? (
          <div className="space-y-4">
            {[...e.comms].sort((a, b) => a.date > b.date ? 1 : -1).map(comm => (
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
        ) : (
          <p className="text-sm text-ink-200 italic">No activity logged</p>
        )}
      </div>
    </div>
  )
}
