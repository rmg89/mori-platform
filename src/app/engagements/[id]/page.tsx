'use client'
import { useParams } from 'next/navigation'
import { MOCK_ENGAGEMENTS } from '@/lib/mock-data'
import { ENGAGEMENT_FLAGS, EngagementFlag, primaryContact } from '@/types'
import { formatDate, getInitials } from '@/lib/utils'
import { ArrowLeft, Calendar, MapPin, Users, AlertTriangle, CheckCircle2, Circle } from 'lucide-react'
import Link from 'next/link'

export default function EngagementDetailPage() {
  const { id } = useParams()
  const e = MOCK_ENGAGEMENTS.find(e => e.id === id)
  if (!e) return <div className="p-8 text-ink-400">Not found</div>

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fade-in">
      <Link href="/engagements" className="flex items-center gap-2 text-sm text-ink-400 hover:text-ink mb-6 transition-all">
        <ArrowLeft size={14} /> Back to Engagements
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">{e.event_name || e.organization}</h1>
          <p className="text-ink-400 text-sm mt-1">{e.organization} {e.booker_name && `· via ${e.booker_name}`}</p>
          <div className="accent-line mt-3 w-24" />
        </div>
      </div>

      {/* Flags */}
      <div className="bg-white border border-ink-100 rounded-xl p-5 mb-6">
        <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Checklist</p>
        <div className="grid grid-cols-2 gap-3">
          {ENGAGEMENT_FLAGS.map(flag => {
            const done = e.engagement_flags.includes(flag.id as EngagementFlag)
            return (
              <div key={flag.id} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium ${done ? 'bg-sage/8 border-sage/20 text-sage' : 'bg-parchment border-ink-100 text-ink-400'}`}>
                {done ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                {flag.label}
              </div>
            )
          })}
        </div>
      </div>

      {/* Alerts */}
      {e.alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {e.alerts.map((alert, i) => (
            <div key={i} className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium ${alert.severity === 'high' ? 'text-red-500 bg-red-50 border-red-100' : 'text-gold bg-gold/8 border-gold/20'}`}>
              <AlertTriangle size={14} />{alert.label}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-ink-100 rounded-xl p-5">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Event Details</p>
          <div className="space-y-3">
            {e.event_date && <div className="flex items-center gap-2 text-sm"><Calendar size={14} className="text-ink-300" />{formatDate(e.event_date)}</div>}
            {e.event_city && <div className="flex items-center gap-2 text-sm"><MapPin size={14} className="text-ink-300" />{e.event_city}</div>}
            {e.audience_size && <div className="flex items-center gap-2 text-sm"><Users size={14} className="text-ink-300" />{e.audience_size.toLocaleString()} attendees</div>}
            {e.topic && <div className="text-sm text-ink-600 mt-2 pt-2 border-t border-ink-50">{e.topic}</div>}
            {e.fee && <div className="text-sm text-ink-500 mt-2 pt-2 border-t border-ink-50">Fee: <span className="font-medium text-ink">${e.fee.toLocaleString()}</span></div>}
            {e.av_needs && <div className="text-xs text-ink-400 mt-1">AV: {e.av_needs}</div>}
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
                <div>
                  <p className="text-sm font-medium text-ink">{c.first_name} {c.last_name}</p>
                  <p className="text-xs text-ink-400">{c.title}</p>
                  <p className="text-xs text-ink-300">{c.email}</p>
                </div>
                {c.is_current_point_of_contact && <span className="ml-auto text-[10px] text-gold bg-gold/10 px-2 py-0.5 rounded-full border border-gold/20">POC</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white border border-ink-100 rounded-xl p-5">
        <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Timeline</p>
        <div className="space-y-4">
          {e.comms.map(comm => (
            <div key={comm.id} className={`flex gap-3 ${comm.type === 'email_outbound' ? 'flex-row-reverse' : ''}`}>
              <div className={`text-xs px-3 py-2 rounded-xl max-w-lg ${comm.type === 'email_outbound' ? 'bg-ink text-cream ml-auto' : comm.type === 'stage_change' ? 'bg-parchment text-ink-400 italic' : 'bg-parchment text-ink'}`}>
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
