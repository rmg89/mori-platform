'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { Engagement, CommEntry } from '@/types'
import { formatDate } from '@/lib/utils'
import {
  ArrowRight, Bell, ChevronRight, ChevronLeft,
  Zap, CheckCircle2, Circle, FileText, Plus
} from 'lucide-react'
import Link from 'next/link'
import NewInquiryModal from '@/components/NewInquiryModal'

// ─── Helpers ────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function daysUntil(dateStr: string) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d) // local midnight — avoids UTC parse shift
  return Math.round((date.getTime() - today.getTime()) / 86400000)
}

function daysSince(dateStr: string) { return -daysUntil(dateStr) }

function formatCountdown(days: number) {
  if (days < 0) return 'Past'
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 7) return `${days}d`
  if (days < 30) return `${Math.round(days / 7)}w`
  return `${Math.round(days / 30)}mo`
}

// ─── Alert generation ────────────────────────────────────────────────────────

type AlertItem = { engagement: Engagement; label: string; severity: 'red' | 'yellow'; href: string }
type AlertGroup = { category: string; items: AlertItem[] }

function buildAlerts(prospects: Engagement[], active: Engagement[], postEvent: Engagement[]): AlertGroup[] {
  const prospectAlerts: AlertItem[] = []
  const engagementAlerts: AlertItem[] = []
  const postEventAlerts: AlertItem[] = []

  // ── Prospects ────────────────────────────────────────────────────────────
  for (const e of prospects) {
    const lastComm = e.comms?.[e.comms.length - 1]
    const lastDate = lastComm?.date ?? e.last_activity_at
    const age = daysSince(lastDate)
    const hasUnreplied = e.comms?.some(c => c.needs_response)

    if (e.prospect_step === 'inquiry') {
      // Any unanswered inquiry over 1 day is urgent
      if (hasUnreplied && age >= 1)
        prospectAlerts.push({ engagement: e, severity: 'red', href: `/prospects/${e.id}`, label: `${e.organization} — inquiry unanswered ${age}d` })
    } else if (e.prospect_step === 'outreach') {
      // No reply to our outreach after 5 days — time to follow up
      if (age >= 5)
        prospectAlerts.push({ engagement: e, severity: 'yellow', href: `/prospects/${e.id}`, label: `${e.organization} — follow-up overdue (${age}d since last touch)` })
    } else if (e.prospect_step === 'in_contact') {
      // Unanswered inbound from them
      if (hasUnreplied && age >= 1)
        prospectAlerts.push({ engagement: e, severity: 'red', href: `/prospects/${e.id}`, label: `${e.organization} — reply needed (${age}d)` })
      // Active negotiation gone quiet 5+ days
      else if (!hasUnreplied && age >= 5)
        prospectAlerts.push({ engagement: e, severity: 'yellow', href: `/prospects/${e.id}`, label: `${e.organization} — no activity in ${age}d` })
    }
  }

  // ── Engagements ───────────────────────────────────────────────────────────
  for (const e of active) {
    if (!e.event_date) continue
    const days = daysUntil(e.event_date)
    const flags = e.engagement_flags
    const isMedia = !!(e as any).event_type && (e as any).event_type !== 'speaking'

    if (!isMedia) {
      // Contract sent but not yet signed by client — escalate as event approaches
      if (flags.includes('contract_sent') && !flags.includes('contract_signed')) {
        const contractComm = e.comms?.find(c => c.subject?.toLowerCase().includes('agreement') || c.subject?.toLowerCase().includes('contract'))
        const contractAge = daysSince(contractComm?.date ?? e.created_at)
        if (days <= 14)
          engagementAlerts.push({ engagement: e, severity: 'red', href: `/engagements/${e.id}`, label: `${e.organization} — contract not signed (${contractAge}d waiting, event in ${days}d)` })
        else if (days <= 60)
          engagementAlerts.push({ engagement: e, severity: 'yellow', href: `/engagements/${e.id}`, label: `${e.organization} — contract not yet signed (${contractAge}d waiting)` })
      }
      // Briefing document not marked complete within 7 days of event — always red
      if (!flags.includes('advance_sheet_complete') && days <= 7)
        engagementAlerts.push({ engagement: e, severity: 'red', href: `/engagements/${e.id}`, label: `${e.organization} — briefing document incomplete, event in ${days}d` })
      // Client has requested materials from us (bio, headshot, etc.) but we haven't sent yet
      if (flags.includes('materials_requested') && !flags.includes('client_deliverables_sent')) {
        const requestComm = e.comms?.slice().reverse().find(c => c.type === 'email_inbound')
        const requestAge = daysSince(requestComm?.date ?? e.created_at)
        if (requestAge >= 2)
          engagementAlerts.push({ engagement: e, severity: requestAge >= 5 ? 'red' : 'yellow', href: `/engagements/${e.id}`, label: `${e.organization} — bio/materials requested by client, unsent ${requestAge <= 2 ? '48h+' : `${requestAge}d`}` })
      }
    } else {
      // Media appearance — flag missing confirmation within 2 weeks
      const mediaFlags: string[] = (e as any).media_flags ?? []
      if (!mediaFlags.includes('confirmed') && days <= 14)
        engagementAlerts.push({ engagement: e, severity: 'yellow', href: `/engagements/${e.id}`, label: `${e.organization} — appearance not yet confirmed, ${formatCountdown(days)}` })
      if (mediaFlags.includes('confirmed') && !mediaFlags.includes('prep_sent') && days <= 7)
        engagementAlerts.push({ engagement: e, severity: 'yellow', href: `/engagements/${e.id}`, label: `${e.organization} — prep questions not yet received, ${formatCountdown(days)}` })
    }
  }

  // ── Wrap-Up ────────────────────────────────────────────────────────────────
  for (const e of postEvent) {
    const flags = e.post_event_flags
    const eventAge = e.event_date ? daysSince(e.event_date) : 0

    if (!flags.includes('invoice')) {
      postEventAlerts.push({ engagement: e, severity: eventAge >= 7 ? 'red' : 'yellow', href: `/wrap-up/${e.id}`,
        label: eventAge >= 7 ? `${e.organization} — invoice not handled (${eventAge}d since event)` : `${e.organization} — invoice pending` })
    }
    if (!flags.includes('media') && eventAge >= 14)
      postEventAlerts.push({ engagement: e, severity: 'yellow', href: `/wrap-up/${e.id}`, label: `${e.organization} — media not yet collected` })
    if (!flags.includes('testimonial') && eventAge >= 21)
      postEventAlerts.push({ engagement: e, severity: 'yellow', href: `/wrap-up/${e.id}`, label: `${e.organization} — testimonial not yet requested` })
  }

  const groups: AlertGroup[] = []
  if (prospectAlerts.length > 0) groups.push({ category: 'Prospects', items: prospectAlerts })
  if (engagementAlerts.length > 0) groups.push({ category: 'Engagements', items: engagementAlerts })
  if (postEventAlerts.length > 0) groups.push({ category: 'Wrap-Up', items: postEventAlerts })
  return groups
}

// ─── Field readiness ─────────────────────────────────────────────────────────

function fieldReadiness(e: Engagement): { filled: number; total: number } {
  if (!e.field_statuses) return { filled: 0, total: 0 }
  const entries = Object.entries(e.field_statuses).filter(([, s]) => s === 'needed')
  const filled = entries.filter(([f]) => {
    const val = (e as unknown as Record<string, unknown>)[f]
    return val !== undefined && val !== null && val !== ''
  }).length
  return { filled, total: entries.length }
}

// ─── Briefing Document Carousel ───────────────────────────────────────────────────

const CHECKLIST_FLAGS = [
  { id: 'contract_sent',            label: 'Contract Sent' },
  { id: 'contract_signed',          label: 'Contract Signed' },
  { id: 'client_deliverables_sent', label: 'Client Deliverables Sent' },
  { id: 'advance_sheet_complete',   label: 'Briefing Document Complete' },
]

function BriefingDocCard({ engagement: e }: { engagement: Engagement }) {
  const days = daysUntil(e.event_date!)
  const flags = e.engagement_flags
  const isComplete = flags.includes('advance_sheet_complete')
  const isUrgent = days <= 7
  const isWarning = days <= 14 && !isUrgent

  const countdownColor = days <= 0
    ? 'text-red-600 border-red-200 bg-red-50'
    : days <= 7
    ? 'text-amber-700 border-amber-200 bg-amber-50'
    : days <= 14
    ? 'text-gold-dark border-gold/30 bg-gold/8'
    : 'text-ink-400 border-ink-100 bg-parchment'

  const topAccent = days <= 0
    ? 'border-t-red-300'
    : days <= 7
    ? 'border-t-amber-300'
    : days <= 14
    ? 'border-t-gold/50'
    : 'border-t-ink-100'

  return (
    <div className={`flex-1 min-w-0 flex flex-col rounded-xl border-t-2 border border-ink-100 bg-white overflow-hidden ${topAccent}`}>

      {/* Clickable card body → engagement detail */}
      <Link href={`/engagements/${e.id}`}
        className="flex flex-col gap-3.5 p-5 hover:bg-parchment/40 transition-all group">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold text-ink leading-tight truncate">{e.organization}</p>
            <p className="text-xs text-ink-400 truncate mt-0.5">{e.event_name || e.topic}</p>
          </div>
          <div className={`flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full border ${countdownColor}`}>
            {formatCountdown(days)}
          </div>
        </div>

        {/* Date + location */}
        <p className="text-xs text-ink-300">{e.event_city} · {formatDate(e.event_date!)}</p>

        {/* Checklist */}
        <div className="space-y-1.5">
          {CHECKLIST_FLAGS.map(flag => {
            const done = flags.includes(flag.id as typeof flags[number])
            return (
              <div key={flag.id} className={`flex items-center gap-2 text-xs ${done ? 'text-sage-dark' : 'text-ink-300'}`}>
                {done
                  ? <CheckCircle2 size={11} className="flex-shrink-0 text-sage" />
                  : <Circle size={11} className="flex-shrink-0" />}
                {flag.label}
              </div>
            )
          })}
        </div>

        {/* Field readiness */}
        {(() => {
          const { filled, total } = fieldReadiness(e)
          if (total === 0) return null
          const pct = Math.round((filled / total) * 100)
          return (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-ink-300">Fields ready</span>
                <span className={`text-[10px] font-semibold ${filled === total ? 'text-sage-dark' : pct >= 70 ? 'text-amber-600' : 'text-red-500'}`}>
                  {filled}/{total}
                </span>
              </div>
              <div className="h-1 rounded-full bg-ink-100 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${filled === total ? 'bg-sage' : pct >= 70 ? 'bg-amber-400' : 'bg-red-400'}`}
                  style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })()}

        {/* Action flags */}
        {(() => {
          const now = new Date()
          const overdueStep = e.comms?.some(c =>
            c.next_step && !c.next_step_cleared &&
            (!c.next_step_snoozed_until || new Date(c.next_step_snoozed_until) <= now) &&
            c.next_step_due_at && new Date(c.next_step_due_at) < now
          ) ?? false
          const needsReply = e.comms?.some(c => c.needs_response) ?? false
          if (!overdueStep && !needsReply) return null
          return (
            <div className="flex items-center gap-1.5 flex-wrap">
              {needsReply && <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">Reply needed</span>}
              {overdueStep && <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">Overdue step</span>}
            </div>
          )
        })()}
      </Link>

      {/* Briefing Document button — full width, prominent */}
      <Link href={`/engagements/${e.id}#briefing`}
        className="px-5 py-3.5 bg-gold/10 border-t border-gold/20 hover:bg-gold/20 transition-all flex items-center justify-center gap-2 group mt-auto">
        <FileText size={13} className="text-gold" />
        <span className="text-sm font-semibold text-gold-dark">View Briefing Document</span>
        <ArrowRight size={12} className="text-gold/50 group-hover:text-gold transition-all" />
      </Link>
    </div>
  )
}

function BriefingDocCarousel({ events }: { events: Engagement[] }) {
  const [page, setPage] = useState(0)
  const perPage = 3
  const totalPages = Math.ceil(events.length / perPage)
  const visible = events.slice(page * perPage, page * perPage + perPage)

  return (
    <div className="rounded-2xl border border-ink-100 bg-white/60 overflow-hidden">
      {/* Header strip */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-ink-50">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xl font-semibold text-ink">Upcoming Events</h2>
          <span className="text-xs text-ink-400 font-medium bg-parchment px-2.5 py-0.5 rounded-full">{events.length} confirmed</span>
        </div>
        <div className="flex items-center gap-3">
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage((p: number) => Math.max(0, p - 1))} disabled={page === 0}
                className="w-6 h-6 rounded-md flex items-center justify-center border border-ink-100 text-ink-400 hover:text-ink hover:border-ink-300 disabled:opacity-25 disabled:cursor-not-allowed transition-all">
                <ChevronLeft size={12} />
              </button>
              <span className="text-xs text-ink-400 tabular-nums">{page + 1} / {totalPages}</span>
              <button onClick={() => setPage((p: number) => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                className="w-6 h-6 rounded-md flex items-center justify-center border border-ink-100 text-ink-400 hover:text-ink hover:border-ink-300 disabled:opacity-25 disabled:cursor-not-allowed transition-all">
                <ChevronRight size={12} />
              </button>
            </div>
          )}
          <Link href="/engagements" className="text-xs text-gold hover:text-gold-dark flex items-center gap-1 font-medium transition-all">
            All <ArrowRight size={11} />
          </Link>
        </div>
      </div>

      {/* Cards */}
      <div className="flex gap-3 p-5">
        {visible.map(e => <BriefingDocCard key={e.id} engagement={e} />)}
        {visible.length < perPage && Array.from({ length: perPage - visible.length }).map((_, i) => (
          <div key={i} className="flex-1 min-w-0" />
        ))}
      </div>
    </div>
  )
}

// ─── Action Columns ──────────────────────────────────────────────────────────

type NextStepItem = { comm: CommEntry; engagement: Engagement; isOverdue: boolean }

function buildNextSteps(allEngagements: Engagement[]): NextStepItem[] {
  const now = new Date()
  const items: NextStepItem[] = []
  for (const e of allEngagements) {
    for (const c of e.comms ?? []) {
      if (!c.next_step || c.next_step_cleared) continue
      const snoozed = c.next_step_snoozed_until && new Date(c.next_step_snoozed_until) > now
      const isOverdue = !snoozed && c.next_step_due_at ? new Date(c.next_step_due_at) < now : false
      items.push({ comm: c, engagement: e, isOverdue })
    }
  }
  return items.sort((a, b) => {
    const da = a.comm.next_step_due_at ? new Date(a.comm.next_step_due_at).getTime() : Infinity
    const db = b.comm.next_step_due_at ? new Date(b.comm.next_step_due_at).getTime() : Infinity
    return da - db
  })
}

function engagementHref(e: Engagement) {
  if (e.section === 'prospects') return `/prospects/${e.id}`
  if (e.section === 'wrap-up') return `/wrap-up/${e.id}`
  return `/engagements/${e.id}`
}

const FIELD_LABELS: Record<string, string> = {
  fee: 'Fee', event_date: 'Event Date', event_city: 'Event City', event_name: 'Event Name',
  topic: 'Topic', venue_name: 'Venue', travel_notes: 'Travel Notes',
  hotel_notes: 'Hotel Notes', av_notes: 'A/V Notes', payment_notes: 'Payment Notes',
}

type OutstandingDataItem = { engagement: Engagement; neededFields: string[] }

function buildOutstandingData(allEngagements: Engagement[]): OutstandingDataItem[] {
  const items: OutstandingDataItem[] = []
  for (const e of allEngagements) {
    if (!e.field_statuses) continue
    const needed = Object.entries(e.field_statuses)
      .filter(([, status]) => status === 'needed')
      .filter(([field]) => {
        const val = (e as unknown as Record<string, unknown>)[field]
        return val === undefined || val === null || val === ''
      })
      .map(([field]) => FIELD_LABELS[field] ?? field)
    if (needed.length > 0) items.push({ engagement: e, neededFields: needed })
  }
  return items
}

function ColumnSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-ink-50 last:border-b-0 px-5 py-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-ink-300 mb-2">{title}</p>
      {children}
    </div>
  )
}

function ActionRow({ href, label, sub, severity }: {
  href: string; label: string; sub?: string; severity?: 'red' | 'amber' | 'neutral'
}) {
  return (
    <Link href={href} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg -mx-2.5 transition-all group ${
      severity === 'red' ? 'hover:bg-red-50/60' : severity === 'amber' ? 'hover:bg-amber-50/40' : 'hover:bg-parchment/60'
    }`}>
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
        severity === 'red' ? 'bg-red-400' : severity === 'amber' ? 'bg-amber-300' : 'bg-ink-200'
      }`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink truncate leading-snug">{label}</p>
        {sub && <p className="text-xs text-ink-400 truncate">{sub}</p>}
      </div>
      <ArrowRight size={11} className="text-ink-100 group-hover:text-ink-300 transition-all flex-shrink-0" />
    </Link>
  )
}

function ToDoColumn({ readyToProgress, overdueSteps, redAlerts, allEngagements }: {
  readyToProgress: { e: Engagement; type: 'confirm' | 'wrapup' }[]
  overdueSteps: NextStepItem[]
  redAlerts: AlertItem[]
  allEngagements: Engagement[]
}) {
  const needsResponse = allEngagements.filter(e => e.comms?.some(c => c.needs_response))
  const isEmpty = readyToProgress.length === 0 && overdueSteps.length === 0 && redAlerts.length === 0 && needsResponse.length === 0
  const total = readyToProgress.length + overdueSteps.length + redAlerts.length + needsResponse.length

  return (
    <div className="bg-white border border-ink-100 rounded-2xl overflow-hidden flex flex-col">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-ink-50">
        <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
        <h2 className="font-display text-lg font-semibold text-ink">To Do</h2>
        {total > 0 && <span className="text-xs text-red-600 font-semibold bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">{total}</span>}
      </div>
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center gap-2 py-14">
          <CheckCircle2 size={20} className="text-sage/50" />
          <p className="text-sm text-ink-300 font-medium">All clear</p>
        </div>
      ) : (
        <>
          {readyToProgress.length > 0 && (
            <ColumnSection title="Move Forward">
              {readyToProgress.map(({ e, type }) => (
                <div key={`${type}-${e.id}`} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg -mx-2.5 hover:bg-parchment/60 transition-all">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-gold" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink truncate">{e.event_name || e.organization}</p>
                    <p className="text-xs text-ink-400 truncate">{type === 'confirm' ? `${e.organization} · ready to confirm` : `${e.organization} · event passed`}</p>
                  </div>
                  <Link href={type === 'confirm' ? `/prospects/${e.id}` : `/engagements/${e.id}`}
                    className="text-[10px] font-semibold text-gold-dark bg-gold/10 border border-gold/20 rounded-full px-2.5 py-1 hover:bg-gold/20 transition-all flex-shrink-0">
                    {type === 'confirm' ? '→ Confirm' : '→ Wrap-Up'}
                  </Link>
                </div>
              ))}
            </ColumnSection>
          )}
          {(overdueSteps.length > 0 || redAlerts.length > 0) && (
            <ColumnSection title="Overdue">
              {overdueSteps.map(({ comm, engagement }, idx) => (
                <ActionRow key={`step-${idx}`} href={engagementHref(engagement)}
                  label={engagement.organization}
                  sub={`Follow up: ${comm.next_step}`}
                  severity="red" />
              ))}
              {redAlerts.map((a, idx) => (
                <ActionRow key={`alert-${idx}`} href={a.href}
                  label={a.engagement.organization}
                  sub={a.label.split(' — ').slice(1).join(' — ')}
                  severity="red" />
              ))}
            </ColumnSection>
          )}
          {needsResponse.length > 0 && (
            <ColumnSection title="Reply Needed">
              {needsResponse.map(e => {
                const last = e.comms?.slice().reverse().find(c => c.needs_response)
                return (
                  <ActionRow key={e.id} href={engagementHref(e)}
                    label={e.organization}
                    sub={last?.from_name ? `${last.from_name} reached out` : 'Inbound waiting'}
                    severity="red" />
                )
              })}
            </ColumnSection>
          )}
        </>
      )}
    </div>
  )
}

function WaitingColumn({ allEngagements, yellowAlerts }: { allEngagements: Engagement[]; yellowAlerts: AlertItem[] }) {
  const now = new Date()
  type WaitItem = { label: string; sub: string; href: string; dateLabel: string; snoozed: boolean }
  const items: WaitItem[] = []

  for (const e of allEngagements) {
    for (const c of e.comms ?? []) {
      if (!c.next_step || c.next_step_cleared) continue
      const snoozedUntil = c.next_step_snoozed_until ? new Date(c.next_step_snoozed_until) : null
      const dueAt = c.next_step_due_at ? new Date(c.next_step_due_at) : null
      if (snoozedUntil && snoozedUntil > now) {
        items.push({ label: e.organization, sub: c.next_step, href: engagementHref(e),
          dateLabel: snoozedUntil.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), snoozed: true })
      } else if (dueAt && dueAt > now) {
        items.push({ label: e.organization, sub: c.next_step, href: engagementHref(e),
          dateLabel: dueAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), snoozed: false })
      }
    }
  }
  items.sort((a, b) => a.dateLabel.localeCompare(b.dateLabel))

  const activeItems = items.filter(i => !i.snoozed)
  const snoozedItems = items.filter(i => i.snoozed)
  const isEmpty = items.length === 0 && yellowAlerts.length === 0
  const total = items.length + yellowAlerts.length

  return (
    <div className="bg-white border border-ink-100 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-ink-50">
        <div className="w-2 h-2 rounded-full bg-ink-300 flex-shrink-0" />
        <h2 className="font-display text-lg font-semibold text-ink">Waiting</h2>
        {total > 0 && <span className="text-xs text-ink-400 font-medium bg-parchment px-2 py-0.5 rounded-full">{total}</span>}
      </div>
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center gap-2 py-14">
          <Circle size={20} className="text-ink-100" />
          <p className="text-sm text-ink-300 font-medium">Nothing pending</p>
        </div>
      ) : (
        <>
          {activeItems.length > 0 && (
            <ColumnSection title="Active Follow-Ups">
              {activeItems.map((item, idx) => (
                <Link key={idx} href={item.href}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg -mx-2.5 hover:bg-parchment/60 transition-all group">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-ink-200" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink truncate">{item.label}</p>
                    <p className="text-xs text-ink-400 truncate">{item.sub}</p>
                  </div>
                  <span className="text-[10px] text-ink-400 font-medium bg-parchment border border-ink-100 px-2 py-0.5 rounded-full flex-shrink-0">
                    Due {item.dateLabel}
                  </span>
                </Link>
              ))}
            </ColumnSection>
          )}
          {snoozedItems.length > 0 && (
            <ColumnSection title="Snoozed">
              {snoozedItems.map((item, idx) => (
                <Link key={idx} href={item.href}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg -mx-2.5 hover:bg-parchment/60 transition-all group">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-ink-100" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink-400 truncate">{item.label}</p>
                    <p className="text-xs text-ink-300 truncate">{item.sub}</p>
                  </div>
                  <span className="text-[10px] text-ink-300 font-medium bg-parchment/60 px-2 py-0.5 rounded-full flex-shrink-0">
                    Until {item.dateLabel}
                  </span>
                </Link>
              ))}
            </ColumnSection>
          )}
          {yellowAlerts.length > 0 && (
            <ColumnSection title="Watch">
              {yellowAlerts.map((a, idx) => (
                <ActionRow key={idx} href={a.href}
                  label={a.engagement.organization}
                  sub={a.label.split(' — ').slice(1).join(' — ')}
                  severity="amber" />
              ))}
            </ColumnSection>
          )}
        </>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [newInquiryOpen, setNewInquiryOpen] = useState(false)
  const router = useRouter()
  const { engagements: allEngagements, reviewItems } = useStore()
  const activeEngagements = allEngagements.filter(e => !e.archived)
  const prospects = activeEngagements.filter(e => e.section === 'prospects')
  const active = activeEngagements.filter(e => e.section === 'engagements')
  const postEvent = activeEngagements.filter(e => e.section === 'wrap-up')

  const total = prospects.length + active.length + postEvent.length || 1
  const pPct = (prospects.length / total) * 100
  const aPct = (active.length / total) * 100
  const pePct = (postEvent.length / total) * 100

  const allUpcoming = active.filter(e => e.event_date && daysUntil(e.event_date) >= 0).sort((a, b) => a.event_date! > b.event_date! ? 1 : -1)
  const within2Weeks = allUpcoming.filter(e => daysUntil(e.event_date!) <= 14)
  const beyond2Weeks = allUpcoming.filter(e => daysUntil(e.event_date!) > 14)
  const carouselEvents = within2Weeks.length >= 3 ? within2Weeks : [...within2Weeks, ...beyond2Weeks.slice(0, 3 - within2Weeks.length)]

  const readyToProgress = [
    ...prospects.filter(e => e.prospect_step === 'confirmed' || (e as any).booking_review_needed)
      .map(e => ({ e, type: 'confirm' as const })),
    ...[...active, ...postEvent.filter(e => (e as any).wrap_up_review_needed)]
      .filter((e, i, arr) => arr.findIndex(x => x.id === e.id) === i)
      .filter(e => (e.section === 'engagements' && e.event_date && daysUntil(e.event_date) < 0) || (e as any).wrap_up_review_needed)
      .map(e => ({ e, type: 'wrapup' as const })),
  ]

  const alertGroups = buildAlerts(prospects, active, postEvent)
  const allAlertItems = alertGroups.flatMap(g => g.items)
  const reviewCount = reviewItems.filter(r => !r.confirmed_by).length
  const needsResponseCount = activeEngagements.filter(e => e.comms?.some(c => c.needs_response)).length
  const nextStepItems = buildNextSteps(activeEngagements)
  const overdueSteps = nextStepItems.filter(i => i.isOverdue)

  return (
    <div>
      <div className="p-8 max-w-7xl mx-auto animate-fade-in">

        {/* ── Header ── */}
        <div className="mb-10 flex items-end justify-between gap-10">

          {/* Greeting */}
          <div className="flex-shrink-0">
            <p className="text-[11px] text-ink-300 uppercase tracking-[0.2em] font-medium mb-2">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <h1 className="font-display text-5xl font-light text-ink leading-none tracking-tight">
              {getGreeting()}.
            </h1>
            <div className="mt-4 w-16 h-px" style={{ background: 'linear-gradient(90deg, #C9A84C, transparent)' }} />
          </div>

          {/* Pipeline — center */}
          <div className="flex flex-col gap-2.5 w-80">
            <div className="flex h-4 rounded-full overflow-hidden gap-px">
              <div className="rounded-l-full transition-all" style={{ width: `${pPct}%`, backgroundColor: '#7A9E87' }} />
              <div className="transition-all" style={{ width: `${aPct}%`, backgroundColor: '#C9A84C' }} />
              <div className="rounded-r-full transition-all" style={{ width: `${pePct}%`, backgroundColor: '#4A4740' }} />
            </div>
            <div className="flex items-center justify-between">
              {[
                { label: 'Prospects', count: prospects.length, color: '#7A9E87', href: '/prospects' },
                { label: 'Engagements', count: active.length, color: '#C9A84C', href: '/engagements' },
                { label: 'Wrap-Up', count: postEvent.length, color: '#4A4740', href: '/wrap-up' },
              ].map(s => (
                <Link key={s.label} href={s.href} className="flex items-center gap-1.5 whitespace-nowrap hover:opacity-60 transition-all">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="text-sm font-semibold text-ink">{s.count}</span>
                  <span className="text-xs text-ink-400">{s.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Action pills */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <button onClick={() => setNewInquiryOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-ink text-cream text-sm rounded-xl hover:bg-ink-700 transition-all">
              <Plus size={14} /> New Inquiry
            </button>
            {reviewCount > 0 && (
              <Link href="/review"
                className="flex items-center gap-2 px-4 py-2.5 bg-gold/8 border border-gold/25 rounded-xl hover:bg-gold/12 transition-all group">
                <Bell size={13} className="text-gold" />
                <span className="text-sm font-medium text-gold-dark">{reviewCount} in Review</span>
                <ArrowRight size={11} className="text-gold/40 group-hover:text-gold transition-all" />
              </Link>
            )}
            {needsResponseCount > 0 && (
              <Link href="/prospects"
                className="flex items-center gap-2 px-4 py-2.5 bg-red-50/80 border border-red-100 rounded-xl hover:bg-red-50 transition-all group">
                <Zap size={13} className="text-red-500" />
                <span className="text-sm font-medium text-red-600">{needsResponseCount} need reply</span>
                <ArrowRight size={11} className="text-red-200 group-hover:text-red-400 transition-all" />
              </Link>
            )}
          </div>
        </div>

        {newInquiryOpen && (
          <NewInquiryModal
            onClose={() => setNewInquiryOpen(false)}
            onCreated={id => router.push(`/prospects/${id}`)}
          />
        )}

        {/* ── Carousel ── */}
        {carouselEvents.length > 0 && (
          <div className="mb-6">
            <BriefingDocCarousel events={carouselEvents} />
          </div>
        )}

        {/* ── To Do | Waiting ── */}
        <div className="grid grid-cols-2 gap-5">
          <ToDoColumn
            readyToProgress={readyToProgress}
            overdueSteps={overdueSteps}
            redAlerts={allAlertItems.filter(i => i.severity === 'red')}
            allEngagements={activeEngagements}
          />
          <WaitingColumn
            allEngagements={activeEngagements}
            yellowAlerts={allAlertItems.filter(i => i.severity === 'yellow')}
          />
        </div>

      </div>
    </div>
  )
}