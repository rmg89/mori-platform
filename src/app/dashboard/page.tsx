'use client'

import { MOCK_ENGAGEMENTS, MOCK_REVIEW_ITEMS } from '@/lib/mock-data'
import { primaryContact } from '@/types'
import { formatDate, getInitials } from '@/lib/utils'
import {
  AlertTriangle, ArrowRight, Bell,
  CheckCircle2, Clock, FileText, TrendingUp, Users, Zap
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

function formatDaysUntil(days: number): { top: string; bottom: string } {
  if (days < 0) return { top: `${Math.abs(days)}`, bottom: 'ago' }
  if (days === 0) return { top: 'To', bottom: 'day' }
  if (days === 1) return { top: 'To', bottom: 'morr' }
  if (days < 7) return { top: `${days}`, bottom: 'days' }
  if (days < 30) return { top: `${Math.round(days / 7)}`, bottom: 'wks' }
  return { top: `${Math.round(days / 30)}`, bottom: 'mo' }
}

function urgencyStyles(days: number) {
  if (days <= 0) return { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700' }
  if (days <= 7) return { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' }
  if (days <= 21) return { bg: 'bg-gold/5', border: 'border-gold/20', badge: 'bg-gold/10 text-gold-dark' }
  return { bg: 'bg-white', border: 'border-ink-100', badge: 'bg-parchment text-ink-500' }
}

// ─── Derived data ───────────────────────────────────────────────────────────

const engagements = MOCK_ENGAGEMENTS
const prospects = engagements.filter(e => e.section === 'prospects')
const active = engagements.filter(e => e.section === 'engagements')
const postEvent = engagements.filter(e => e.section === 'post-event')

const highAlerts = engagements
  .flatMap(e => e.alerts.map(a => ({ ...a, engagement: e })))
  .filter(a => a.severity === 'high')

const upcomingEvents = engagements
  .filter(e => e.event_date && e.section === 'engagements')
  .sort((a, b) => (a.event_date! > b.event_date! ? 1 : -1))
  .slice(0, 6)

const pendingInvoices = postEvent.filter(
  e => e.post_event_flags.includes('invoice_sent') && !e.post_event_flags.includes('invoice_paid')
)
const unpaidTotal = pendingInvoices.reduce((sum, e) => sum + (e.fee ?? 0), 0)

const reviewCount = MOCK_REVIEW_ITEMS.filter(r => !r.confirmed_by).length
const needsResponseCount = engagements.filter(e => e.comms?.some(c => c.needs_response)).length

// ─── Page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const total = prospects.length + active.length + postEvent.length || 1
  const pPct = (prospects.length / total) * 100
  const aPct = (active.length / total) * 100
  const pePct = (postEvent.length / total) * 100

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">

      {/* Header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="font-display text-4xl font-semibold text-ink">{getGreeting()}.</h1>
          <div className="accent-line mt-3 w-20" />
        </div>

        <div className="flex items-center gap-3">
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

      {/* Main grid */}
      <div className="grid grid-cols-12 gap-5">

        {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
        <div className="col-span-4 flex flex-col gap-5">

          {/* Pipeline */}
          <div className="bg-white border border-ink-100 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl font-semibold text-ink">Pipeline</h2>
              <span className="text-xs text-ink-400 font-medium">{engagements.length} total</span>
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5 mb-5">
              <div className="rounded-l-full" style={{ width: `${pPct}%`, backgroundColor: '#7A9E87' }} />
              <div style={{ width: `${aPct}%`, backgroundColor: '#C9A84C' }} />
              <div className="rounded-r-full" style={{ width: `${pePct}%`, backgroundColor: '#4A4740' }} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Prospects', count: prospects.length, color: '#7A9E87', href: '/prospects' },
                { label: 'Engagements', count: active.length, color: '#C9A84C', href: '/engagements' },
                { label: 'Post-Event', count: postEvent.length, color: '#4A4740', href: '/post-event' },
              ].map(s => (
                <Link key={s.label} href={s.href}
                  className="flex flex-col gap-1 p-3 rounded-xl hover:bg-parchment transition-all">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-[10px] text-ink-400 font-medium">{s.label}</span>
                  </div>
                  <span className="text-2xl font-semibold text-ink pl-3.5">{s.count}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Revenue */}
          <div className="bg-white border border-ink-100 rounded-2xl p-6">
            <h2 className="font-display text-xl font-semibold text-ink mb-5">Revenue</h2>
            <div className="space-y-0 divide-y divide-ink-50">
              <div className="flex items-center justify-between py-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-sage/10 flex items-center justify-center">
                    <TrendingUp size={13} className="text-sage" />
                  </div>
                  <div>
                    <p className="text-[11px] text-ink-400 uppercase tracking-wide">In progress</p>
                    <p className="text-base font-semibold text-ink">
                      ${active.reduce((s, e) => s + (e.fee ?? 0), 0).toLocaleString()}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-ink-300">{active.length} events</span>
              </div>

              {unpaidTotal > 0 && (
                <div className="flex items-center justify-between py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                      <Clock size={13} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="text-[11px] text-ink-400 uppercase tracking-wide">Invoices out</p>
                      <p className="text-base font-semibold text-amber-700">${unpaidTotal.toLocaleString()}</p>
                    </div>
                  </div>
                  <Link href="/post-event" className="text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1 transition-all">
                    {pendingInvoices.length} unpaid <ArrowRight size={10} />
                  </Link>
                </div>
              )}

              <div className="flex items-center justify-between py-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-ink-50 flex items-center justify-center">
                    <CheckCircle2 size={13} className="text-ink-400" />
                  </div>
                  <div>
                    <p className="text-[11px] text-ink-400 uppercase tracking-wide">Post-event</p>
                    <p className="text-base font-semibold text-ink">
                      ${postEvent.reduce((s, e) => s + (e.fee ?? 0), 0).toLocaleString()}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-ink-300">{postEvent.length} events</span>
              </div>
            </div>
          </div>

          {/* Urgent */}
          {highAlerts.length > 0 && (
            <div className="bg-white border border-red-100 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={14} className="text-red-500" />
                <h2 className="font-display text-xl font-semibold text-ink">Needs Attention</h2>
                <span className="ml-auto text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                  {highAlerts.length}
                </span>
              </div>
              <div className="space-y-0.5">
                {highAlerts.map((a, i) => (
                  <Link key={i} href={`/${a.engagement.section}/${a.engagement.id}`}
                    className="flex items-start gap-3 px-3 py-2.5 hover:bg-red-50/60 transition-all group rounded-xl -mx-1">
                    <AlertTriangle size={12} className="text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink-800">{a.engagement.organization}</p>
                      <p className="text-xs text-red-500 truncate mt-0.5">{a.label}</p>
                    </div>
                    <ArrowRight size={12} className="text-red-200 group-hover:text-red-500 transition-all mt-1 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN ────────────────────────────────────────────────── */}
        <div className="col-span-8 flex flex-col gap-5">

          {/* Upcoming Events */}
          <div className="bg-white border border-ink-100 rounded-2xl p-6 flex-1">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-xl font-semibold text-ink">Upcoming Events</h2>
                <span className="text-xs text-ink-400 bg-parchment px-2.5 py-1 rounded-full font-medium">
                  {upcomingEvents.length} confirmed
                </span>
              </div>
              <Link href="/engagements" className="text-xs text-gold hover:text-gold-dark flex items-center gap-1 font-medium transition-all">
                All <ArrowRight size={12} />
              </Link>
            </div>

            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-ink-400 py-8 text-center">No confirmed upcoming events.</p>
            ) : (
              <div className="space-y-2.5">
                {upcomingEvents.map(e => {
                  const pc = primaryContact(e)
                  const days = daysUntil(e.event_date!)
                  const dl = formatDaysUntil(days)
                  const s = urgencyStyles(days)
                  return (
                    <Link key={e.id} href={`/engagements/${e.id}`}
                      className={`flex items-center gap-4 p-3.5 rounded-xl border transition-all group hover:shadow-sm ${s.bg} ${s.border}`}>
                      {/* Countdown badge */}
                      <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center ${s.badge}`}>
                        <span className="text-xl font-bold leading-none">{dl.top}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wide leading-tight">{dl.bottom}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-ink truncate">{e.organization}</p>
                          {e.alerts.length > 0 && <AlertTriangle size={11} className="text-amber-500 flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-ink-400 truncate">{e.event_name || e.topic}</p>
                        <p className="text-xs text-ink-300 mt-0.5">{e.event_city} · {formatDate(e.event_date!)}</p>
                      </div>
                      {pc && (
                        <div className="w-8 h-8 rounded-full bg-ink-800 flex items-center justify-center text-xs font-bold text-gold flex-shrink-0">
                          {getInitials(pc.first_name, pc.last_name)}
                        </div>
                      )}
                      <ArrowRight size={13} className="text-ink-200 group-hover:text-gold transition-all flex-shrink-0" />
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Bottom row */}
          <div className="grid grid-cols-2 gap-5">

            {/* Active prospects */}
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
                {prospects.slice(0, 5).map(e => {
                  const pc = primaryContact(e)
                  const stepColors: Record<string, string> = {
                    inquiry: 'text-blue-600 bg-blue-50',
                    outreach: 'text-purple-600 bg-purple-50',
                    in_contact: 'text-sage-dark bg-sage/10',
                    discussing: 'text-gold-dark bg-gold/10',
                    proposal: 'text-amber-700 bg-amber-50',
                  }
                  const sc = stepColors[e.prospect_step ?? 'inquiry'] ?? 'text-ink-400 bg-parchment'
                  return (
                    <Link key={e.id} href={`/prospects/${e.id}`}
                      className="flex items-center gap-3 py-2.5 px-2 rounded-xl hover:bg-parchment transition-all -mx-2">
                      {pc && (
                        <div className="w-7 h-7 rounded-full bg-ink-800 flex items-center justify-center text-[10px] font-bold text-gold flex-shrink-0">
                          {getInitials(pc.first_name, pc.last_name)}
                        </div>
                      )}
                      <p className="text-sm font-medium text-ink flex-1 truncate">{e.organization}</p>
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full flex-shrink-0 ${sc}`}>
                        {e.prospect_step?.replace('_', ' ')}
                      </span>
                      {e.alerts.length > 0 && <AlertTriangle size={10} className="text-red-400 flex-shrink-0" />}
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Status checklist */}
            <div className="bg-white border border-ink-100 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText size={14} className="text-gold" />
                <h2 className="font-display text-lg font-semibold text-ink">Status</h2>
              </div>
              <div className="divide-y divide-ink-50">
                {[
                  {
                    label: 'Contracts pending signature',
                    count: active.filter(e => e.engagement_flags.includes('contract_sent') && !e.engagement_flags.includes('contract_signed')).length,
                    href: '/engagements',
                    warnColor: 'text-amber-600',
                  },
                  {
                    label: 'Client deliverables not sent',
                    count: active.filter(e => e.engagement_flags.includes('contract_signed') && !e.engagement_flags.includes('client_deliverables_sent')).length,
                    href: '/engagements',
                    warnColor: 'text-red-500',
                  },
                  {
                    label: 'Advance sheet complete',
                    count: active.filter(e => e.engagement_flags.includes('advance_sheet_complete')).length,
                    href: '/engagements',
                    warnColor: 'text-sage',
                  },
                  {
                    label: 'Invoices unpaid',
                    count: pendingInvoices.length,
                    href: '/post-event',
                    warnColor: 'text-amber-600',
                  },
                  {
                    label: 'Review queue',
                    count: reviewCount,
                    href: '/review',
                    warnColor: 'text-gold-dark',
                  },
                ].map(item => (
                  <Link key={item.label} href={item.href}
                    className="flex items-center justify-between py-2.5 hover:opacity-70 transition-all">
                    <span className="text-sm text-ink-500">{item.label}</span>
                    <span className={`text-sm font-bold ${item.count > 0 ? item.warnColor : 'text-ink-300'}`}>
                      {item.count}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}