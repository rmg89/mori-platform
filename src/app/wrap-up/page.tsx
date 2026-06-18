'use client'
import { useStore } from '@/lib/store'
import { POST_EVENT_FLAGS, PostEventFlag, Engagement, primaryContact } from '@/types'
import { formatDate, getInitials, formatRelativeDue } from '@/lib/utils'
import { AlertTriangle, ArrowRight, Calendar, CheckCircle2, Circle, MapPin, Clock } from 'lucide-react'
import Link from 'next/link'

function WrapUpCard({ engagement: e }: { engagement: Engagement }) {
  const pc = primaryContact(e)
  const done = e.post_event_flags ?? []
  const needed = e.post_event_needed ?? []
  const notNeeded = e.post_event_not_needed ?? []
  const allDone = needed.length === 0 && done.length > 0 && notNeeded.length + done.length === POST_EVENT_FLAGS.length
  const hasAlerts = e.alerts.length > 0
  const outstandingCount = needed.length

  return (
    <Link href={`/wrap-up/${e.id}`}
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
              const isDone = done.includes(flag.id as PostEventFlag)
              const isNeeded = needed.includes(flag.id as PostEventFlag)
              const isNotNeeded = notNeeded.includes(flag.id as PostEventFlag)
              if (isNotNeeded) return null
              if (!isDone && !isNeeded) return null
              return (
                <div key={flag.id}
                  className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                    isDone ? 'bg-sage/8 border-sage/20 text-sage-dark' : 'bg-amber-50 border-amber-100 text-amber-700'
                  }`}>
                  {isDone ? <CheckCircle2 size={10} /> : <Circle size={10} />}
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

function WrapUpReviewCard({ engagement: e, onConfirm }: { engagement: Engagement; onConfirm: () => void }) {
  const pc = primaryContact(e)
  const needed = e.post_event_needed ?? []
  const notNeeded = e.post_event_not_needed ?? []
  const lastNote = e.briefing_notes && e.briefing_notes.length > 0 ? e.briefing_notes[e.briefing_notes.length - 1] : undefined
  const isDeclined = e.prospect_step === 'declined'

  return (
    <div className="bg-amber-50/40 border border-amber-200 rounded-2xl p-5">
      <div className="flex items-start gap-4">
        {pc && (
          <div className="w-10 h-10 rounded-full bg-ink-800 flex items-center justify-center text-sm font-bold text-gold flex-shrink-0 mt-0.5">
            {getInitials(pc.first_name, pc.last_name)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <Link href={`/wrap-up/${e.id}`} className="block group">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-base font-semibold text-ink truncate group-hover:text-gold transition-all">{e.organization}</p>
              {isDeclined && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-ink-50 border-ink-100 text-ink-400 flex-shrink-0">Declined</span>
              )}
            </div>
            <p className="text-sm text-ink-400 truncate">{e.event_name || e.topic}</p>
          </Link>

          <div className="flex items-center gap-4 text-xs text-ink-400 my-3">
            {e.event_date && <span className="flex items-center gap-1"><Calendar size={11} />{formatDate(e.event_date)}</span>}
            {e.event_city && <span className="flex items-center gap-1"><MapPin size={11} />{e.event_city}</span>}
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {needed.map(flag => {
              const label = POST_EVENT_FLAGS.find(f => f.id === flag)?.label ?? flag
              return (
                <span key={flag} className="text-[11px] font-medium px-2.5 py-1 rounded-full border bg-amber-50 border-amber-100 text-amber-700">{label}</span>
              )
            })}
            {notNeeded.map(flag => {
              const label = POST_EVENT_FLAGS.find(f => f.id === flag)?.label ?? flag
              return (
                <span key={flag} className="text-[11px] font-medium px-2.5 py-1 rounded-full border bg-parchment border-ink-100 text-ink-300 line-through">{label}</span>
              )
            })}
          </div>

          {lastNote && (
            <p className="text-xs text-ink-400 mt-3 line-clamp-2">{lastNote.body}</p>
          )}

          <div className="mt-4 flex items-center justify-between">
            <Link href={`/wrap-up/${e.id}`} className="text-xs text-ink-400 hover:text-ink flex items-center gap-1 transition-all">
              View details <ArrowRight size={11} />
            </Link>
            <button onClick={onConfirm}
              className="text-xs font-medium text-white bg-ink px-4 py-2 rounded-lg hover:bg-ink-700 transition-all">
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function FollowUpCard({ engagement: e }: { engagement: Engagement }) {
  const overdue = (() => {
    if (!e.post_event_follow_up_date) return false
    const [y, m, d] = e.post_event_follow_up_date.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return date.getTime() < today.getTime()
  })()

  return (
    <Link href={`/wrap-up/${e.id}`}
      className="flex items-center justify-between gap-4 bg-white border border-ink-100 rounded-xl px-4 py-3 hover:border-gold/20 hover:shadow-sm transition-all group">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink truncate">{e.organization}</p>
        {e.post_event_follow_up_details ? (
          <p className="text-xs text-ink-400 truncate mt-0.5">{e.post_event_follow_up_details}</p>
        ) : (
          <p className="text-xs text-ink-300 truncate mt-0.5">{e.event_name || e.topic}</p>
        )}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
          overdue ? 'bg-red-50 border-red-100 text-red-500' : 'bg-amber-50 border-amber-100 text-amber-700'
        }`}>
          <Clock size={11} />
          {formatRelativeDue(e.post_event_follow_up_date!)}
        </span>
        <ArrowRight size={13} className="text-ink-200 group-hover:text-gold transition-all" />
      </div>
    </Link>
  )
}

export default function WrapUpPage() {
  const { engagements: allEngagements, confirmWrapUpReview } = useStore()
  const all = allEngagements.filter(e => e.section === 'wrap-up' && !e.archived)
  const reviewItems = all.filter(e => e.wrap_up_review_needed)
  const engagements = all.filter(e => !e.wrap_up_review_needed)
  const pendingCount = engagements.filter(e => (e.post_event_needed ?? []).length > 0).length
  const followUps = all
    .filter(e => e.post_event_follow_up_date && !(e.post_event_flags ?? []).includes('follow_up'))
    .sort((a, b) => (a.post_event_follow_up_date! < b.post_event_follow_up_date! ? -1 : 1))

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-ink">Wrap-Up</h1>
        <p className="text-ink-400 text-sm mt-1">
          {engagements.length} total
          {reviewItems.length > 0 && (
            <span className="text-amber-600 font-medium ml-2">· {reviewItems.length} need{reviewItems.length === 1 ? 's' : ''} review</span>
          )}
          {pendingCount > 0 && (
            <span className="text-amber-600 font-medium ml-2">· {pendingCount} with open items</span>
          )}
        </p>
        <div className="accent-line mt-3 w-24" />
      </div>

      {reviewItems.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-amber-500" />
            <h2 className="text-sm font-semibold text-ink uppercase tracking-widest">Needs Review</h2>
          </div>
          <div className="space-y-3">
            {reviewItems.map(e => (
              <WrapUpReviewCard key={e.id} engagement={e} onConfirm={() => confirmWrapUpReview(e.id)} />
            ))}
          </div>
        </div>
      )}

      {engagements.length === 0 ? (
        <p className="text-sm text-ink-400">No engagements in wrap-up.</p>
      ) : (
        <div className="space-y-3">
          {engagements
            .sort((a, b) => (a.event_date ?? '') > (b.event_date ?? '') ? -1 : 1)
            .map(e => <WrapUpCard key={e.id} engagement={e} />)
          }
        </div>
      )}

      {followUps.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-ink-300" />
            <h2 className="text-sm font-semibold text-ink uppercase tracking-widest">Upcoming Follow-Ups</h2>
          </div>
          <div className="space-y-2">
            {followUps.map(e => <FollowUpCard key={e.id} engagement={e} />)}
          </div>
        </div>
      )}
    </div>
  )
}