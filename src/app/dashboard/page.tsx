'use client'
import { MOCK_ENGAGEMENTS } from '@/lib/mock-data'
import { primaryContact } from '@/types'
import { formatDate, getInitials } from '@/lib/utils'
import { TrendingUp, Calendar, Users, ArrowRight, AlertTriangle, Archive } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const engagements = MOCK_ENGAGEMENTS
  const prospects = engagements.filter(e => e.section === 'prospects')
  const active = engagements.filter(e => e.section === 'engagements')
  const postEvent = engagements.filter(e => e.section === 'post-event')

  const allAlerts = engagements
    .flatMap(e => e.alerts.map(a => ({ ...a, engagement: e })))
    .filter(a => a.severity === 'high')

  const upcoming = engagements
    .filter(e => e.event_date && e.section === 'engagements')
    .sort((a, b) => a.event_date! > b.event_date! ? 1 : -1)
    .slice(0, 4)

  const recent = [...engagements]
    .sort((a, b) => a.last_activity_at > b.last_activity_at ? -1 : 1)
    .slice(0, 5)

  const statCards = [
    { label: 'Prospects', value: prospects.length, icon: Users, color: 'text-sage', href: '/prospects' },
    { label: 'Active Engagements', value: active.length, icon: Calendar, color: 'text-gold', href: '/engagements' },
    { label: 'Upcoming Events', value: upcoming.length, icon: TrendingUp, color: 'text-sage-dark', href: '/engagements' },
    { label: 'Post-Event', value: postEvent.length, icon: Archive, color: 'text-gold-dark', href: '/post-event' },
  ]

  const sectionBreakdown = [
    { label: 'Prospects', count: prospects.length, color: '#7A9E87', href: '/prospects' },
    { label: 'Engagements', count: active.length, color: '#C9A84C', href: '/engagements' },
    { label: 'Post-Event', count: postEvent.length, color: '#4A4740', href: '/post-event' },
  ]

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-ink">Good morning.</h1>
        <p className="text-ink-400 text-sm mt-1">Here's where everything stands today.</p>
        <div className="accent-line mt-3 w-24" />
      </div>

      {/* Alerts banner */}
      {allAlerts.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-red-500" />
            <p className="text-sm font-semibold text-red-600">{allAlerts.length} item{allAlerts.length > 1 ? 's' : ''} need your attention</p>
          </div>
          <div className="space-y-2">
            {allAlerts.map((a, i) => {
              const href = `/${a.engagement.section}/${a.engagement.id}`
              return (
                <Link key={i} href={href} className="flex items-center gap-3 hover:opacity-80 transition-all">
                  <span className="text-xs text-red-500 font-medium flex-shrink-0">{a.engagement.organization}</span>
                  <span className="text-xs text-red-400">·</span>
                  <span className="text-xs text-red-400">{a.label}</span>
                  <ArrowRight size={11} className="text-red-300 ml-auto" />
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {statCards.map(({ label, value, icon: Icon, color, href }) => (
          <Link key={label} href={href} className="bg-white border border-ink-100 rounded-xl p-5 hover:shadow-md hover:border-gold/20 transition-all">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-ink-400 uppercase tracking-widest font-medium">{label}</p>
                <p className={`text-2xl font-semibold mt-1.5 ${color}`}>{value}</p>
              </div>
              <div className={`p-2 rounded-lg bg-parchment ${color}`}><Icon size={18} /></div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Section breakdown */}
        <div className="col-span-1 bg-white border border-ink-100 rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-lg font-semibold">By Section</h2>
          </div>
          <div className="space-y-4">
            {sectionBreakdown.map(section => (
              <Link key={section.label} href={section.href} className="block hover:opacity-80 transition-all">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: section.color }} />
                    <span className="text-sm text-ink-600 font-medium">{section.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-ink">{section.count}</span>
                </div>
                <div className="w-full bg-parchment rounded-full h-1.5">
                  <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, (section.count / engagements.length) * 100)}%`, backgroundColor: section.color }} />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Upcoming events */}
        <div className="col-span-2 bg-white border border-ink-100 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold">Upcoming Events</h2>
            <Link href="/engagements" className="text-xs text-gold hover:text-gold-dark flex items-center gap-1">View all <ArrowRight size={12} /></Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-ink-400">No confirmed upcoming events.</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map(e => {
                const pc = primaryContact(e)
                return (
                  <Link key={e.id} href={`/engagements/${e.id}`}
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-parchment transition-all group">
                    {pc && (
                      <div className="w-9 h-9 rounded-full bg-ink-800 flex items-center justify-center text-xs font-bold text-gold flex-shrink-0">
                        {getInitials(pc.first_name, pc.last_name)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{e.event_name || e.topic}</p>
                      <p className="text-xs text-ink-400 truncate">{e.organization} · {e.event_city}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-gold">{formatDate(e.event_date!)}</p>
                      <p className="text-xs text-ink-400">{e.event_city}</p>
                    </div>
                    <ArrowRight size={14} className="text-ink-200 group-hover:text-gold transition-all" />
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="mt-6 bg-white border border-ink-100 rounded-xl p-6">
        <h2 className="font-display text-lg font-semibold mb-4">Recent Activity</h2>
        <div className="divide-y divide-ink-50">
          {recent.map(e => {
            const pc = primaryContact(e)
            const sectionLabel = e.section === 'post-event' ? 'Post-Event' : e.section.charAt(0).toUpperCase() + e.section.slice(1)
            const sectionColor = e.section === 'prospects' ? '#7A9E87' : e.section === 'engagements' ? '#C9A84C' : '#4A4740'
            const href = `/${e.section}/${e.id}`
            return (
              <Link key={e.id} href={href}
                className="flex items-center gap-4 py-3 hover:bg-parchment -mx-2 px-2 rounded-lg transition-all group">
                {pc && (
                  <div className="w-8 h-8 rounded-full bg-ink-800 flex items-center justify-center text-xs font-bold text-gold flex-shrink-0">
                    {getInitials(pc.first_name, pc.last_name)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink">{e.organization}</p>
                  <p className="text-xs text-ink-400 truncate">{e.event_name || e.topic || '—'}</p>
                </div>
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: sectionColor + '18', color: sectionColor }}>
                  {sectionLabel}
                </span>
                {e.alerts.length > 0 && (
                  <AlertTriangle size={13} className="text-red-400 flex-shrink-0" />
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
