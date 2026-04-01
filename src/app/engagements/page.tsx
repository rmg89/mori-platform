'use client'
import { MOCK_ENGAGEMENTS } from '@/lib/mock-data'
import { ENGAGEMENT_FLAGS, MEDIA_FLAGS, EngagementFlag, MediaFlag, Engagement, primaryContact } from '@/types'
import { formatDate, getInitials } from '@/lib/utils'
import { AlertTriangle, ArrowRight, Calendar, CheckCircle2, Circle, MapPin, Users } from 'lucide-react'
import Link from 'next/link'

const MEDIA_TYPES = ['podcast', 'interview', 'panel', 'livestream']

function EngagementCard({ engagement: e }: { engagement: Engagement }) {
  const pc = primaryContact(e)
  const isMedia = MEDIA_TYPES.includes(e.event_type ?? '')
  const flags = isMedia ? MEDIA_FLAGS : ENGAGEMENT_FLAGS
  const doneIds = isMedia ? (e.media_flags ?? []) : e.engagement_flags
  const doneCount = flags.filter(f => doneIds.includes(f.id as EngagementFlag & MediaFlag)).length
  const allDone = doneCount === flags.length
  const hasAlerts = e.alerts.length > 0

  return (
    <Link href={`/engagements/${e.id}`}
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
            {e.audience_size && <span className="flex items-center gap-1"><Users size={11} />{e.audience_size.toLocaleString()}</span>}
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {flags.map(flag => {
              const done = doneIds.includes(flag.id as EngagementFlag & MediaFlag)
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

export default function EngagementsPage() {
  const engagements = MOCK_ENGAGEMENTS.filter(e => e.section === 'engagements')
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