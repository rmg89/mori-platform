'use client'
import { useStore } from '@/lib/store'
import { POST_EVENT_FLAGS, PostEventFlag, Engagement, primaryContact } from '@/types'
import { formatDate, getInitials } from '@/lib/utils'
import { AlertTriangle, ArrowRight, Calendar, CheckCircle2, Circle, MapPin } from 'lucide-react'
import Link from 'next/link'

function PostEventCard({ engagement: e }: { engagement: Engagement }) {
  const pc = primaryContact(e)
  const doneCount = POST_EVENT_FLAGS.filter(f => e.post_event_flags.includes(f.id as PostEventFlag)).length
  const allDone = doneCount === POST_EVENT_FLAGS.length
  const hasAlerts = e.alerts.length > 0

  return (
    <Link href={`/post-event/${e.id}`}
      className="bg-white border border-ink-100 rounded-2xl p-5 hover:shadow-md hover:border-gold/20 transition-all group block">
      <div className="flex items-start gap-4">
        {pc && (
          <div className="w-10 h-10 rounded-full bg-ink-800 flex items-center justify-center text-sm font-bold text-gold flex-shrink-0 mt-0.5">
            {getInitials(pc.first_name, pc.last_name)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="min-w-0">
              <p className="text-base font-semibold text-ink truncate">{e.organization}</p>
              <p className="text-sm text-ink-400 truncate">{e.event_name || e.topic}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {hasAlerts && <AlertTriangle size={13} className="text-amber-500" />}
              {allDone && <CheckCircle2 size={13} className="text-sage" />}
              <ArrowRight size={13} className="text-ink-200 group-hover:text-gold transition-all" />
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-ink-400 mb-4">
            {e.event_date && <span className="flex items-center gap-1"><Calendar size={11} />{formatDate(e.event_date)}</span>}
            {e.event_city && <span className="flex items-center gap-1"><MapPin size={11} />{e.event_city}</span>}
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {POST_EVENT_FLAGS.map(flag => {
              const done = e.post_event_flags.includes(flag.id as PostEventFlag)
              return (
                <div key={flag.id}
                  className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                    done ? 'bg-sage/8 border-sage/20 text-sage-dark' : 'bg-parchment border-ink-100 text-ink-300'
                  }`}>
                  {done ? <CheckCircle2 size={10} /> : <Circle size={10} />}
                  {flag.label}
                </div>
              )
            })}
          </div>

          {hasAlerts && (
            <div className="mt-3 space-y-1">
              {e.alerts.map((a, i) => (
                <p key={i} className={`text-xs flex items-center gap-1.5 ${a.severity === 'high' ? 'text-red-500' : 'text-amber-600'}`}>
                  <AlertTriangle size={10} />{a.label}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

export default function PostEventPage() {
  const { engagements: allEngagements } = useStore()
  const engagements = allEngagements.filter(e => e.section === 'post-event')
  const pendingCount = engagements.filter(e =>
    e.post_event_flags.length < POST_EVENT_FLAGS.length
  ).length

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-ink">Post-Event</h1>
        <p className="text-ink-400 text-sm mt-1">
          {engagements.length} total
          {pendingCount > 0 && (
            <span className="text-amber-600 font-medium ml-2">· {pendingCount} with open items</span>
          )}
        </p>
        <div className="accent-line mt-3 w-24" />
      </div>

      {engagements.length === 0 ? (
        <p className="text-sm text-ink-400">No post-event engagements.</p>
      ) : (
        <div className="space-y-3">
          {engagements
            .sort((a, b) => (a.event_date ?? '') > (b.event_date ?? '') ? -1 : 1)
            .map(e => <PostEventCard key={e.id} engagement={e} />)
          }
        </div>
      )}
    </div>
  )
}