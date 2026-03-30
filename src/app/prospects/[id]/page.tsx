'use client'
import { useParams } from 'next/navigation'
import { MOCK_ENGAGEMENTS } from '@/lib/mock-data'
import { PROSPECT_STEPS, primaryContact } from '@/types'
import { formatDate, getInitials } from '@/lib/utils'
import { ArrowLeft, Calendar, MapPin, Users, AlertTriangle, CheckCircle2, Circle } from 'lucide-react'
import Link from 'next/link'

const STEP_COLORS: Record<string, string> = {
  inquiry:    'bg-red-50 text-red-500 border-red-100',
  outreach:   'bg-red-50 text-red-500 border-red-100',
  in_contact: 'bg-gold/10 text-gold border-gold/20',
  discussing: 'bg-gold/10 text-gold border-gold/20',
  confirmed:  'bg-sage/10 text-sage border-sage/20',
  declined:   'bg-parchment text-ink-400 border-ink-200',
}

const STEP_INACTIVE = 'bg-parchment text-ink-300 border-ink-100'

export default function ProspectDetailPage() {
  const { id } = useParams()
  const e = MOCK_ENGAGEMENTS.find(e => e.id === id)
  if (!e) return <div className="p-8 text-ink-400">Not found</div>
  const pc = primaryContact(e)
  const currentStep = e.prospect_step ?? 'inquiry'

  // Define the flow
  const entrySteps = ['inquiry', 'outreach']
  const middleSteps = ['in_contact', 'discussing']
  const terminalSteps = ['confirmed', 'declined']

  const isActive = (stepId: string) => stepId === currentStep
  const isPast = (stepId: string) => {
    const order = ['inquiry', 'outreach', 'in_contact', 'discussing', 'confirmed', 'declined']
    const currentIdx = order.indexOf(currentStep)
    const stepIdx = order.indexOf(stepId)
    // entry steps are both "past" once we're in middle
    if (entrySteps.includes(stepId) && middleSteps.concat(terminalSteps).includes(currentStep)) return true
    return stepIdx < currentIdx && !entrySteps.includes(stepId)
  }

  function stepClass(stepId: string) {
    if (isActive(stepId)) return STEP_COLORS[stepId] ?? STEP_INACTIVE
    if (isPast(stepId)) return 'bg-sage/8 text-sage border-sage/20 opacity-60'
    return STEP_INACTIVE
  }

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fade-in">
      <Link href="/prospects" className="flex items-center gap-2 text-sm text-ink-400 hover:text-ink mb-6 transition-all">
        <ArrowLeft size={14} /> Back to Prospects
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">{e.event_name || e.organization}</h1>
          <p className="text-ink-400 text-sm mt-1">{e.organization}{e.booker_name && ` · via ${e.booker_name}`}</p>
          <div className="accent-line mt-3 w-24" />
        </div>
      </div>

      {/* Prospect flow diagram */}
      <div className="bg-white border border-ink-100 rounded-xl p-5 mb-6">
        <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Prospect Stage</p>
        <div className="flex items-center gap-2">
          {/* Entry points */}
          <div className="flex flex-col gap-2">
            {entrySteps.map(stepId => {
              const step = PROSPECT_STEPS.find(s => s.id === stepId)!
              return (
                <div key={stepId} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${stepClass(stepId)}`}>
                  {isActive(stepId) ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                  {step.label}
                </div>
              )
            })}
          </div>

          {/* Arrow */}
          <div className="flex flex-col items-center gap-1 text-ink-200">
            <span className="text-base leading-none">↘</span>
            <span className="text-base leading-none">↗</span>
          </div>

          {/* Middle steps */}
          <div className="flex items-center gap-2 flex-1">
            {middleSteps.map((stepId, i) => {
              const step = PROSPECT_STEPS.find(s => s.id === stepId)!
              return (
                <div key={stepId} className="flex items-center gap-2 flex-1">
                  <div className={`flex-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${stepClass(stepId)}`}>
                    {isActive(stepId) || isPast(stepId) ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                    {step.label}
                  </div>
                  {i < middleSteps.length - 1 && (
                    <div className="w-4 h-px bg-ink-100 flex-shrink-0" />
                  )}
                </div>
              )
            })}
          </div>

          {/* Arrow */}
          <div className="flex flex-col items-center gap-1 text-ink-200">
            <span className="text-base leading-none">↗</span>
            <span className="text-base leading-none">↘</span>
          </div>

          {/* Terminal steps */}
          <div className="flex flex-col gap-2">
            {terminalSteps.map(stepId => {
              const step = PROSPECT_STEPS.find(s => s.id === stepId)!
              return (
                <div key={stepId} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${stepClass(stepId)}`}>
                  {isActive(stepId) ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                  {step.label}
                </div>
              )
            })}
          </div>
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
        {/* Event details */}
        <div className="bg-white border border-ink-100 rounded-xl p-5">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Event Details</p>
          <div className="space-y-3">
            {e.event_date && <div className="flex items-center gap-2 text-sm"><Calendar size={14} className="text-ink-300" />{formatDate(e.event_date)}</div>}
            {e.event_city && <div className="flex items-center gap-2 text-sm"><MapPin size={14} className="text-ink-300" />{e.event_city}</div>}
            {e.audience_size && <div className="flex items-center gap-2 text-sm"><Users size={14} className="text-ink-300" />{e.audience_size.toLocaleString()} attendees</div>}
            {e.topic && <div className="text-sm text-ink-600 mt-2 pt-2 border-t border-ink-50">{e.topic}</div>}
            {e.fee && <div className="text-sm text-ink-500 mt-2 pt-2 border-t border-ink-50">Fee: <span className="font-medium text-ink">${e.fee.toLocaleString()}</span></div>}
          </div>
        </div>

        {/* Contacts */}
        <div className="bg-white border border-ink-100 rounded-xl p-5">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Contacts</p>
          <div className="space-y-3">
            {e.contacts.map(c => (
              <Link key={c.id} href={`/contacts/${c.id}`} className="flex items-center gap-3 hover:opacity-80 transition-all">
                <div className="w-8 h-8 rounded-full bg-ink-800 flex items-center justify-center text-xs font-bold text-gold flex-shrink-0">
                  {getInitials(c.first_name, c.last_name)}
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">{c.first_name} {c.last_name}</p>
                  <p className="text-xs text-ink-400">{c.title} · {c.role}</p>
                  <p className="text-xs text-ink-300">{c.email}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline */}
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