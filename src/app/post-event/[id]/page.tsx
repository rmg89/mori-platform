'use client'
import { useParams } from 'next/navigation'
import { useStore } from '@/lib/store'
import { POST_EVENT_FLAGS, PostEventFlag } from '@/types'
import { formatDate } from '@/lib/utils'
import { ArrowLeft, AlertTriangle, CheckCircle2, Circle, Clock } from 'lucide-react'
import Link from 'next/link'

function daysBetween(from: string, to?: string): number {
  const start = new Date(from)
  const end = to ? new Date(to) : new Date()
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

export default function PostEventDetailPage() {
  const { id } = useParams()
  const { engagements: allEngagements, togglePostEventFlag } = useStore()
  const e = allEngagements.find(e => e.id === id)
  if (!e) return <div className="p-8 text-ink-400">Not found</div>

  const invoiceSent = e.post_event_flags.includes('invoice_sent')
  const allDone = POST_EVENT_FLAGS.every(f => e.post_event_flags.includes(f.id as PostEventFlag))

  // State A: invoice not yet sent — how long since event?
  const daysSinceEvent = e.event_date ? daysBetween(e.event_date) : null
  const eventWaitOverdue = daysSinceEvent !== null && daysSinceEvent > 7

  // State B: invoice sent — how long since invoice?
  const daysSinceInvoice = e.invoice_sent_at ? daysBetween(e.invoice_sent_at) : null
  const invoiceWaitOverdue = daysSinceInvoice !== null && daysSinceInvoice > 30

  // Badge content
  let badgeText: string | null = null
  let badgeRed = false

  if (!allDone) {
    if (!invoiceSent && daysSinceEvent !== null) {
      const firstIncomplete = POST_EVENT_FLAGS.find(f => !e.post_event_flags.includes(f.id as PostEventFlag))
      const label = daysSinceEvent === 0 ? 'Today' : daysSinceEvent === 1 ? '1 day' : `${daysSinceEvent} days`
      badgeText = `Waiting on ${firstIncomplete?.label} · ${label}`
      badgeRed = eventWaitOverdue
    } else if (invoiceSent && daysSinceInvoice !== null) {
      const firstIncomplete = POST_EVENT_FLAGS.find(f => !e.post_event_flags.includes(f.id as PostEventFlag))
      const label = daysSinceInvoice === 0 ? 'Today' : daysSinceInvoice === 1 ? '1 day' : `${daysSinceInvoice} days`
      badgeText = `Waiting on ${firstIncomplete?.label} · ${label}`
      badgeRed = invoiceWaitOverdue
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fade-in">
      <Link href="/post-event" className="flex items-center gap-2 text-sm text-ink-400 hover:text-ink mb-6 transition-all">
        <ArrowLeft size={14} /> Back to Post-Event
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">{e.event_name || e.organization}</h1>
          <p className="text-ink-400 text-sm mt-1">
            {e.organization}
            {e.event_date && ` · ${formatDate(e.event_date)}`}
          </p>
          <div className="accent-line mt-3 w-24" />
        </div>
      </div>

      {/* Post-event checklist */}
      <div className="bg-white border border-ink-100 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium">Post-Event Checklist</p>
          {badgeText && (
            <span className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border ${
              badgeRed
                ? 'text-red-500 bg-red-50 border-red-100'
                : 'text-ink-500 bg-parchment border-ink-100'
            }`}>
              <Clock size={11} />
              {badgeText}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {POST_EVENT_FLAGS.map(flag => {
            const done = e.post_event_flags.includes(flag.id as PostEventFlag)
            const isInvoiceSentFlag = flag.id === 'invoice_sent'
            return (
              <div key={flag.id}>
                <button
                  onClick={() => togglePostEventFlag(e.id, flag.id as PostEventFlag)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium text-left transition-all hover:opacity-80 active:scale-95 ${
                    done ? 'bg-sage/8 border-sage/20 text-sage' : 'bg-parchment border-ink-100 text-ink-400 hover:border-ink-300'
                  }`}
                >
                  {done ? <CheckCircle2 size={14} className="flex-shrink-0" /> : <Circle size={14} className="flex-shrink-0" />}
                  {flag.label}
                </button>
                {/* Invoice sent date + age */}
                {isInvoiceSentFlag && done && e.invoice_sent_at && (
                  <p className={`text-[11px] mt-1 ml-1 ${invoiceWaitOverdue ? 'text-red-400' : 'text-ink-300'}`}>
                    Sent {formatDate(e.invoice_sent_at)} · {daysSinceInvoice === 0 ? 'today' : daysSinceInvoice === 1 ? '1 day ago' : `${daysSinceInvoice} days ago`}
                  </p>
                )}
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