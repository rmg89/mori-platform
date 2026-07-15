'use client'
import { Engagement, EngagementCall, EngagementContact, CommEntry, PROSPECT_STEPS, ProspectStep } from '@/types'
import { formatDate, getInitials } from '@/lib/utils'
import { formatCallDateTime } from '@/lib/timezone'
import { CheckCircle2, Circle, Phone, History } from 'lucide-react'
import StageHistoryNav from './StageHistoryNav'

function formatDT(iso?: string, tzId?: string) {
  if (!iso) return null
  return formatCallDateTime(iso, tzId)
}
function formatDateDisplay(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

const STEP_COLORS: Record<string, string> = {
  inquiry:    'bg-red-50 text-red-500 border-red-100',
  outreach:   'bg-red-50 text-red-500 border-red-100',
  in_contact: 'bg-gold/10 text-gold border-gold/20',
  confirmed:  'bg-sage/10 text-sage border-sage/20',
  declined:   'bg-parchment text-ink-400 border-ink-200',
}
const STEP_INACTIVE = 'bg-parchment text-ink-300 border-ink-100'

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

function StaticField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-start gap-2 min-h-[28px]">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-300 w-20 flex-shrink-0 mt-1">{label}</span>
      <span className="text-sm text-ink mt-1">{value || <span className="text-ink-200 italic">—</span>}</span>
    </div>
  )
}

// Read-only reconstruction of the Prospects-stage page, sourced from the frozen
// prospect_snapshot captured when this record left the Prospects stage
// (confirmProspect / declineProspect in src/lib/store.tsx) — not live fields,
// which keep changing after the record moves on. Mirrors the layout of the
// live prospects/[id] page so it reads as the same page, just frozen.
export default function ProspectSnapshotView({ engagement: e }: { engagement: Engagement }) {
  const snap = e.prospect_snapshot ?? {}
  const contacts = list<EngagementContact>(snap, 'contacts')
  const calls = list<EngagementCall>(snap, 'calls')
  const comms = list<CommEntry>(snap, 'comms')
  const proposedDates = list<{ date: string; times?: string[] }>(snap, 'proposed_dates')
  const currentStep = (str(snap, 'prospect_step') as ProspectStep | undefined) ?? 'inquiry'
  const source = str(snap, 'source')
  const notes = str(snap, 'notes')
  const eventDate = str(snap, 'event_date')
  const eventCity = str(snap, 'event_city')
  const fee = num(snap, 'fee')
  const topic = str(snap, 'topic')
  const audienceSize = num(snap, 'audience_size')
  const eventFormat = str(snap, 'event_format')
  const isVirtual = eventFormat === 'virtual'

  const entrySteps = ['inquiry', 'outreach']
  const terminalSteps = ['confirmed', 'declined']
  const order = ['inquiry', 'outreach', 'in_contact', 'confirmed', 'declined']
  const isActive = (stepId: string) => stepId === currentStep
  const isPast = (stepId: string) => {
    const currentIdx = order.indexOf(currentStep)
    const stepIdx = order.indexOf(stepId)
    if (entrySteps.includes(stepId) && ['in_contact', ...terminalSteps].includes(currentStep)) return true
    return stepIdx < currentIdx && !entrySteps.includes(stepId)
  }
  const stepClass = (stepId: string) => {
    if (isActive(stepId)) return STEP_COLORS[stepId] ?? STEP_INACTIVE
    if (isPast(stepId)) return 'bg-sage/8 text-sage border-sage/20 opacity-60'
    return STEP_INACTIVE
  }

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fade-in">
      <div className="mb-6">
        <StageHistoryNav engagement={e} current="prospects" />
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">{e.event_name || e.organization}</h1>
          <p className="text-ink-400 text-sm mt-1">{e.organization}{e.booker_name ? ` · via ${e.booker_name}` : ''}</p>
          <div className="accent-line mt-3 w-24" />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6 px-4 py-3 rounded-xl border bg-parchment/60 border-ink-100 text-ink-400 text-xs">
        <History size={13} className="flex-shrink-0" />
        Read-only snapshot of the Prospects stage, frozen when this record moved on — for reference only.
      </div>

      {/* Pipeline stage */}
      <div className="bg-white border border-ink-100 rounded-xl p-5 mb-6">
        <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Prospect Stage</p>

        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className="pr-2 align-middle">
                <div className="flex flex-col gap-2">
                  {entrySteps.map(stepId => {
                    const step = PROSPECT_STEPS.find(s => s.id === stepId)
                    if (!step) return null
                    return (
                      <div key={stepId}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${stepClass(stepId)}`}>
                        {isActive(stepId) ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                        {step.label}
                      </div>
                    )
                  })}
                </div>
              </td>
              <td className="px-1 align-middle text-center text-ink-200 whitespace-nowrap">
                <div>↘</div><div>↗</div>
              </td>
              <td className="align-middle w-full px-1">
                {comms.length > 0 && (() => {
                  const sorted = [...comms].sort((a, b) => a.date > b.date ? 1 : -1)
                  const first = sorted[0]
                  const last = sorted[sorted.length - 1]
                  return (
                    <div className="flex justify-between text-[9px] text-ink-300 mb-1 px-1">
                      <span>Initial: {formatDT(first.date)}</span>
                      <span>Most Recent: {formatDT(last.date)}</span>
                    </div>
                  )
                })()}
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium w-full justify-center ${stepClass('in_contact')}`}>
                  {isActive('in_contact') || isPast('in_contact') ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                  In Contact
                </div>
              </td>
              <td className="px-1 align-middle text-center text-ink-200 whitespace-nowrap">
                <div>↗</div><div>↘</div>
              </td>
              <td className="pl-2 align-middle">
                <div className="flex flex-col gap-2">
                  {terminalSteps.map(stepId => {
                    const step = PROSPECT_STEPS.find(s => s.id === stepId)
                    if (!step) return null
                    return (
                      <div key={stepId}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${stepClass(stepId)}`}>
                        {isActive(stepId) ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                        {step.label}
                      </div>
                    )
                  })}
                </div>
              </td>
            </tr>

            {calls.map(call => {
              const typeLabel = call.type === 'discovery' ? 'Discovery Call' : 'Mori Call'
              const numLabel = call.number > 1 ? ` #${call.number}` : ''
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
                      <Phone size={8} />{typeLabel}{numLabel}
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
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                isPastStep || isActiveStep ? 'border-sage bg-sage/10' : 'border-ink-200 bg-white'
                              }`}>
                                {(isPastStep || isActiveStep) && <CheckCircle2 size={8} className="text-sage" />}
                              </div>
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
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Event details */}
        <div className="bg-white border border-ink-100 rounded-xl p-5">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Event Details</p>
          <div className="space-y-3">
            <StaticField label="Topic" value={topic} />
            <div className="flex items-start gap-2 min-h-[28px]">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-300 w-20 flex-shrink-0 mt-1">
                {eventDate ? 'Date' : proposedDates.length > 0 ? 'Proposed' : 'Date'}
              </span>
              <div className="flex-1 space-y-1">
                {eventDate ? (
                  <span className="text-sm font-medium text-sage-dark">{formatDateDisplay(eventDate)}</span>
                ) : proposedDates.length > 0 ? (
                  proposedDates.map(entry => (
                    <div key={entry.date}>
                      <span className="text-sm font-medium text-ink">{formatDateDisplay(entry.date)}</span>
                      {(entry.times ?? []).map(time => (
                        <p key={time} className="text-xs text-ink-500 pl-2">{time}</p>
                      ))}
                    </div>
                  ))
                ) : (
                  <span className="text-sm text-ink-200 italic mt-1 inline-block">—</span>
                )}
              </div>
            </div>
            <div className="flex items-start gap-2 min-h-[28px]">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-300 w-20 flex-shrink-0 mt-1">Location</span>
              <div className="flex-1 space-y-1.5">
                <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded border ${
                  isVirtual ? 'bg-gold/10 text-gold-dark border-gold/20' : 'bg-parchment text-ink-300 border-ink-100'
                }`}>
                  {isVirtual ? <CheckCircle2 size={9} /> : <Circle size={9} />} Virtual
                </span>
                {!isVirtual && (
                  <div><span className="text-sm text-ink">{eventCity || <span className="text-ink-200 italic">—</span>}</span></div>
                )}
              </div>
            </div>
            <StaticField label="Audience" value={audienceSize ? audienceSize.toLocaleString() : undefined} />
            <StaticField label="Source" value={source} />
            <StaticField label="Fee" value={fee ? `$${fee.toLocaleString()}` : undefined} />
          </div>
        </div>

        {/* Contacts */}
        <div className="bg-white border border-ink-100 rounded-xl p-5">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Contacts</p>
          <div className="space-y-3">
            {contacts.length > 0 ? contacts.map(c => (
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

      {/* Notes */}
      <div className="bg-white border border-ink-100 rounded-xl p-5 mb-6">
        <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-3">Notes</p>
        {notes ? (
          <p className="text-sm text-ink whitespace-pre-line">{notes}</p>
        ) : (
          <p className="text-sm text-ink-200 italic">No notes</p>
        )}
      </div>

      {/* Calls */}
      <div className="bg-white border border-ink-100 rounded-xl p-5 mb-6">
        <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Calls</p>
        {calls.length > 0 ? (
          <div className="space-y-3">
            {calls.map(call => {
              const typeLabel = call.type === 'discovery' ? 'Discovery Call' : 'Mori Call'
              const numLabel = call.number > 1 ? ` #${call.number}` : ''
              return (
                <div key={call.id} className="border border-ink-50 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center gap-3">
                    <Phone size={12} className="text-ink-300 flex-shrink-0" />
                    <span className="text-sm font-medium text-ink flex-1">{typeLabel}{numLabel}</span>
                    <div className="flex gap-1.5">
                      {(['requested', 'scheduled', 'completed'] as const).map(s => (
                        <span key={s}
                          className={`text-[10px] font-semibold px-2 py-1 rounded-md border capitalize ${
                            call.status === s
                              ? s === 'completed' ? 'bg-sage/10 text-sage border-sage/20'
                                : s === 'scheduled' ? 'bg-gold/10 text-gold-dark border-gold/20'
                                : 'bg-parchment text-ink-400 border-ink-200'
                              : 'bg-transparent text-ink-200 border-ink-100'
                          }`}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 text-[10px] text-ink-300 pl-5">
                    {call.requested_at && <span>Requested: <span className="text-ink-500">{formatDT(call.requested_at)}</span></span>}
                    {call.scheduled_at && <span>Scheduled: <span className="text-gold-dark font-medium">{formatDT(call.scheduled_at)}</span></span>}
                    {call.completed_at && <span>Completed: <span className="text-sage-dark font-medium">{formatDT(call.completed_at)}</span></span>}
                  </div>
                  {call.details && (
                    <div className="pl-5 text-[11px] text-ink-400 bg-parchment/60 rounded-lg px-3 py-2">
                      {call.details}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-ink-200 italic">No calls logged</p>
        )}
      </div>

      {/* Timeline */}
      <div className="bg-white border border-ink-100 rounded-xl p-5">
        <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Timeline</p>
        {comms.length > 0 ? (
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
        ) : (
          <p className="text-sm text-ink-200 italic">No activity logged</p>
        )}
      </div>
    </div>
  )
}
