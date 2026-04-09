'use client'
import { useParams } from 'next/navigation'
import { useStore } from '@/lib/store'
import { PostEventFlag, primaryContact } from '@/types'
import { formatDate, getInitials } from '@/lib/utils'
import { ArrowLeft, AlertTriangle, CheckCircle2, Circle, Clock, Calendar, MapPin, Users, DollarSign, FileText } from 'lucide-react'
import Link from 'next/link'

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

const STEPS: { id: PostEventFlag; label: string; sub: (e: any) => string }[] = [
  {
    id: 'invoice_sent',
    label: 'Invoice Sent',
    sub: (e) => e.invoice_sent_at ? `Sent ${elapsed(e.invoice_sent_at)}` : 'Not yet sent',
  },
  {
    id: 'invoice_paid',
    label: 'Invoice Paid',
    sub: (e) => e.post_event_flags.includes('invoice_paid') ? 'Received' : 'Awaiting payment',
  },
  {
    id: 'media_uploaded',
    label: 'Media Uploaded',
    sub: (e) => e.post_event_flags.includes('media_uploaded') ? 'Uploaded' : 'Pending',
  },
  {
    id: 'marked_complete',
    label: 'Marked Complete',
    sub: (e) => e.post_event_flags.includes('marked_complete') ? 'Done' : 'Incomplete',
  },
]

export default function PostEventDetailPage() {
  const { id } = useParams()
  const { engagements: allEngagements, togglePostEventFlag } = useStore()
  const e = allEngagements.find(eng => eng.id === id)
  if (!e) return <div className="p-8 text-ink-400">Not found</div>

  const pc = primaryContact(e)
  const invoiceSent = e.post_event_flags.includes('invoice_sent')
  const invoicePaid = e.post_event_flags.includes('invoice_paid')
  const allDone = STEPS.every(s => e.post_event_flags.includes(s.id))

  const sinceEvent = e.event_date ? daysSince(e.event_date) : null
  const sinceInvoice = e.invoice_sent_at ? daysSince(e.invoice_sent_at) : null
  const invoiceOverdue = sinceInvoice !== null && !invoicePaid && sinceInvoice > 30
  const invoiceUrgent = sinceInvoice !== null && !invoicePaid && sinceInvoice > 14

  // Status badge
  let statusText = ''
  let statusRed = false
  if (allDone) {
    statusText = 'Complete'
  } else if (!invoiceSent) {
    statusText = sinceEvent !== null ? `Invoice not sent · ${sinceEvent === 0 ? 'today' : `${sinceEvent}d since event`}` : 'Invoice not sent'
    statusRed = sinceEvent !== null && sinceEvent > 3
  } else if (!invoicePaid) {
    statusText = sinceInvoice !== null ? `Payment pending · ${sinceInvoice}d since invoice` : 'Payment pending'
    statusRed = invoiceOverdue
  } else {
    statusText = 'Invoice paid — wrapping up'
  }

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fade-in">
      <Link href="/post-event" className="flex items-center gap-2 text-sm text-ink-400 hover:text-ink mb-6 transition-all">
        <ArrowLeft size={14} /> Back to Post-Event
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText size={13} className="text-ink-400" />
            <span className="text-xs text-ink-400 uppercase tracking-widest font-medium">Post-Event</span>
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

      {/* Progress track */}
      <div className="bg-white border border-ink-100 rounded-xl mb-6 overflow-hidden">

        {/* Status header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-ink-100">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">Post-Event Progress</p>
          <span className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border ${
            allDone ? 'bg-sage/8 border-sage/20 text-sage'
            : statusRed ? 'bg-red-50 border-red-100 text-red-500'
            : 'bg-parchment border-ink-100 text-ink-500'
          }`}>
            {allDone ? <CheckCircle2 size={11} /> : <Clock size={11} />}
            {statusText}
          </span>
        </div>

        {/* Step columns */}
        <div className="grid grid-cols-4 divide-x divide-ink-100">
          {STEPS.map((step) => {
            const done = e.post_event_flags.includes(step.id)
            const isInvoice = step.id === 'invoice_sent'
            const overdue = isInvoice && invoiceOverdue
            return (
              <button key={step.id}
                onClick={() => togglePostEventFlag(e.id, step.id)}
                className={`flex flex-col gap-1.5 px-4 py-3.5 text-left transition-colors hover:bg-parchment/60 active:scale-[0.98] ${done ? '' : 'hover:bg-parchment/60'}`}>
                <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${done ? 'text-ink-200' : 'text-ink-400'}`}>
                  {step.label}
                </span>
                <div className="flex items-center gap-1.5">
                  {done
                    ? <CheckCircle2 size={12} className="text-sage/70 flex-shrink-0" />
                    : <Circle size={12} className={`flex-shrink-0 ${overdue ? 'text-red-300' : 'text-ink-200'}`} />
                  }
                  <span className={`text-sm font-medium ${
                    done ? 'text-ink-300'
                    : overdue ? 'text-red-500'
                    : 'text-ink'
                  }`}>
                    {step.sub(e)}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Invoice overdue warning */}
        {invoiceUrgent && !invoicePaid && (
          <div className={`border-t px-5 py-3 flex items-center gap-2 text-xs font-medium ${
            invoiceOverdue ? 'border-red-100 bg-red-50 text-red-500' : 'border-amber-100 bg-amber-50 text-amber-600'
          }`}>
            <Clock size={11} />
            Invoice sent {sinceInvoice} days ago — {invoiceOverdue ? 'overdue' : 'follow up recommended'}
          </div>
        )}
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
                <span className={invoicePaid ? 'text-sage font-medium' : ''}>${e.fee.toLocaleString()}</span>
                <span className={`text-xs ${invoicePaid ? 'text-sage' : 'text-ink-300'}`}>
                  {invoicePaid ? '· Paid' : invoiceSent ? '· Invoice sent' : '· Invoice pending'}
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