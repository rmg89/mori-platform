'use client'
import { useState } from 'react'
import { MOCK_ENGAGEMENTS, MOCK_COMPANIES } from '@/lib/mock-data'
import { Engagement, PROSPECT_STEPS, primaryContact, getProspectStepLabel } from '@/types'
import { formatDate, getInitials } from '@/lib/utils'
import { Plus, AlertTriangle, Calendar, ArrowRight, Users, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'

const STEP_COLORS: Record<string, string> = {
  inquiry:    '#E05252',
  outreach:   '#E05252',
  in_contact: '#C9A84C',
  discussing: '#7A9E87',
  confirmed:  '#7A9E87',
  declined:   '#9CA3AF',
}

// Mock recently resolved — in real app these would come from DB
// Shows up to 10 items resolved within the past 2 weeks
const ALL_RESOLVED = [
  { id: 're1', organization: 'Goldman Sachs', outcome: 'confirmed' as const, date: '2024-06-11', company_id: 'co8' },
  { id: 're2', organization: 'TechCorp', outcome: 'confirmed' as const, date: '2024-06-08', company_id: 'co7' },
  { id: 're3', organization: 'Blackstone Group', outcome: 'declined' as const, date: '2024-06-05', company_id: 'co8' },
]
const TWO_WEEKS_AGO = new Date('2024-06-12')
TWO_WEEKS_AGO.setDate(TWO_WEEKS_AGO.getDate() - 14)
const RECENTLY_RESOLVED = ALL_RESOLVED
  .filter(r => new Date(r.date) >= TWO_WEEKS_AGO)
  .slice(0, 10)

export default function ProspectsPage() {
  const [resolvedOpen, setResolvedOpen] = useState(false)

  const activeSteps = ['inquiry', 'outreach', 'in_contact', 'discussing']
  const prospects = MOCK_ENGAGEMENTS.filter(e =>
    e.section === 'prospects' && activeSteps.includes(e.prospect_step ?? '')
  )
  const totalAlerts = prospects.reduce((n, e) => n + e.alerts.length, 0)
  const activeProspectSteps = PROSPECT_STEPS.filter(s => !s.terminal)

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Prospects</h1>
          <p className="text-ink-400 text-sm mt-1">
            {prospects.length} active
            {totalAlerts > 0 && (
              <span className="text-red-500 font-medium ml-2">· {totalAlerts} need{totalAlerts === 1 ? 's' : ''} attention</span>
            )}
          </p>
          <div className="accent-line mt-3 w-24" />
        </div>
        <div className="flex items-center gap-2">
          {/* Recently resolved dropdown */}
          <div className="relative">
            <button
              onClick={() => setResolvedOpen(!resolvedOpen)}
              className="flex items-center gap-2 px-3 py-2 bg-parchment border border-ink-100 text-ink-500 text-sm rounded-lg hover:bg-ink-100 transition-all"
            >
              Recently Resolved
              <span className="text-xs bg-ink-200 text-ink-600 rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {RECENTLY_RESOLVED.length}
              </span>
              {resolvedOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {resolvedOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-72 bg-white border border-ink-100 rounded-xl shadow-lg z-10 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-ink-50 flex items-center justify-between">
                  <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Recently Resolved</p>
                  <Link href="/companies" className="text-xs text-gold hover:text-gold-dark">View all →</Link>
                </div>
                {RECENTLY_RESOLVED.map(item => (
                  <Link
                    key={item.id}
                    href={`/companies/${item.company_id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-parchment transition-all"
                    onClick={() => setResolvedOpen(false)}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      item.outcome === 'confirmed' ? 'bg-sage/10' : 'bg-parchment'
                    }`}>
                      {item.outcome === 'confirmed'
                        ? <CheckCircle2 size={13} className="text-sage" />
                        : <XCircle size={13} className="text-ink-300" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{item.organization}</p>
                      <p className="text-xs text-ink-400">{item.outcome === 'confirmed' ? 'Confirmed' : 'Declined'} · {formatDate(item.date, 'MMM d, yyyy')}</p>
                    </div>
                    <ArrowRight size={12} className="text-ink-200 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          <button className="flex items-center gap-2 px-4 py-2 bg-ink text-cream text-sm rounded-lg hover:bg-ink-700 transition-all">
            <Plus size={16} />
            New Inquiry
          </button>
        </div>
      </div>

      {/* Step summary — active steps only */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {activeProspectSteps.map(step => {
          const count = prospects.filter(e => e.prospect_step === step.id).length
          const color = STEP_COLORS[step.id]
          return (
            <div key={step.id} className="bg-white border border-ink-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">{step.label}</span>
              </div>
              <p className="text-2xl font-semibold text-ink">{count}</p>
            </div>
          )
        })}
      </div>

      {/* Entry points: Inquiry + Outreach side by side */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {(['inquiry', 'outreach'] as const).map(stepId => {
          const step = PROSPECT_STEPS.find(s => s.id === stepId)!
          const items = prospects.filter(e => e.prospect_step === stepId)
          const color = STEP_COLORS[stepId]
          return (
            <div key={stepId}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                <h2 className="font-display text-lg font-semibold text-ink">{step.label}</h2>
                <span className="text-sm text-ink-400">{items.length}</span>
              </div>
              {items.length === 0 ? (
                <div className="bg-white border border-dashed border-ink-100 rounded-xl px-5 py-6 text-center text-xs text-ink-300">
                  None active
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map(e => <ProspectCard key={e.id} engagement={e} color={color} />)}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Middle + terminal steps stacked */}
      <div className="space-y-8">
        {(['in_contact', 'discussing'] as const).map(stepId => {
          const step = PROSPECT_STEPS.find(s => s.id === stepId)!
          const items = prospects.filter(e => e.prospect_step === stepId)
          if (items.length === 0) return null
          const color = STEP_COLORS[stepId]
          return (
            <div key={stepId}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                <h2 className="font-display text-lg font-semibold text-ink">{step.label}</h2>
                <span className="text-sm text-ink-400">{items.length}</span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {items.map(e => <ProspectCard key={e.id} engagement={e} color={color} />)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ProspectCard({ engagement: e, color }: { engagement: Engagement, color: string }) {
  const pc = primaryContact(e)
  const stepLabel = getProspectStepLabel(e.prospect_step!)

  return (
    <Link
      href={`/prospects/${e.id}`}
      className="flex items-start gap-4 bg-white border border-ink-100 rounded-xl px-5 py-4 hover:border-gold/30 hover:shadow-sm transition-all group"
    >
      {pc && (
        <div className="w-9 h-9 rounded-full bg-ink-800 flex items-center justify-center text-xs font-bold text-gold flex-shrink-0 mt-0.5">
          {getInitials(pc.first_name, pc.last_name)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink">{e.event_name || e.topic || e.organization}</p>
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
          <span className="flex-shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide"
            style={{ backgroundColor: color + '18', color }}>
            {stepLabel}
          </span>
        </div>
        {e.alerts.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2.5">
            {e.alerts.map((alert, i) => (
              <span key={i} className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md border ${alert.severity === 'high' ? 'text-red-500 bg-red-50 border-red-100' : 'text-gold bg-gold/8 border-gold/20'}`}>
                <AlertTriangle size={9} />{alert.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex-shrink-0 text-right space-y-1">
        {e.event_date && (
          <p className="text-xs text-ink-400 flex items-center gap-1 justify-end">
            <Calendar size={10} />{formatDate(e.event_date, 'MMM d')}
          </p>
        )}
        {e.event_city && <p className="text-xs text-ink-300">{e.event_city}</p>}
      </div>
      <ArrowRight size={14} className="text-ink-200 group-hover:text-gold transition-all flex-shrink-0 mt-1" />
    </Link>
  )
}