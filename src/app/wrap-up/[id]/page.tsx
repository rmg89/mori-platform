'use client'
import { useParams } from 'next/navigation'
import { useStore } from '@/lib/store'
import { POST_EVENT_FLAGS, PostEventFlag, primaryContact } from '@/types'
import { formatDate, getInitials } from '@/lib/utils'
import { ArrowLeft, AlertTriangle, CheckCircle2, Circle, Clock, Calendar, MapPin, Users, DollarSign, FileText, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

function daysSince(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  const start = new Date(y, m - 1, d)
  const today = new Date(); today.setHours(0,0,0,0)
  return Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

function elapsed(dateStr: string): string {
  const days = daysSince(dateStr)
  if (days === 0) return 'today'
  if (days === 1) return '1 day ago'
  if (days < 7)  return `${days} days ago`
  if (days < 14) return '1 week ago'
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  if (days < 60) return '1 month ago'
  return `${Math.floor(days / 30)} months ago`
}

export default function WrapUpDetailPage() {
  const { id } = useParams()
  const { engagements: allEngagements, togglePostEventFlag } = useStore()
  const e = allEngagements.find(eng => eng.id === id)
  const [aiDismissed, setAiDismissed] = useState(false)

  if (!e) return <div className="p-8 text-ink-400">Not found</div>

  const pc = primaryContact(e)
  const doneCount = e.post_event_flags.length
  const totalCount = POST_EVENT_FLAGS.length
  const allDone = doneCount === totalCount
  const outstanding = totalCount - doneCount
  const sinceEvent = e.event_date ? daysSince(e.event_date) : null

  // Show AI banner if flags haven't been confirmed yet (empty flags = not yet set)
  const showAiBanner = !aiDismissed && doneCount === 0

  const flagIsOverdue = (flagId: PostEventFlag) => {
    if (flagId === 'invoice' && sinceEvent !== null && sinceEvent > 7) return true
    return false
  }

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fade-in">
      <Link href="/wrap-up" className="flex items-center gap-2 text-sm text-ink-400 hover:text-ink mb-6 transition-all">
        <ArrowLeft size={14} /> Back to Wrap-Up
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText size={13} className="text-ink-400" />
            <span className="text-xs text-ink-400 uppercase tracking-widest font-medium">Wrap-Up</span>
          </div>
          <h1 className="font-display text-3xl font-semibold text-ink">{e.event_name || e.organization}</h1>
          <p className="text-ink-400 text-sm mt-1">{e.organization}{e.booker_name ? ` · via ${e.booker_name}` : ''}</p>
          <div className="accent-line mt-3 w-24" />
        </div>
      </div>

      {/* Alerts */}
      {e.alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {e.alerts.map((alert, i) => (
            <div key={i} className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium ${
              alert.severity === 'high' ? 'text-red-500 bg-red-50 border-red-100' : 'text-gold bg-gold/8 border-gold/20'
            }`}>
              <AlertTriangle size={14} />{alert.label}
            </div>
          ))}
        </div>
      )}

      {/* Wrap-Up Items */}
      <div className="bg-white border border-ink-100 rounded-xl mb-6 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-ink-100">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">Wrap-Up Items</p>
          <span className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border ${
            allDone
              ? 'bg-sage/8 border-sage/20 text-sage'
              : outstanding > 0
              ? 'bg-amber-50 border-amber-100 text-amber-600'
              : 'bg-parchment border-ink-100 text-ink-500'
          }`}>
            {allDone ? <CheckCircle2 size={11} /> : <Clock size={11} />}
            {allDone ? 'All done' : `${outstanding} item${outstanding !== 1 ? 's' : ''} outstanding`}
          </span>
        </div>

        {/* AI suggestion banner */}
        {showAiBanner && (
          <div className="px-5 py-3.5 border-b border-ink-100 bg-parchment/60 flex items-start justify-between gap-4">
            <div className="flex items-start gap-2.5">
              <Sparkles size={14} className="text-ink-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-ink-500 leading-relaxed">
                Mark the items that apply to this engagement. All items are available for every engagement — check what needs to be chased.
              </p>
            </div>
            <button
              onClick={() => setAiDismissed(true)}
              className="text-xs text-ink-400 hover:text-ink transition-colors flex-shrink-0 underline underline-offset-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Flag tiles */}
        <div className="p-4 flex flex-wrap gap-3">
          {POST_EVENT_FLAGS.map((flag) => {
            const done = e.post_event_flags.includes(flag.id as PostEventFlag)
            const overdue = flagIsOverdue(flag.id as PostEventFlag)
            return (
              <button
                key={flag.id}
                onClick={() => togglePostEventFlag(e.id, flag.id as PostEventFlag)}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-left transition-all active:scale-[0.98] ${
                  done
                    ? 'bg-sage/8 border-sage/20 hover:bg-sage/12'
                    : overdue
                    ? 'bg-red-50 border-red-100 hover:bg-red-100/60'
                    : 'bg-parchment/40 border-ink-100 hover:bg-parchment hover:border-ink-200'
                }`}
              >
                {done
                  ? <CheckCircle2 size={14} className="text-sage flex-shrink-0" />
                  : <Circle size={14} className={`flex-shrink-0 ${overdue ? 'text-red-300' : 'text-ink-200'}`} />
                }
                <div>
                  <p className={`text-sm font-medium ${
                    done ? 'text-sage-dark' : overdue ? 'text-red-600' : 'text-ink'
                  }`}>
                    {flag.label}
                  </p>
                  {overdue && !done && (
                    <p className="text-[11px] text-red-400 mt-0.5">Overdue</p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Event details + contacts */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-ink-100 rounded-xl p-5">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Event Details</p>
          <div className="space-y-3">
            {e.event_date && (
              <div className="flex items-center gap-2.5 text-sm">
                <Calendar size={14} className="text-ink-300 flex-shrink-0" />
                {formatDate(e.event_date)}
                {sinceEvent !== null && sinceEvent > 0 && (
                  <span className="text-xs text-ink-300">· {elapsed(e.event_date)}</span>
                )}
              </div>
            )}
            {e.event_city && <div className="flex items-center gap-2.5 text-sm"><MapPin size={14} className="text-ink-300 flex-shrink-0" />{e.event_city}</div>}
            {e.session_length && <div className="flex items-center gap-2.5 text-sm"><Clock size={14} className="text-ink-300 flex-shrink-0" />{e.session_length} min</div>}
            {e.audience_size && <div className="flex items-center gap-2.5 text-sm"><Users size={14} className="text-ink-300 flex-shrink-0" />{e.audience_size.toLocaleString()} attendees</div>}
            {e.fee && (
              <div className="flex items-center gap-2.5 text-sm">
                <DollarSign size={14} className="text-ink-300 flex-shrink-0" />
                <span className={e.post_event_flags.includes('invoice') ? 'text-sage font-medium' : ''}>${e.fee.toLocaleString()}</span>
                <span className={`text-xs ${e.post_event_flags.includes('invoice') ? 'text-sage' : 'text-ink-300'}`}>
                  {e.post_event_flags.includes('invoice') ? '· Invoice handled' : '· Invoice pending'}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-ink-100 rounded-xl p-5">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Contacts</p>
          <div className="space-y-3">
            {e.contacts.map(c => (
              <div key={c.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-ink-800 flex items-center justify-center text-xs font-bold text-gold flex-shrink-0">
                  {getInitials(c.first_name, c.last_name)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{c.first_name} {c.last_name}</p>
                  {c.title && <p className="text-xs text-ink-400">{c.title}</p>}
                  <p className="text-xs text-ink-300 truncate">{c.email}</p>
                </div>
                {c.is_current_point_of_contact && (
                  <span className="ml-auto text-[10px] text-gold bg-gold/10 px-2 py-0.5 rounded-full border border-gold/20 flex-shrink-0">POC</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white border border-ink-100 rounded-xl p-5">
        <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Timeline</p>
        <div className="space-y-4">
          {e.comms.map(comm => (
            <div key={comm.id} className={`flex gap-3 ${comm.type === 'email_outbound' ? 'flex-row-reverse' : ''}`}>
              <div className={`text-xs px-3 py-2 rounded-xl max-w-lg ${
                comm.type === 'email_outbound' ? 'bg-ink text-cream ml-auto'
                : comm.type === 'stage_change' ? 'bg-parchment text-ink-400 italic'
                : 'bg-parchment text-ink'
              }`}>
                {comm.subject && <p className="font-semibold mb-1">{comm.subject}</p>}
                <p className="whitespace-pre-line">{comm.body}</p>
                <p className="text-[10px] opacity-60 mt-1">{comm.from_name} · {formatDate(comm.date, 'MMM d, h:mm a')}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}