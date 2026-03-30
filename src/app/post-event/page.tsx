'use client'
import { MOCK_ENGAGEMENTS } from '@/lib/mock-data'
import { Engagement, POST_EVENT_FLAGS, PostEventFlag, primaryContact } from '@/types'
import { formatDate, getInitials } from '@/lib/utils'
import { AlertTriangle, Calendar, ArrowRight, Users, CheckCircle2, Circle } from 'lucide-react'
import Link from 'next/link'

export default function PostEventPage() {
  const postEvents = MOCK_ENGAGEMENTS.filter(e => e.section === 'post-event')
  const incomplete = postEvents.filter(e => !e.post_event_flags.includes('marked_complete'))
  const complete = postEvents.filter(e => e.post_event_flags.includes('marked_complete'))
  const totalAlerts = postEvents.reduce((n, e) => n + e.alerts.length, 0)

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Post-Event</h1>
          <p className="text-ink-400 text-sm mt-1">
            {incomplete.length} in progress · {complete.length} complete
            {totalAlerts > 0 && (
              <span className="text-red-500 font-medium ml-2">· {totalAlerts} need{totalAlerts === 1 ? 's' : ''} attention</span>
            )}
          </p>
          <div className="accent-line mt-3 w-24" />
        </div>
      </div>

      {incomplete.length > 0 && (
        <div className="mb-8">
          <h2 className="font-display text-lg font-semibold text-ink mb-3">In Progress</h2>
          <div className="grid grid-cols-1 gap-3">
            {incomplete.map(e => <PostEventCard key={e.id} engagement={e} />)}
          </div>
        </div>
      )}

      {complete.length > 0 && (
        <div>
          <h2 className="font-display text-lg font-semibold text-ink mb-3 text-ink-400">Completed</h2>
          <div className="grid grid-cols-1 gap-3 opacity-70">
            {complete.map(e => <PostEventCard key={e.id} engagement={e} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function PostEventCard({ engagement: e }: { engagement: Engagement }) {
  const pc = primaryContact(e)
  const isComplete = e.post_event_flags.includes('marked_complete')

  return (
    <Link
      href={`/post-event/${e.id}`}
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
              </p>
            </div>
            <div className="flex-shrink-0 text-right space-y-1">
              {e.event_date && (
                <p className="text-xs text-ink-400 flex items-center gap-1 justify-end">
                  <Calendar size={10} />{formatDate(e.event_date, 'MMM d, yyyy')}
                </p>
              )}
            </div>
            <ArrowRight size={14} className="text-ink-200 group-hover:text-gold transition-all flex-shrink-0 mt-1" />
          </div>

          {/* Post-event flags */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {POST_EVENT_FLAGS.map(flag => {
              const done = e.post_event_flags.includes(flag.id as PostEventFlag)
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
