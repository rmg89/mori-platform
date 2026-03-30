'use client'
import { useParams } from 'next/navigation'
import { MOCK_ENGAGEMENTS } from '@/lib/mock-data'
import { POST_EVENT_FLAGS, PostEventFlag, primaryContact } from '@/types'
import { formatDate, getInitials } from '@/lib/utils'
import { ArrowLeft, AlertTriangle, CheckCircle2, Circle } from 'lucide-react'
import Link from 'next/link'

export default function PostEventDetailPage() {
  const { id } = useParams()
  const e = MOCK_ENGAGEMENTS.find(e => e.id === id)
  if (!e) return <div className="p-8 text-ink-400">Not found</div>

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fade-in">
      <Link href="/post-event" className="flex items-center gap-2 text-sm text-ink-400 hover:text-ink mb-6 transition-all">
        <ArrowLeft size={14} /> Back to Post-Event
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">{e.event_name || e.organization}</h1>
          <p className="text-ink-400 text-sm mt-1">{e.organization} {e.event_date && `· ${formatDate(e.event_date)}`}{e.fee && ` · $${e.fee.toLocaleString()}`}</p>
          <div className="accent-line mt-3 w-24" />
        </div>
      </div>

      {/* Post-event flags */}
      <div className="bg-white border border-ink-100 rounded-xl p-5 mb-6">
        <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Post-Event Checklist</p>
        <div className="grid grid-cols-2 gap-3">
          {POST_EVENT_FLAGS.map(flag => {
            const done = e.post_event_flags.includes(flag.id as PostEventFlag)
            return (
              <div key={flag.id} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium ${done ? 'bg-sage/8 border-sage/20 text-sage' : 'bg-parchment border-ink-100 text-ink-400'}`}>
                {done ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                {flag.label}
              </div>
            )
          })}
        </div>
      </div>

      {e.alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {e.alerts.map((alert, i) => (
            <div key={i} className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium ${alert.severity === 'high' ? 'text-red-500 bg-red-50 border-red-100' : 'text-gold bg-gold/8 border-gold/20'}`}>
              <AlertTriangle size={14} />{alert.label}
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border border-ink-100 rounded-xl p-5">
        <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Timeline</p>
        <div className="space-y-4">
          {e.comms.map(comm => (
            <div key={comm.id} className={`flex gap-3 ${comm.type === 'email_outbound' ? 'flex-row-reverse' : ''}`}>
              <div className={`text-xs px-3 py-2 rounded-xl max-w-lg ${comm.type === 'email_outbound' ? 'bg-ink text-cream ml-auto' : 'bg-parchment text-ink'}`}>
                {comm.subject && <p className="font-semibold mb-1">{comm.subject}</p>}
                <p>{comm.body}</p>
                <p className="text-[10px] opacity-60 mt-1">{comm.from_name} · {formatDate(comm.date, 'MMM d, h:mm a')}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
