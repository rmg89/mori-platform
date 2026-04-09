'use client'
import { useStore } from '@/lib/store'
import { Engagement, primaryContact } from '@/types'
import { formatDate, getInitials } from '@/lib/utils'
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, MapPin, Users } from 'lucide-react'
import Link from 'next/link'

// ─── Proximity helpers ────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0,0,0,0)
  const [y, m, d] = dateStr.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function proximityLabel(days: number): string {
  if (days < 0)   return 'Past'
  if (days === 0)  return 'Today'
  if (days === 1)  return 'Tomorrow'
  if (days <= 10)  return `${days} days`
  if (days <= 17)  return '2 weeks'
  if (days <= 24)  return '3 weeks'
  if (days <= 45)  return '1 month'
  if (days <= 75)  return '2 months'
  if (days <= 105) return '3 months'
  return `${Math.round(days / 30)} months`
}

function cardBorderStyle(days: number): string {
  if (days <= 1)  return 'border-l-red-300'
  if (days <= 7)  return 'border-l-amber-300'
  return 'border-ink-100'
}

function CalendarTile({ dateStr }: { dateStr: string }) {
  const days = daysUntil(dateStr)
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const monthLabel = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  const label = proximityLabel(days)

  const colors = days <= 1
    ? { top: 'bg-red-500 text-white', num: 'text-red-800', lbl: 'text-red-500', border: 'border-red-200' }
    : days <= 7
    ? { top: 'bg-amber-600 text-white', num: 'text-amber-900', lbl: 'text-amber-700', border: 'border-amber-200' }
    : days <= 30
    ? { top: 'bg-ink-600 text-white', num: 'text-ink', lbl: 'text-ink-500', border: 'border-ink-200' }
    : { top: 'bg-ink-200 text-ink-500', num: 'text-ink-400', lbl: 'text-ink-300', border: 'border-ink-100' }

  return (
    <div className={`flex-shrink-0 w-12 rounded-lg border overflow-hidden text-center ${colors.border}`}>
      <div className={`py-0.5 text-[9px] font-bold tracking-widest ${colors.top}`}>{monthLabel}</div>
      <div className={`bg-white py-0.5 text-xl font-bold leading-tight ${colors.num}`}>{day}</div>
      <div className={`bg-white pb-1 text-[9px] font-semibold ${colors.lbl}`}>{label}</div>
    </div>
  )
}

// ─── Progress helpers ─────────────────────────────────────────────────────────

function getProgressSteps(e: Engagement) {
  const outgoing = e.outgoing_materials ?? []
  const incoming = e.incoming_materials ?? []
  const contractRequired = e.contract_required
  const contractSent = e.engagement_flags?.includes('contract_sent') ?? false
  const contractSigned = e.engagement_flags?.includes('contract_signed') ?? false
  const outgoingDone = outgoing.filter(m => m.done).length
  const incomingDone = incoming.filter(m => m.received).length

  const contractComplete = contractRequired === false || (contractRequired === true && contractSent && contractSigned)
  const contractSub = contractRequired === undefined ? 'Not set'
    : contractRequired === false ? 'Not required'
    : contractSigned ? 'Signed'
    : contractSent ? 'Sent to client — signature pending'
    : 'Pending'

  const outgoingComplete = !!e.outgoing_not_needed || (outgoing.length > 0 && outgoingDone === outgoing.length)
  const outgoingSub = e.outgoing_not_needed ? 'Not needed'
    : outgoingComplete ? 'All sent'
    : outgoing.length === 0 ? '0 of 0'
    : `${outgoingDone}/${outgoing.length}`

  const incomingComplete = !!e.incoming_not_needed || (incoming.length > 0 && incomingDone === incoming.length)
  const incomingSub = e.incoming_not_needed ? 'Not needed'
    : incomingComplete ? 'All received'
    : `${incomingDone}/${incoming.length}`

  const briefingComplete = !!e.briefing_complete

  return [
    { label: 'Contract',           complete: contractComplete, sub: contractSub },
    { label: 'Materials Sent',     complete: outgoingComplete, sub: outgoingSub },
    { label: 'Materials Received', complete: incomingComplete, sub: incomingSub },
    { label: 'Briefing Doc',       complete: briefingComplete, sub: briefingComplete ? 'Ready' : 'Incomplete' },
  ]
}

function EngagementCard({ engagement: e }: { engagement: Engagement; key?: string }) {
  const pc = primaryContact(e)
  const hasAlerts = e.alerts.length > 0
  const days = e.event_date ? daysUntil(e.event_date) : null
  const steps = getProgressSteps(e)
  const allDone = steps.every(s => s.complete)
  const borderClass = days !== null && days <= 7 ? cardBorderStyle(days) : 'border-ink-100'

  return (
    <Link href={`/engagements/${e.id}`}
      className={`bg-white border border-l-4 ${borderClass} rounded-2xl p-5 hover:shadow-md transition-all group block`}>
      <div className="flex items-start gap-4">

        {/* Calendar tile */}
        {e.event_date && <CalendarTile dateStr={e.event_date} />}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="flex items-center gap-2.5 min-w-0">
              {pc && (
                <div className="w-7 h-7 rounded-full bg-ink-800 flex items-center justify-center text-xs font-bold text-gold flex-shrink-0">
                  {getInitials(pc.first_name, pc.last_name)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-base font-semibold text-ink truncate">{e.organization}</p>
                <p className="text-sm text-ink-400 truncate">{e.event_name || e.topic}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {hasAlerts && <AlertTriangle size={13} className="text-amber-500" />}
              {allDone && <CheckCircle2 size={13} className="text-sage" />}
              <ArrowRight size={13} className="text-ink-200 group-hover:text-gold transition-all" />
            </div>
          </div>

          <div className="flex items-center gap-3 mb-4 text-xs text-ink-400 mt-2">
            {e.event_date && <span className="font-semibold text-ink-600">{formatDate(e.event_date)}</span>}
            {e.event_city && <span className="flex items-center gap-1"><MapPin size={11} />{e.event_city}</span>}
            {e.audience_size && <span className="flex items-center gap-1"><Users size={11} />{e.audience_size.toLocaleString()}</span>}
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {steps.map(step => (
              <div key={step.label}
                className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                  step.complete
                    ? 'bg-sage/8 border-sage/20 text-sage-dark'
                    : 'bg-parchment border-ink-100 text-ink-300'
                }`}>
                {step.complete
                  ? <CheckCircle2 size={10} className="flex-shrink-0" />
                  : <Circle size={10} className="flex-shrink-0" />
                }
                <span>{step.label}</span>
                {!step.complete && step.sub && !['Incomplete', 'Pending', 'Not set'].includes(step.sub) && (
                  <span className="text-ink-200 font-normal ml-0.5">{step.sub}</span>
                )}
              </div>
            ))}
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

export default function EngagementsPage() {
  const { engagements: allEngagements } = useStore()
  const engagements = allEngagements.filter(e => e.section === 'engagements')
  const totalAlerts = engagements.reduce((n, e) => n + e.alerts.length, 0)

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-ink">Engagements</h1>
        <p className="text-ink-400 text-sm mt-1">
          {engagements.length} active
          {totalAlerts > 0 && (
            <span className="text-red-500 font-medium ml-2">· {totalAlerts} need{totalAlerts === 1 ? 's' : ''} attention</span>
          )}
        </p>
        <div className="accent-line mt-3 w-24" />
      </div>

      {engagements.length === 0 ? (
        <p className="text-sm text-ink-400">No active engagements.</p>
      ) : (
        <div className="space-y-3">
          {engagements
            .sort((a, b) => (a.event_date ?? '') < (b.event_date ?? '') ? -1 : 1)
            .map(e => <EngagementCard key={e.id} engagement={e} />)
          }
        </div>
      )}
    </div>
  )
}