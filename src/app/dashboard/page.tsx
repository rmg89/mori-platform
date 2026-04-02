'use client'

import { useState } from 'react'
import { MOCK_ENGAGEMENTS, MOCK_REVIEW_ITEMS } from '@/lib/mock-data'
import { Engagement, primaryContact } from '@/types'
import { formatDate, getInitials } from '@/lib/utils'
import {
  AlertTriangle, ArrowRight, Bell, ChevronRight, ChevronLeft,
  Users, Zap, CheckCircle2, Circle
} from 'lucide-react'
import Link from 'next/link'

// ─── Helpers ────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function daysUntil(dateStr: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86400000)
}

function daysSince(dateStr: string) { return -daysUntil(dateStr) }

function formatCountdown(days: number) {
  if (days <= 0) return 'Today'
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

  for (const e of prospects) {
    const lastComm = e.comms?.[e.comms.length - 1]
    const lastDate = lastComm?.date ?? e.last_activity_at
    const age = daysSince(lastDate)
    if (e.prospect_step === 'inquiry') {
      const hasUnreplied = e.comms?.some(c => c.needs_response)
      if (hasUnreplied && age >= 2) {
        prospectAlerts.push({ engagement: e, severity: 'red', href: `/prospects/${e.id}`, label: `${e.organization} — inquiry unanswered ${age}d` })
        continue
      }
    }
    if (e.prospect_step === 'outreach' && age >= 5)
      prospectAlerts.push({ engagement: e, severity: 'yellow', href: `/prospects/${e.id}`, label: `${e.organization} — follow-up overdue (${age}d since last touch)` })
    if ((e.prospect_step === 'in_contact' || e.prospect_step === 'discussing') && age >= 7)
      prospectAlerts.push({ engagement: e, severity: 'yellow', href: `/prospects/${e.id}`, label: `${e.organization} — no activity in ${age}d` })
  }

  for (const e of active) {
    if (!e.event_date) continue
    const days = daysUntil(e.event_date)
    const flags = e.engagement_flags
    if (flags.includes('contract_sent') && !flags.includes('contract_signed') && days <= 21)
      engagementAlerts.push({ engagement: e, severity: 'red', href: `/engagements/${e.id}`, label: `${e.organization} — contract unsigned, ${formatCountdown(days)}` })
    if (!flags.includes('advance_sheet_complete') && days <= 14)
      engagementAlerts.push({ engagement: e, severity: 'red', href: `/engagements/${e.id}`, label: `${e.organization} — advance sheet incomplete, ${formatCountdown(days)}` })
    if (flags.includes('contract_sent') && !flags.includes('contract_signed') && days > 21)
      engagementAlerts.push({ engagement: e, severity: 'yellow', href: `/engagements/${e.id}`, label: `${e.organization} — awaiting contract signature` })
    if (flags.includes('contract_signed') && !flags.includes('client_deliverables_sent'))
      engagementAlerts.push({ engagement: e, severity: 'yellow', href: `/engagements/${e.id}`, label: `${e.organization} — client deliverables not sent` })
  }

  for (const e of postEvent) {
    const flags = e.post_event_flags
    if (flags.includes('invoice_sent') && !flags.includes('invoice_paid')) {
      const sentComm = e.comms?.find(c => c.subject?.toLowerCase().includes('invoice'))
      const age = daysSince(sentComm?.date ?? e.updated_at)
      postEventAlerts.push({ engagement: e, severity: age >= 30 ? 'red' : 'yellow', href: `/post-event/${e.id}`,
        label: age >= 30 ? `${e.organization} — invoice unpaid ${age}d` : `${e.organization} — invoice outstanding` })
    }
    if (!flags.includes('invoice_sent') && !flags.includes('marked_complete'))
      postEventAlerts.push({ engagement: e, severity: 'yellow', href: `/post-event/${e.id}`, label: `${e.organization} — invoice not yet sent` })
    if (!flags.includes('media_uploaded') && !flags.includes('marked_complete'))
      postEventAlerts.push({ engagement: e, severity: 'yellow', href: `/post-event/${e.id}`, label: `${e.organization} — media not uploaded` })
  }

  const groups: AlertGroup[] = []
  if (prospectAlerts.length > 0) groups.push({ category: 'Prospects', items: prospectAlerts })
  if (engagementAlerts.length > 0) groups.push({ category: 'Engagements', items: engagementAlerts })
  if (postEventAlerts.length > 0) groups.push({ category: 'Post-Event', items: postEventAlerts })
  return groups
}

// ─── Prospect one-liner ───────────────────────────────────────────────────────

function prospectOneLiner(e: Engagement): { text: string; urgent: boolean } {
  if (e.alerts.length > 0) return { text: e.alerts[0].label, urgent: e.alerts[0].severity === 'high' }
  const comms = e.comms ?? []
  if (comms.length > 0) {
    const last = comms[comms.length - 1]
    const age = daysSince(last.date)
    const ageStr = age === 0 ? 'today' : age === 1 ? 'yesterday' : `${age}d ago`
    if (last.type === 'email_inbound') return { text: `Inbound from ${last.from_name} — ${ageStr}`, urgent: false }
    if (last.type === 'email_outbound') return { text: `${last.subject ?? 'Email sent'} — ${ageStr}`, urgent: false }
    if (last.type === 'call') return { text: `${last.subject ?? 'Call'} — ${ageStr}`, urgent: false }
  }
  if (e.notes) return { text: e.notes.split('.')[0], urgent: false }
  return { text: 'No recent activity', urgent: false }
}

// ─── Advance Sheet Carousel ───────────────────────────────────────────────────

const CHECKLIST_FLAGS = [
  { id: 'contract_sent',            label: 'Contract Sent' },
  { id: 'contract_signed',          label: 'Contract Signed' },
  { id: 'client_deliverables_sent', label: 'Client Deliverables Sent' },
  { id: 'advance_sheet_complete',   label: 'Advance Sheet Complete' },
]

function AdvanceSheetCard({ engagement: e }: { engagement: Engagement }) {
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
    <Link href={`/engagements/${e.id}`}
      className={`flex-1 min-w-0 flex flex-col gap-3.5 p-5 rounded-xl border-t-2 border border-ink-100 bg-white hover:shadow-md hover:border-gold/20 transition-all group ${topAccent}`}>

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

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-ink-50">
        <span className={`text-[11px] font-semibold ${
          isComplete ? 'text-sage-dark' : isUrgent ? 'text-red-500' : isWarning ? 'text-amber-600' : 'text-ink-400'
        }`}>
          {isComplete ? '✓ Ready' : isUrgent ? 'Needs attention' : 'In progress'}
        </span>
        <span className="text-[11px] text-gold/60 group-hover:text-gold-dark transition-all font-medium">
          {isComplete ? 'View sheet →' : 'Open sheet →'}
        </span>
      </div>
    </Link>
  )
}

function AdvanceSheetCarousel({ events }: { events: Engagement[] }) {
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
        {visible.map(e => <AdvanceSheetCard key={e.id} engagement={e} />)}
        {visible.length < perPage && Array.from({ length: perPage - visible.length }).map((_, i) => (
          <div key={i} className="flex-1 min-w-0" />
        ))}
      </div>
    </div>
  )
}

// ─── Alert Panel ──────────────────────────────────────────────────────────────

function AlertPanel({ groups }: { groups: AlertGroup[] }) {
  const totalRed = groups.flatMap(g => g.items).filter(i => i.severity === 'red').length
  const totalYellow = groups.flatMap(g => g.items).filter(i => i.severity === 'yellow').length
  if (groups.length === 0) return (
    <div className="bg-white border border-ink-100 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 py-12">
      <CheckCircle2 size={20} className="text-sage/50" />
      <p className="text-sm text-ink-300 font-medium">All clear</p>
    </div>
  )

  return (
    <div className="bg-white border border-ink-100 rounded-2xl p-6 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <AlertTriangle size={13} className="text-red-400" />
        <h2 className="font-display text-xl font-semibold text-ink">Needs Attention</h2>
        <div className="ml-auto flex items-center gap-2">
          {totalRed > 0 && <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">{totalRed} urgent</span>}
          {totalYellow > 0 && <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">{totalYellow} watch</span>}
        </div>
      </div>

      <div className="space-y-5">
        {groups.map(group => (
          <div key={group.category}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-300 mb-1.5 pl-1">{group.category}</p>
            <div className="space-y-0.5">
              {[...group.items.filter(i => i.severity === 'red'), ...group.items.filter(i => i.severity === 'yellow')].map((item, idx) => (
                <Link key={idx} href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group -mx-1 ${
                    item.severity === 'red' ? 'hover:bg-red-50/60' : 'hover:bg-amber-50/40'
                  }`}>
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.severity === 'red' ? 'bg-red-500' : 'bg-amber-400'}`} />
                  <span className="text-sm text-ink-600 flex-1 truncate">{item.label}</span>
                  <ArrowRight size={11} className={`flex-shrink-0 transition-all ${
                    item.severity === 'red' ? 'text-ink-200 group-hover:text-red-400' : 'text-ink-200 group-hover:text-amber-400'
                  }`} />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const STEP_COLORS: Record<string, string> = {
  inquiry:    'text-blue-600 bg-blue-50',
  outreach:   'text-purple-600 bg-purple-50',
  in_contact: 'text-sage-dark bg-sage/10',
  discussing: 'text-gold-dark bg-gold/10',
  proposal:   'text-amber-700 bg-amber-50',
}

export default function DashboardPage() {
  const allEngagements = MOCK_ENGAGEMENTS
  const prospects = allEngagements.filter(e => e.section === 'prospects')
  const active = allEngagements.filter(e => e.section === 'engagements')
  const postEvent = allEngagements.filter(e => e.section === 'post-event')

  const total = prospects.length + active.length + postEvent.length || 1
  const pPct = (prospects.length / total) * 100
  const aPct = (active.length / total) * 100
  const pePct = (postEvent.length / total) * 100

  const allUpcoming = active.filter(e => e.event_date).sort((a, b) => a.event_date! > b.event_date! ? 1 : -1)
  const within2Weeks = allUpcoming.filter(e => daysUntil(e.event_date!) <= 14)
  const beyond2Weeks = allUpcoming.filter(e => daysUntil(e.event_date!) > 14)
  const carouselEvents = within2Weeks.length >= 3 ? within2Weeks : [...within2Weeks, ...beyond2Weeks.slice(0, 3 - within2Weeks.length)]

  const alertGroups = buildAlerts(prospects, active, postEvent)
  const reviewCount = MOCK_REVIEW_ITEMS.filter(r => !r.confirmed_by).length
  const needsResponseCount = allEngagements.filter(e => e.comms?.some(c => c.needs_response)).length

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
          <div className="flex-1 flex flex-col gap-2.5 pb-1">
            <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
              <div className="rounded-l-full transition-all" style={{ width: `${pPct}%`, backgroundColor: '#7A9E87' }} />
              <div className="transition-all" style={{ width: `${aPct}%`, backgroundColor: '#C9A84C' }} />
              <div className="rounded-r-full transition-all" style={{ width: `${pePct}%`, backgroundColor: '#4A4740' }} />
            </div>
            <div className="flex items-center justify-between">
              {[
                { label: 'Prospects', count: prospects.length, color: '#7A9E87', href: '/prospects' },
                { label: 'Engagements', count: active.length, color: '#C9A84C', href: '/engagements' },
                { label: 'Post-Event', count: postEvent.length, color: '#4A4740', href: '/post-event' },
              ].map(s => (
                <Link key={s.label} href={s.href} className="flex items-center gap-1.5 hover:opacity-60 transition-all">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="text-sm font-semibold text-ink">{s.count}</span>
                  <span className="text-xs text-ink-400">{s.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Action pills */}
          <div className="flex items-center gap-2.5 flex-shrink-0 pb-1">
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

        {/* ── Carousel ── */}
        {carouselEvents.length > 0 && (
          <div className="mb-6">
            <AdvanceSheetCarousel events={carouselEvents} />
          </div>
        )}

        {/* ── Main grid: Alerts | Prospects ── */}
        <div className="grid grid-cols-2 gap-5">

          {/* Alerts */}
          <AlertPanel groups={alertGroups} />

          {/* Prospects snapshot */}
          <div className="bg-white border border-ink-100 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <Users size={13} className="text-sage" />
                <h2 className="font-display text-xl font-semibold text-ink">Prospects</h2>
              </div>
              <Link href="/prospects" className="text-xs text-gold/70 hover:text-gold flex items-center gap-1 transition-all font-medium">
                View all <ArrowRight size={11} />
              </Link>
            </div>

            <div className="space-y-px">
              {prospects.slice(0, 8).map(e => {
                const sc = STEP_COLORS[e.prospect_step ?? 'inquiry'] ?? 'text-ink-400 bg-parchment'
                const { text: oneLiner, urgent } = prospectOneLiner(e)
                return (
                  <Link key={e.id} href={`/prospects/${e.id}`}
                    className="flex items-start gap-3 py-3 px-3 rounded-xl hover:bg-parchment/70 transition-all -mx-3 group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-ink truncate">{e.organization}</p>
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full flex-shrink-0 ${sc}`}>
                          {e.prospect_step?.replace('_', ' ')}
                        </span>
                      </div>
                      <p className={`text-xs truncate leading-relaxed ${urgent ? 'text-red-500' : 'text-ink-400'}`}>{oneLiner}</p>
                    </div>
                    <ArrowRight size={11} className="text-ink-100 group-hover:text-gold/60 transition-all flex-shrink-0 mt-1.5" />
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}