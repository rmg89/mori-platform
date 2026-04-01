'use client'

import { useState } from 'react'
import { MOCK_ENGAGEMENTS, MOCK_REVIEW_ITEMS } from '@/lib/mock-data'
import { Engagement, primaryContact } from '@/types'
import { formatDate, getInitials } from '@/lib/utils'
import {
  AlertTriangle, ArrowRight, ArrowLeft, Bell, ChevronRight, ChevronLeft,
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

function daysSince(dateStr: string) {
  return -daysUntil(dateStr)
}

function formatCountdown(days: number) {
  if (days <= 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 7) return `${days}d`
  if (days < 30) return `${Math.round(days / 7)}w`
  return `${Math.round(days / 30)}mo`
}

function countdownStyle(days: number) {
  if (days <= 0) return 'bg-red-100 text-red-700 border-red-200'
  if (days <= 7) return 'bg-amber-100 text-amber-700 border-amber-200'
  if (days <= 14) return 'bg-gold/10 text-gold-dark border-gold/20'
  return 'bg-parchment text-ink-500 border-ink-100'
}

// ─── Alert generation ────────────────────────────────────────────────────────

type AlertItem = {
  engagement: Engagement
  label: string
  severity: 'red' | 'yellow'
  href: string
}

type AlertGroup = {
  category: string
  items: AlertItem[]
}

function buildAlerts(
  prospects: Engagement[],
  active: Engagement[],
  postEvent: Engagement[]
): AlertGroup[] {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const prospectAlerts: AlertItem[] = []
  const engagementAlerts: AlertItem[] = []
  const postEventAlerts: AlertItem[] = []

  // ── Prospects ──────────────────────────────────────────────────────────────
  for (const e of prospects) {
    const lastComm = e.comms?.[e.comms.length - 1]
    const lastDate = lastComm?.date ?? e.last_activity_at
    const age = daysSince(lastDate)

    // Red: inbound inquiry with no reply 48h+
    if (e.prospect_step === 'inquiry') {
      const hasUnreplied = e.comms?.some(c => c.needs_response)
      if (hasUnreplied && age >= 2) {
        prospectAlerts.push({
          engagement: e, severity: 'red', href: `/prospects/${e.id}`,
          label: `${e.organization} — inquiry unanswered ${age}d`,
        })
        continue
      }
    }

    // Yellow: outbound follow-up overdue (sent outreach, no reply, 5+ days)
    if (e.prospect_step === 'outreach' && age >= 5) {
      prospectAlerts.push({
        engagement: e, severity: 'yellow', href: `/prospects/${e.id}`,
        label: `${e.organization} — follow-up overdue (${age}d since last touch)`,
      })
    }

    // Yellow: in_contact or discussing, gone quiet 7+ days
    if ((e.prospect_step === 'in_contact' || e.prospect_step === 'discussing') && age >= 7) {
      prospectAlerts.push({
        engagement: e, severity: 'yellow', href: `/prospects/${e.id}`,
        label: `${e.organization} — no activity in ${age}d`,
      })
    }
  }

  // ── Engagements ────────────────────────────────────────────────────────────
  for (const e of active) {
    if (!e.event_date) continue
    const days = daysUntil(e.event_date)
    const flags = e.engagement_flags

    // Red: contract not signed, event within 3 weeks
    if (flags.includes('contract_sent') && !flags.includes('contract_signed') && days <= 21) {
      engagementAlerts.push({
        engagement: e, severity: 'red', href: `/engagements/${e.id}`,
        label: `${e.organization} — contract unsigned, ${formatCountdown(days)}`,
      })
    }

    // Red: advance sheet not complete, event within 2 weeks
    if (!flags.includes('advance_sheet_complete') && days <= 14) {
      engagementAlerts.push({
        engagement: e, severity: 'red', href: `/engagements/${e.id}`,
        label: `${e.organization} — advance sheet incomplete, ${formatCountdown(days)}`,
      })
    }

    // Yellow: contract sent but not signed (with time to spare)
    if (flags.includes('contract_sent') && !flags.includes('contract_signed') && days > 21) {
      engagementAlerts.push({
        engagement: e, severity: 'yellow', href: `/engagements/${e.id}`,
        label: `${e.organization} — awaiting contract signature`,
      })
    }

    // Yellow: client deliverables not sent after contract signed
    if (flags.includes('contract_signed') && !flags.includes('client_deliverables_sent')) {
      engagementAlerts.push({
        engagement: e, severity: 'yellow', href: `/engagements/${e.id}`,
        label: `${e.organization} — client deliverables not sent`,
      })
    }
  }

  // ── Post-Event ─────────────────────────────────────────────────────────────
  for (const e of postEvent) {
    const flags = e.post_event_flags

    // Red: invoice unpaid 30+ days (invoice_sent but not invoice_paid, and sent long ago)
    if (flags.includes('invoice_sent') && !flags.includes('invoice_paid')) {
      const sentComm = e.comms?.find(c => c.subject?.toLowerCase().includes('invoice'))
      const sentDate = sentComm?.date ?? e.updated_at
      const age = daysSince(sentDate)
      if (age >= 30) {
        postEventAlerts.push({
          engagement: e, severity: 'red', href: `/post-event/${e.id}`,
          label: `${e.organization} — invoice unpaid ${age}d`,
        })
      } else {
        postEventAlerts.push({
          engagement: e, severity: 'yellow', href: `/post-event/${e.id}`,
          label: `${e.organization} — invoice outstanding`,
        })
      }
    }

    // Yellow: invoice not yet sent
    if (!flags.includes('invoice_sent') && !flags.includes('marked_complete')) {
      postEventAlerts.push({
        engagement: e, severity: 'yellow', href: `/post-event/${e.id}`,
        label: `${e.organization} — invoice not yet sent`,
      })
    }

    // Yellow: media not uploaded
    if (!flags.includes('media_uploaded') && !flags.includes('marked_complete')) {
      postEventAlerts.push({
        engagement: e, severity: 'yellow', href: `/post-event/${e.id}`,
        label: `${e.organization} — media not uploaded`,
      })
    }
  }

  const groups: AlertGroup[] = []
  if (prospectAlerts.length > 0) groups.push({ category: 'Prospects', items: prospectAlerts })
  if (engagementAlerts.length > 0) groups.push({ category: 'Engagements', items: engagementAlerts })
  if (postEventAlerts.length > 0) groups.push({ category: 'Post-Event', items: postEventAlerts })
  return groups
}

// ─── Prospect snapshot one-liner ─────────────────────────────────────────────

function prospectOneLiner(e: Engagement): { text: string; urgent: boolean } {
  if (e.alerts.length > 0) {
    return { text: e.alerts[0].label, urgent: e.alerts[0].severity === 'high' }
  }
  const comms = e.comms ?? []
  if (comms.length > 0) {
    const last = comms[comms.length - 1]
    const age = daysSince(last.date)
    const ageStr = age === 0 ? 'today' : age === 1 ? 'yesterday' : `${age}d ago`
    if (last.type === 'email_inbound') return { text: `Inbound from ${last.from_name} — ${ageStr}`, urgent: false }
    if (last.type === 'email_outbound') return { text: `${last.subject ?? 'Email sent'} — ${ageStr}`, urgent: false }
    if (last.type === 'call') return { text: `${last.subject ?? 'Call'} — ${ageStr}`, urgent: false }
    if (last.type === 'note') return { text: `Note — ${ageStr}`, urgent: false }
  }
  if (e.notes) return { text: e.notes.split('.')[0], urgent: false }
  return { text: 'No recent activity', urgent: false }
}

// ─── Advance Sheet Carousel ──────────────────────────────────────────────────

const CHECKLIST_FLAGS = [
  { id: 'contract_sent',            label: 'Contract Sent' },
  { id: 'contract_signed',          label: 'Contract Signed' },
  { id: 'client_deliverables_sent', label: 'Client Deliverables Sent' },
  { id: 'advance_sheet_complete',   label: 'Advance Sheet Complete' },
]

function AdvanceSheetCard({ engagement: e }: { engagement: Engagement }) {
  const days = daysUntil(e.event_date!)
  const countStyle = countdownStyle(days)
  const flags = e.engagement_flags
  const isComplete = flags.includes('advance_sheet_complete')

  return (
    <Link href={`/engagements/${e.id}`}
      className="flex-1 min-w-0 bg-white border border-ink-100 rounded-2xl p-5 hover:shadow-md hover:border-gold/20 transition-all group flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-semibold text-ink truncate">{e.organization}</p>
          <p className="text-xs text-ink-400 truncate mt-0.5">{e.event_name || e.topic}</p>
        </div>
        <div className={`flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full border ${countStyle}`}>
          {formatCountdown(days)}
        </div>
      </div>

      {/* Meta */}
      <p className="text-xs text-ink-300">{e.event_city} · {formatDate(e.event_date!)}</p>

      {/* Checklist */}
      <div className="space-y-1.5">
        {CHECKLIST_FLAGS.map(flag => {
          const done = flags.includes(flag.id as typeof flags[number])
          return (
            <div key={flag.id} className={`flex items-center gap-2 text-xs ${done ? 'text-sage-dark' : 'text-ink-300'}`}>
              {done
                ? <CheckCircle2 size={11} className="flex-shrink-0 text-sage" />
                : <Circle size={11} className="flex-shrink-0" />
              }
              {flag.label}
            </div>
          )
        })}
      </div>

      {/* Bottom row: status + advance sheet button */}
      <div className="flex items-center justify-between gap-2 mt-auto">
        <div className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
          isComplete ? 'bg-sage/10 text-sage-dark' : days <= 14 ? 'bg-red-50 text-red-600' : 'bg-parchment text-ink-400'
        }`}>
          {isComplete ? 'Complete' : days <= 14 ? 'Needs attention' : 'In progress'}
        </div>
        <span
          onClick={(ev: React.MouseEvent) => ev.preventDefault()}
          className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-gold/30 text-gold-dark bg-gold/5 hover:bg-gold/10 transition-all cursor-pointer whitespace-nowrap">
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
    <div className="bg-parchment/50 border border-ink-100 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xl font-semibold text-ink">Upcoming Events</h2>
          <span className="text-xs text-ink-400 bg-white border border-ink-100 px-2.5 py-1 rounded-full font-medium">
            {events.length} confirmed
          </span>
        </div>
        <div className="flex items-center gap-2">
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p: number) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-white border border-ink-100 text-ink-400 hover:text-ink hover:border-ink-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs text-ink-400 px-1">{page + 1} / {totalPages}</span>
              <button
                onClick={() => setPage((p: number) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-white border border-ink-100 text-ink-400 hover:text-ink hover:border-ink-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <ChevronRight size={14} />
              </button>
            </div>
          )}
          <Link href="/engagements" className="text-xs text-gold hover:text-gold-dark flex items-center gap-1 font-medium transition-all ml-1">
            All <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      <div className="flex gap-3">
        {visible.map(e => <AdvanceSheetCard key={e.id} engagement={e} />)}
        {/* Pad to always show 3 slots */}
        {visible.length < perPage && Array.from({ length: perPage - visible.length }).map((_, i) => (
          <div key={i} className="flex-1 min-w-0" />
        ))}
      </div>
    </div>
  )
}

// ─── Alert panel ─────────────────────────────────────────────────────────────

function AlertPanel({ groups }: { groups: AlertGroup[] }) {
  const totalRed = groups.flatMap(g => g.items).filter(i => i.severity === 'red').length
  const totalYellow = groups.flatMap(g => g.items).filter(i => i.severity === 'yellow').length

  if (groups.length === 0) return null

  return (
    <div className="bg-white border border-ink-100 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <AlertTriangle size={14} className="text-red-500" />
        <h2 className="font-display text-xl font-semibold text-ink">Needs Attention</h2>
        <div className="ml-auto flex items-center gap-2">
          {totalRed > 0 && (
            <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
              {totalRed} urgent
            </span>
          )}
          {totalYellow > 0 && (
            <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
              {totalYellow} watch
            </span>
          )}
        </div>
      </div>

      <div className="space-y-5">
        {groups.map(group => (
          <div key={group.category}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-300 mb-2">{group.category}</p>
            <div className="space-y-1">
              {/* Red items first */}
              {group.items.filter(i => i.severity === 'red').map((item, idx) => (
                <Link key={idx} href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50/60 transition-all group -mx-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                  <span className="text-sm text-ink-700 flex-1 truncate">{item.label}</span>
                  <ArrowRight size={11} className="text-ink-200 group-hover:text-red-400 transition-all flex-shrink-0" />
                </Link>
              ))}
              {/* Yellow items */}
              {group.items.filter(i => i.severity === 'yellow').map((item, idx) => (
                <Link key={idx} href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-amber-50/40 transition-all group -mx-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                  <span className="text-sm text-ink-500 flex-1 truncate">{item.label}</span>
                  <ArrowRight size={11} className="text-ink-200 group-hover:text-amber-400 transition-all flex-shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const allEngagements = MOCK_ENGAGEMENTS
  const prospects = allEngagements.filter(e => e.section === 'prospects')
  const active = allEngagements.filter(e => e.section === 'engagements')
  const postEvent = allEngagements.filter(e => e.section === 'post-event')

  const total = prospects.length + active.length + postEvent.length || 1
  const pPct = (prospects.length / total) * 100
  const aPct = (active.length / total) * 100
  const pePct = (postEvent.length / total) * 100

  // Upcoming events for carousel: within 2 weeks first, then next 3 beyond that
  const allUpcoming = active
    .filter(e => e.event_date)
    .sort((a, b) => a.event_date! > b.event_date! ? 1 : -1)

  const within2Weeks = allUpcoming.filter(e => daysUntil(e.event_date!) <= 14)
  const beyond2Weeks = allUpcoming.filter(e => daysUntil(e.event_date!) > 14)
  // Show all within-2-weeks + fill to at least 3 from beyond
  const carouselEvents = within2Weeks.length >= 3
    ? within2Weeks
    : [...within2Weeks, ...beyond2Weeks.slice(0, 3 - within2Weeks.length)]

  const alertGroups = buildAlerts(prospects, active, postEvent)
  const reviewCount = MOCK_REVIEW_ITEMS.filter(r => !r.confirmed_by).length
  const needsResponseCount = allEngagements.filter(e => e.comms?.some(c => c.needs_response)).length

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">

      {/* Header */}
      <div className="mb-8 flex items-end justify-between gap-8">
        {/* Greeting */}
        <div className="flex-shrink-0">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="font-display text-4xl font-semibold text-ink">{getGreeting()}.</h1>
          <div className="accent-line mt-3 w-20" />
        </div>

        {/* Pipeline — center */}
        <div className="flex-1 flex flex-col gap-2 pb-1">
          <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
            <div className="rounded-l-full" style={{ width: `${pPct}%`, backgroundColor: '#7A9E87' }} />
            <div style={{ width: `${aPct}%`, backgroundColor: '#C9A84C' }} />
            <div className="rounded-r-full" style={{ width: `${pePct}%`, backgroundColor: '#4A4740' }} />
          </div>
          <div className="flex items-center justify-between">
            {[
              { label: 'Prospects', count: prospects.length, color: '#7A9E87', href: '/prospects' },
              { label: 'Engagements', count: active.length, color: '#C9A84C', href: '/engagements' },
              { label: 'Post-Event', count: postEvent.length, color: '#4A4740', href: '/post-event' },
            ].map(s => (
              <Link key={s.label} href={s.href} className="flex items-center gap-1.5 hover:opacity-70 transition-all">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-xs font-semibold text-ink">{s.count}</span>
                <span className="text-xs text-ink-400">{s.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Action pills */}
        <div className="flex items-center gap-3 flex-shrink-0 pb-1">
          {reviewCount > 0 && (
            <Link href="/review"
              className="flex items-center gap-2 px-4 py-2.5 bg-gold/10 border border-gold/20 rounded-xl hover:bg-gold/15 transition-all group">
              <Bell size={14} className="text-gold" />
              <span className="text-sm font-semibold text-gold-dark">{reviewCount} in Review</span>
              <ArrowRight size={12} className="text-gold/50 group-hover:text-gold transition-all" />
            </Link>
          )}
          {needsResponseCount > 0 && (
            <Link href="/prospects"
              className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100/50 transition-all group">
              <Zap size={14} className="text-red-500" />
              <span className="text-sm font-semibold text-red-600">{needsResponseCount} need reply</span>
              <ArrowRight size={12} className="text-red-300 group-hover:text-red-500 transition-all" />
            </Link>
          )}
        </div>
      </div>

      {/* Advance sheet carousel — full width */}
      {carouselEvents.length > 0 && (
        <div className="mb-5">
          <AdvanceSheetCarousel events={carouselEvents} />
        </div>
      )}

      {/* Main grid — Alerts left, Prospects right, 50/50 */}
      <div className="grid grid-cols-2 gap-5">

        {/* Left — Alerts */}
        <div>
          <AlertPanel groups={alertGroups} />
        </div>

        {/* Right — Prospects snapshot */}
        <div className="bg-white border border-ink-100 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-sage" />
              <h2 className="font-display text-lg font-semibold text-ink">Prospects</h2>
            </div>
            <Link href="/prospects" className="text-xs text-gold hover:text-gold-dark flex items-center gap-1 transition-all">
              View all <ArrowRight size={11} />
            </Link>
          </div>
          <div className="space-y-0.5">
            {prospects.slice(0, 8).map(e => {
              const stepColors: Record<string, string> = {
                inquiry: 'text-blue-600 bg-blue-50',
                outreach: 'text-purple-600 bg-purple-50',
                in_contact: 'text-sage-dark bg-sage/10',
                discussing: 'text-gold-dark bg-gold/10',
                proposal: 'text-amber-700 bg-amber-50',
              }
              const sc = stepColors[e.prospect_step ?? 'inquiry'] ?? 'text-ink-400 bg-parchment'
              const { text: oneLiner, urgent } = prospectOneLiner(e)
              return (
                <Link key={e.id} href={`/prospects/${e.id}`}
                  className="flex items-start gap-3 py-2.5 px-2 rounded-xl hover:bg-parchment transition-all -mx-2 group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-ink truncate">{e.organization}</p>
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full flex-shrink-0 ${sc}`}>
                        {e.prospect_step?.replace('_', ' ')}
                      </span>
                    </div>
                    <p className={`text-xs truncate ${urgent ? 'text-red-500' : 'text-ink-400'}`}>{oneLiner}</p>
                  </div>
                  <ArrowRight size={11} className="text-ink-100 group-hover:text-gold transition-all flex-shrink-0 mt-1" />
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}