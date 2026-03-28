'use client'
import { useState } from 'react'
import { MOCK_ENGAGEMENTS } from '@/lib/mock-data'
import { BUCKETS, Engagement, PipelineBucket, primaryContact } from '@/types'
import { formatCurrency, formatDate, getInitials } from '@/lib/utils'
import { Plus, AlertTriangle, Clock, Calendar, ArrowRight, Mail, Users } from 'lucide-react'
import Link from 'next/link'

const ALERT_COLORS: Record<string, string> = {
  high: 'text-red-500 bg-red-50 border-red-100',
  medium: 'text-gold bg-gold/8 border-gold/20',
  low: 'text-ink-400 bg-parchment border-ink-100',
}

export default function PipelinePage() {
  const engagements = MOCK_ENGAGEMENTS

  const totalAlerts = engagements.reduce((n, e) => n + e.alerts.length, 0)

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Pipeline</h1>
          <p className="text-ink-400 text-sm mt-1">
            {engagements.filter(e => e.bucket !== 'complete').length} active ·{' '}
            {totalAlerts > 0 && (
              <span className="text-red-500 font-medium">{totalAlerts} need{totalAlerts === 1 ? 's' : ''} attention</span>
            )}
          </p>
          <div className="accent-line mt-3 w-24" />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-ink text-cream text-sm rounded-lg hover:bg-ink-700 transition-all">
          <Plus size={16} />
          New Inquiry
        </button>
      </div>

      {/* Three bucket sections */}
      <div className="space-y-8">
        {BUCKETS.map(bucket => {
          const items = engagements.filter(e => e.bucket === bucket.id)
          return (
            <BucketSection key={bucket.id} bucket={bucket} engagements={items} />
          )
        })}
      </div>
    </div>
  )
}

function BucketSection({ bucket, engagements }: { bucket: typeof BUCKETS[0], engagements: Engagement[] }) {
  const alertCount = engagements.reduce((n, e) => n + e.alerts.length, 0)

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: bucket.color }} />
        <h2 className="font-display text-xl font-semibold text-ink">{bucket.label}</h2>
        <span className="text-sm text-ink-400">{engagements.length}</span>
        {alertCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-red-500 font-medium ml-1">
            <AlertTriangle size={12} />
            {alertCount} alert{alertCount > 1 ? 's' : ''}
          </span>
        )}
        {/* Step legend */}
        <div className="ml-auto flex items-center gap-1">
          {bucket.steps.map((s, i) => (
            <span key={s.id} className="flex items-center gap-1 text-[10px] text-ink-300">
              {i > 0 && <span>·</span>}
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {engagements.length === 0 ? (
        <div className="bg-white border border-dashed border-ink-200 rounded-xl px-6 py-8 text-center text-ink-300 text-sm">
          No {bucket.label.toLowerCase()} yet
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {engagements.map(e => (
            <EngagementCard key={e.id} engagement={e} bucketColor={bucket.color} />
          ))}
        </div>
      )}
    </div>
  )
}

function EngagementCard({ engagement: e, bucketColor }: { engagement: Engagement, bucketColor: string }) {
  const pc = primaryContact(e)
  const stepLabel = BUCKETS.flatMap(b => b.steps).find(s => s.id === e.step)?.label ?? e.step
  const highAlerts = e.alerts.filter(a => a.severity === 'high')
  const otherAlerts = e.alerts.filter(a => a.severity !== 'high')

  return (
    <Link
      href={`/pipeline/${e.id}`}
      className="flex items-start gap-4 bg-white border border-ink-100 rounded-xl px-5 py-4 hover:border-gold/30 hover:shadow-sm transition-all group"
    >
      {/* Avatar */}
      {pc && (
        <div className="w-9 h-9 rounded-full bg-ink-800 flex items-center justify-center text-xs font-bold text-gold flex-shrink-0 mt-0.5">
          {getInitials(pc.first_name, pc.last_name)}
        </div>
      )}

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink">
              {e.event_name || e.topic || e.organization}
            </p>
            <p className="text-xs text-ink-400 mt-0.5">
              {e.organization}
              {pc && ` · ${pc.first_name} ${pc.last_name}`}
              {e.contacts.length > 1 && (
                <span className="ml-1.5 inline-flex items-center gap-0.5 text-ink-300">
                  <Users size={10} />+{e.contacts.length - 1}
                </span>
              )}
            </p>
          </div>

          {/* Step badge */}
          <span
            className="flex-shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide"
            style={{ backgroundColor: bucketColor + '18', color: bucketColor }}
          >
            {stepLabel}
          </span>
        </div>

        {/* Alerts */}
        {e.alerts.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2.5">
            {e.alerts.map((alert, i) => (
              <span
                key={i}
                className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md border ${ALERT_COLORS[alert.severity]}`}
              >
                <AlertTriangle size={9} />
                {alert.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Right meta */}
      <div className="flex-shrink-0 text-right space-y-1">
        {e.fee && <p className="text-sm font-semibold text-gold">{formatCurrency(e.fee)}</p>}
        {e.event_date && (
          <p className="text-xs text-ink-400 flex items-center gap-1 justify-end">
            <Calendar size={10} />
            {formatDate(e.event_date, 'MMM d')}
          </p>
        )}
        {e.event_city && <p className="text-xs text-ink-300">{e.event_city}</p>}
      </div>

      <ArrowRight size={14} className="text-ink-200 group-hover:text-gold transition-all flex-shrink-0 mt-1" />
    </Link>
  )
}
