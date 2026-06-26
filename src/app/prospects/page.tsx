'use client'
import { useState } from 'react'
import { useStore } from '@/lib/store'
import { Engagement, PROSPECT_STEPS, primaryContact, getProspectStepLabel } from '@/types'
import { formatDate, getInitials } from '@/lib/utils'
import { Plus, AlertTriangle, Calendar, ArrowRight, Users, CheckCircle2, XCircle, ChevronDown, ChevronUp, Phone, Flag } from 'lucide-react'
import Link from 'next/link'
import { EngagementCall } from '@/types'

// ─── Recently resolved (mock) ────────────────────────────────────────────────

const ALL_RESOLVED = [
  { id: 're1', organization: 'Goldman Sachs', outcome: 'confirmed' as const, date: '2024-06-11', company_id: 'co8' },
  { id: 're2', organization: 'TechCorp', outcome: 'confirmed' as const, date: '2024-06-08', company_id: 'co7' },
  { id: 're3', organization: 'Blackstone Group', outcome: 'declined' as const, date: '2024-06-05', company_id: 'co8' },
]
const TWO_WEEKS_AGO = new Date('2024-06-12')
TWO_WEEKS_AGO.setDate(TWO_WEEKS_AGO.getDate() - 14)
const RECENTLY_RESOLVED = ALL_RESOLVED.filter(r => new Date(r.date) >= TWO_WEEKS_AGO).slice(0, 10)

// ─── Classification logic ─────────────────────────────────────────────────────

type InContactGroup = 'unmanaged' | 'action' | 'awaiting' | 'scheduled'

function classifyInContact(e: Engagement): InContactGroup {
  const now = Date.now()

  const activeNS = e.comms?.find(c =>
    c.next_step &&
    !c.next_step_cleared &&
    (!c.next_step_snoozed_until || new Date(c.next_step_snoozed_until).getTime() < now)
  )
  const snoozedNS = e.comms?.find(c =>
    c.next_step &&
    !c.next_step_cleared &&
    c.next_step_snoozed_until &&
    new Date(c.next_step_snoozed_until).getTime() >= now
  )
  const hasResponse = e.comms?.some(c => c.needs_response)
  const hasAlerts = e.alerts.length > 0

  if (!activeNS && !snoozedNS && !hasResponse) return 'unmanaged'

  const isOverdue = activeNS?.next_step_due_at && new Date(activeNS.next_step_due_at).getTime() < now
  if (hasResponse || isOverdue || hasAlerts) return 'action'

  if (!activeNS && snoozedNS) return 'scheduled'

  return 'awaiting'
}

// ─── Status line ──────────────────────────────────────────────────────────────

function prospectStatusLine(e: Engagement): { text: string; urgent: boolean; isNextStep?: boolean } | null {
  const now = Date.now()
  const activeNextStep = e.comms?.find(c =>
    c.next_step &&
    !c.next_step_cleared &&
    (!c.next_step_snoozed_until || new Date(c.next_step_snoozed_until).getTime() < now)
  )
  if (activeNextStep?.next_step) {
    const due = activeNextStep.next_step_due_at ? new Date(activeNextStep.next_step_due_at) : null
    const overdue = due && due.getTime() < now
    const daysUntil = due ? Math.ceil((due.getTime() - now) / 86400000) : null
    const suffix = overdue ? ' — overdue' : daysUntil !== null ? (daysUntil <= 0 ? ' — due today' : ` — due in ${daysUntil}d`) : ''
    return { text: activeNextStep.next_step + suffix, urgent: !!overdue, isNextStep: true }
  }
  const snoozed = e.comms?.find(c =>
    c.next_step && !c.next_step_cleared &&
    c.next_step_snoozed_until && new Date(c.next_step_snoozed_until).getTime() >= now
  )
  if (snoozed?.next_step) {
    const until = new Date(snoozed.next_step_snoozed_until!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return { text: `${snoozed.next_step} — follow up ${until}`, urgent: false, isNextStep: true }
  }
  if (e.alerts.length > 0) return { text: e.alerts[0].label, urgent: e.alerts[0].severity === 'high' }
  const comms = e.comms ?? []
  if (comms.length > 0) {
    const last = comms[comms.length - 1]
    const age = Math.floor((Date.now() - new Date(last.date).getTime()) / 86400000)
    const ageStr = age === 0 ? 'today' : age === 1 ? 'yesterday' : `${age}d ago`
    if (last.type === 'email_inbound') return { text: `Inbound from ${last.from_name || 'them'} — ${ageStr}`, urgent: false }
    if (last.type === 'email_outbound') return { text: `${last.subject ?? 'Email sent'} — ${ageStr}`, urgent: false }
    if (last.type === 'call') return { text: `${last.subject ?? 'Call'} — ${ageStr}`, urgent: false }
    if (last.type === 'note') return { text: `Note logged — ${ageStr}`, urgent: false }
  }
  return null
}

// ─── Card helpers ─────────────────────────────────────────────────────────────

function callStatusIcon(status: EngagementCall['status']) {
  if (status === 'completed') return '✓'
  if (status === 'scheduled') return '◷'
  return '○'
}

function callLabel(call: EngagementCall) {
  const typeLabel = call.type === 'discovery' ? 'Discovery Call' : 'Mori Call'
  const num = call.number > 1 ? ` #${call.number}` : ''
  const name = `${typeLabel}${num}`
  if (call.status === 'completed' && call.completed_at)
    return `${name} — ${new Date(call.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  if (call.status === 'scheduled' && call.scheduled_at)
    return `${name} — scheduled ${new Date(call.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  return `${name} — requested`
}

// ─── ProspectCard ─────────────────────────────────────────────────────────────

function ProspectCard({ engagement: e, showStepLabel = true }: { engagement: Engagement; showStepLabel?: boolean }) {
  const pc = primaryContact(e)
  const stepLabel = getProspectStepLabel(e.prospect_step!)
  const eventType = (e as any).event_type as string | undefined
  const isMedia = eventType && eventType !== 'speaking'
  const statusLine = prospectStatusLine(e)

  const formatTag = e.event_format === 'in_person' ? 'In Person'
    : e.event_format === 'virtual' ? 'Virtual'
    : e.event_format === 'hybrid' ? 'Hybrid'
    : null

  const eventTypeLabel = eventType === 'podcast' ? 'Podcast'
    : eventType === 'interview' ? 'Interview'
    : eventType === 'panel' ? 'Panel'
    : eventType === 'livestream' ? 'Livestream'
    : 'Speaking'

  return (
    <Link
      href={`/prospects/${e.id}`}
      className="flex items-start gap-4 bg-white border border-ink-100 rounded-xl px-5 py-4 hover:border-gold/30 hover:shadow-sm transition-all group"
    >
      {pc && (
        <div className="w-9 h-9 rounded-full bg-ink-800 flex items-center justify-center text-xs font-bold text-gold flex-shrink-0 mt-0.5">
          {getInitials(pc.first_name, pc.last_name)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink">{e.event_name || e.topic || e.organization}</p>
            <p className="text-xs text-ink-400 mt-0.5">
              {e.organization}
              {pc && ` · ${pc.first_name} ${pc.last_name}`}
              {e.contacts.length > 1 && (
                <span className="ml-1.5 inline-flex items-center gap-0.5 text-ink-300">
                  <Users size={10} />+{e.contacts.length - 1}
                </span>
              )}
            </p>
          </div>
          {showStepLabel && (
            <span className="flex-shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide bg-gold/10 text-gold-dark">
              {stepLabel}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-ink-50 text-ink-400 border border-ink-100">
            {eventTypeLabel}
          </span>
          {formatTag && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
              e.event_format === 'in_person' ? 'bg-sage/8 text-sage-dark border-sage/20'
              : e.event_format === 'virtual' ? 'bg-blue-50 text-blue-600 border-blue-100'
              : 'bg-amber-50 text-amber-600 border-amber-100'
            }`}>
              {formatTag}
            </span>
          )}
          {e.audience_size && (
            <span className="text-[10px] text-ink-300 flex items-center gap-1">
              <Users size={9} />{e.audience_size.toLocaleString()} {isMedia ? 'audience' : 'attendees'}
            </span>
          )}
          {e.event_date && (
            <span className="text-[10px] text-ink-400 flex items-center gap-1">
              <Calendar size={9} />
              <span className="text-ink-300">Target:</span> {formatDate(e.event_date, 'MMM d, yyyy')}
              {e.event_city && <span className="text-ink-200 mx-1">·</span>}
              {e.event_city && <span>{e.event_city}</span>}
            </span>
          )}
        </div>

        {statusLine && (
          <div className={`flex items-center gap-1.5 mt-2 text-[10px] font-medium truncate ${
            statusLine.urgent ? 'text-red-500' : statusLine.isNextStep ? 'text-gold-dark' : 'text-ink-400'
          }`}>
            {statusLine.isNextStep && <Flag size={9} className="flex-shrink-0" />}
            {statusLine.urgent && !statusLine.isNextStep && <AlertTriangle size={9} className="flex-shrink-0" />}
            <span className="truncate">{statusLine.text}</span>
          </div>
        )}

        {e.calls && e.calls.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 border-t border-ink-50 pt-2.5">
            {e.calls.map(call => (
              <span key={call.id} className={`flex items-center gap-1.5 text-[10px] font-medium ${
                call.status === 'completed' ? 'text-sage-dark' :
                call.status === 'scheduled' ? 'text-gold-dark' :
                'text-ink-300'
              }`}>
                <Phone size={9} className="flex-shrink-0" />
                <span className={call.added_by === 'ai' ? 'italic' : ''}>
                  {callStatusIcon(call.status)} {callLabel(call)}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
      <ArrowRight size={14} className="text-ink-200 group-hover:text-gold transition-all flex-shrink-0 mt-1" />
    </Link>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  label, count, sub, variant = 'default',
}: {
  label: string
  count: number
  sub?: string
  variant?: 'default' | 'warning' | 'muted'
}) {
  const dotColor = variant === 'warning' ? 'bg-amber-400'
    : variant === 'muted' ? 'bg-ink-200'
    : 'bg-gold'

  const labelColor = variant === 'warning' ? 'text-amber-700'
    : variant === 'muted' ? 'text-ink-400'
    : 'text-ink'

  return (
    <div className={`flex items-center gap-2.5 mb-3 ${variant === 'warning' ? 'px-3 py-2 rounded-xl bg-amber-50 border border-amber-100' : ''}`}>
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
      <h2 className={`font-display text-base font-semibold ${labelColor}`}>{label}</h2>
      <span className={`text-sm ${variant === 'warning' ? 'text-amber-500' : 'text-ink-400'}`}>{count}</span>
      {sub && <span className="text-xs text-ink-300 italic ml-0.5">{sub}</span>}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProspectsPage() {
  const [resolvedOpen, setResolvedOpen] = useState(false)
  const { engagements } = useStore()

  const activeSteps = ['inquiry', 'outreach', 'in_contact']
  const prospects = engagements.filter(e =>
    e.section === 'prospects' && !e.archived && activeSteps.includes(e.prospect_step ?? '')
  )

  const inquiryCount  = prospects.filter(e => e.prospect_step === 'inquiry').length
  const outreachCount = prospects.filter(e => e.prospect_step === 'outreach').length
  const preContactCount = inquiryCount + outreachCount
  const inContact = prospects.filter(e => e.prospect_step === 'in_contact')

  const groups = {
    unmanaged: inContact.filter(e => classifyInContact(e) === 'unmanaged'),
    action:    inContact.filter(e => classifyInContact(e) === 'action'),
    awaiting:  inContact.filter(e => classifyInContact(e) === 'awaiting'),
    scheduled: inContact.filter(e => classifyInContact(e) === 'scheduled'),
  }

  const scheduledCalls = prospects.flatMap(e => e.calls ?? []).filter(c => c.status === 'scheduled').length
  const requestedCalls = prospects.flatMap(e => e.calls ?? []).filter(c => c.status === 'requested').length
  const pendingCalls   = scheduledCalls + requestedCalls

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Prospects</h1>
          <p className="text-ink-400 text-sm mt-1">{prospects.length} active</p>
          <div className="accent-line mt-3 w-24" />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setResolvedOpen(!resolvedOpen)}
              className="flex items-center gap-2 px-3 py-2 bg-parchment border border-ink-100 text-ink-500 text-sm rounded-lg hover:bg-ink-100 transition-all">
              Recently Resolved
              <span className="text-xs bg-ink-200 text-ink-600 rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {RECENTLY_RESOLVED.length}
              </span>
              {resolvedOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {resolvedOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-72 bg-white border border-ink-100 rounded-xl shadow-lg z-10 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-ink-50 flex items-center justify-between">
                  <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Recently Resolved</p>
                  <Link href="/companies" className="text-xs text-gold hover:text-gold-dark">View all →</Link>
                </div>
                {RECENTLY_RESOLVED.map(item => (
                  <Link key={item.id} href={`/companies/${item.company_id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-parchment transition-all"
                    onClick={() => setResolvedOpen(false)}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${item.outcome === 'confirmed' ? 'bg-sage/10' : 'bg-parchment'}`}>
                      {item.outcome === 'confirmed'
                        ? <CheckCircle2 size={13} className="text-sage" />
                        : <XCircle size={13} className="text-ink-300" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{item.organization}</p>
                      <p className="text-xs text-ink-400">{item.outcome === 'confirmed' ? 'Confirmed' : 'Declined'} · {formatDate(item.date, 'MMM d, yyyy')}</p>
                    </div>
                    <ArrowRight size={12} className="text-ink-200 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-ink text-cream text-sm rounded-lg hover:bg-ink-700 transition-all">
            <Plus size={16} /> New Inquiry
          </button>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-3 gap-3 mb-8">

        {/* Pre-contact */}
        <div className="bg-white border border-ink-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">Pre-contact</span>
          </div>
          <p className="text-2xl font-semibold text-ink">{preContactCount}</p>
          <p className="text-[10px] text-ink-300 mt-1 font-medium">
            {inquiryCount > 0 && `${inquiryCount} inquiry`}
            {inquiryCount > 0 && outreachCount > 0 && ' · '}
            {outreachCount > 0 && `${outreachCount} outreach`}
            {preContactCount === 0 && 'None active'}
          </p>
        </div>

        {/* In Contact */}
        <div className="bg-white border border-ink-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-gold" />
            <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">In Contact</span>
          </div>
          <p className="text-2xl font-semibold text-ink">{inContact.length}</p>
          <div className="flex flex-col gap-0.5 mt-1">
            {groups.unmanaged.length > 0 && (
              <span className="text-[10px] font-semibold text-amber-600">{groups.unmanaged.length} unmanaged</span>
            )}
            {groups.action.length > 0 && (
              <span className="text-[10px] font-medium text-ink-400">{groups.action.length} action needed</span>
            )}
            {groups.awaiting.length > 0 && (
              <span className="text-[10px] font-medium text-ink-300">{groups.awaiting.length} awaiting response</span>
            )}
            {groups.scheduled.length > 0 && (
              <span className="text-[10px] font-medium text-ink-300">{groups.scheduled.length} scheduled</span>
            )}
            {inContact.length === 0 && <span className="text-[10px] text-ink-300">None active</span>}
          </div>
        </div>

        {/* Calls Pending */}
        <div className="bg-white border border-ink-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Phone size={10} className="text-ink-400" />
            <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">Calls Pending</span>
          </div>
          <p className="text-2xl font-semibold text-ink">{pendingCalls}</p>
          {pendingCalls > 0 ? (
            <div className="flex gap-2 mt-1">
              {scheduledCalls > 0 && <span className="text-[10px] text-gold-dark font-medium">{scheduledCalls} scheduled</span>}
              {requestedCalls > 0 && <span className="text-[10px] text-ink-300 font-medium">{requestedCalls} requested</span>}
            </div>
          ) : (
            <p className="text-[10px] text-ink-300 mt-1">All clear</p>
          )}
        </div>
      </div>

      {/* ── Pre-contact (Inquiry / Outreach) ── */}
      <div className="grid grid-cols-2 gap-6 mb-10">
        {(['inquiry', 'outreach'] as const).map(stepId => {
          const step = PROSPECT_STEPS.find(s => s.id === stepId)!
          const items = prospects.filter(e => e.prospect_step === stepId)
          return (
            <div key={stepId}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <h2 className="font-display text-base font-semibold text-ink">{step.label}</h2>
                <span className="text-sm text-ink-400">{items.length}</span>
              </div>
              {items.length === 0 ? (
                <div className="bg-white border border-dashed border-ink-100 rounded-xl px-5 py-6 text-center text-xs text-ink-300">
                  None active
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map(e => <ProspectCard key={e.id} engagement={e} />)}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── In Contact ── */}
      {inContact.length > 0 && (
        <div className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-ink-100" />
            <span className="text-xs font-bold uppercase tracking-widest text-ink-300">In Contact · {inContact.length}</span>
            <div className="h-px flex-1 bg-ink-100" />
          </div>

          {/* Unmanaged — top, warning treatment */}
          {groups.unmanaged.length > 0 && (
            <div>
              <SectionHeader label="Unmanaged" count={groups.unmanaged.length}
                sub="— no next step defined" variant="warning" />
              <div className="space-y-2">
                {groups.unmanaged.map(e => (
                  <div key={e.id} className="rounded-xl border-l-2 border-amber-300">
                    <ProspectCard engagement={e} showStepLabel={false} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Needed */}
          {groups.action.length > 0 && (
            <div>
              <SectionHeader label="Action Needed" count={groups.action.length} />
              <div className="space-y-2">
                {groups.action.map(e => <ProspectCard key={e.id} engagement={e} showStepLabel={false} />)}
              </div>
            </div>
          )}

          {/* Awaiting Response */}
          {groups.awaiting.length > 0 && (
            <div>
              <SectionHeader label="Awaiting Response" count={groups.awaiting.length} variant="muted" />
              <div className="space-y-2">
                {groups.awaiting.map(e => <ProspectCard key={e.id} engagement={e} showStepLabel={false} />)}
              </div>
            </div>
          )}

          {/* Scheduled */}
          {groups.scheduled.length > 0 && (
            <div>
              <SectionHeader label="Scheduled" count={groups.scheduled.length} variant="muted" />
              <div className="space-y-2">
                {groups.scheduled.map(e => <ProspectCard key={e.id} engagement={e} showStepLabel={false} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
