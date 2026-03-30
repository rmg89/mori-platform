'use client'
import { MOCK_ENGAGEMENTS } from '@/lib/mock-data'
import { Engagement, ENGAGEMENT_FLAGS, EngagementFlag, primaryContact } from '@/types'
import { formatDate, getInitials } from '@/lib/utils'
import { Plus, AlertTriangle, Calendar, ArrowRight, Users, CheckCircle2, Circle } from 'lucide-react'
import Link from 'next/link'

export default function EngagementsPage() {
  const engagements = MOCK_ENGAGEMENTS.filter(e => e.section === 'engagements')
  const totalAlerts = engagements.reduce((n, e) => n + e.alerts.length, 0)

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Engagements</h1>
          <p className="text-ink-400 text-sm mt-1">
            {engagements.length} confirmed
            {totalAlerts > 0 && (
              <span className="text-red-500 font-medium ml-2">· {totalAlerts} need{totalAlerts === 1 ? 's' : ''} attention</span>
            )}
          </p>
          <div className="accent-line mt-3 w-24" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {engagements.map(e => <EngagementCard key={e.id} engagement={e} />)}
      </div>
    </div>
  )
}

function EngagementCard({ engagement: e }: { engagement: Engagement }) {
  const pc = primaryContact(e)

  return (
    <Link
      href={`/engagements/${e.id}`}
      className="bg-white border border-ink-100 rounded-xl px-5 py-4 hover:border-gold/30 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start gap-4">
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
            <div className="flex-shrink-0 text-right space-y-1">
              {e.event_date && (
                <p className="text-xs text-ink-400 flex items-center gap-1 justify-end">
                  <Calendar size={10} />{formatDate(e.event_date, 'MMM d, yyyy')}
                </p>
              )}
              {e.event_city && <p className="text-xs text-ink-300">{e.event_city}</p>}
            </div>
            <ArrowRight size={14} className="text-ink-200 group-hover:text-gold transition-all flex-shrink-0 mt-1" />
          </div>

          {/* Flags */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {ENGAGEMENT_FLAGS.map(flag => {
              const done = e.engagement_flags.includes(flag.id as EngagementFlag)
              return (
                <div key={flag.id} className={`flex items-center gap-1.5 text-[11px] font-medium ${done ? 'text-sage' : 'text-ink-300'}`}>
                  {done
                    ? <CheckCircle2 size={12} className="text-sage" />
                    : <Circle size={12} className="text-ink-200" />}
                  {flag.label}
                </div>
              )
            })}
          </div>

          {/* Alerts */}
          {e.alerts.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2.5">
              {e.alerts.map((alert, i) => (
                <span key={i} className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md border ${alert.severity === 'high' ? 'text-red-500 bg-red-50 border-red-100' : 'text-gold bg-gold/8 border-gold/20'}`}>
                  <AlertTriangle size={9} />{alert.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
