'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { MOCK_COMPANIES, MOCK_ENGAGEMENTS } from '@/lib/mock-data'
import { PROSPECT_STEPS, ENGAGEMENT_FLAGS, primaryContact } from '@/types'
import { formatDate, getInitials } from '@/lib/utils'
import { ArrowLeft, Eye, EyeOff, Building2, Mail, Calendar, CheckCircle2, Circle, ArrowRight, AlertTriangle, Users, Plus } from 'lucide-react'
import Link from 'next/link'

type Tab = 'engagements' | 'contacts' | 'teams'

export default function CompanyProfilePage() {
  const { id } = useParams()
  const company = MOCK_COMPANIES.find(c => c.id === id)
  const [tab, setTab] = useState<Tab>('engagements')
  const [watching, setWatching] = useState(company?.watching ?? false)

  if (!company) return <div className="p-8 text-ink-400">Company not found.</div>

  const engagements = MOCK_ENGAGEMENTS.filter(e => company.engagement_ids.includes(e.id))
  const allContacts = MOCK_ENGAGEMENTS
    .filter(e => company.engagement_ids.includes(e.id))
    .flatMap(e => e.contacts)
    .filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i) // dedupe

  const hasHistory = engagements.some(e => e.section === 'post-event')
  const isActive = engagements.some(e => e.section === 'engagements')
  const isProspect = engagements.some(e => e.section === 'prospects')
  const statusLabel = hasHistory || isActive ? 'Client' : isProspect ? 'Prospect' : '—'
  const statusColor = hasHistory || isActive ? 'text-gold bg-gold/10 border-gold/20' : 'text-sage bg-sage/10 border-sage/20'

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'engagements', label: 'Engagements', count: engagements.length },
    { id: 'contacts', label: 'Contacts', count: allContacts.length },
    { id: 'teams', label: 'Teams', count: company.teams.length },
  ]

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fade-in">
      <Link href="/companies" className="flex items-center gap-2 text-sm text-ink-400 hover:text-ink mb-6 transition-all">
        <ArrowLeft size={14} /> Back to Companies
      </Link>

      {/* Header */}
      <div className="bg-white border border-ink-100 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-ink-100 flex items-center justify-center flex-shrink-0">
              <Building2 size={20} className="text-ink-400" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-display text-2xl font-semibold text-ink">{company.name}</h1>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusColor}`}>
                  {statusLabel}
                </span>
                {watching && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] text-blue-500 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide">
                    <Eye size={8} />Watching
                  </span>
                )}
              </div>
              <p className="text-sm text-ink-400 mt-0.5">{company.industry}{company.website && ` · ${company.website}`}</p>
            </div>
          </div>
          <button
            onClick={() => setWatching(!watching)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              watching
                ? 'bg-blue-50 text-blue-500 border-blue-100 hover:bg-blue-100'
                : 'bg-parchment text-ink-400 border-ink-100 hover:border-ink-300 hover:text-ink'
            }`}
          >
            {watching ? <Eye size={12} /> : <EyeOff size={12} />}
            {watching ? 'Watching' : 'Watch'}
          </button>
        </div>
        {company.notes && (
          <p className="text-sm text-ink-500 mt-4 pt-4 border-t border-ink-50">{company.notes}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-ink-100">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px flex items-center gap-2 ${
              tab === t.id
                ? 'border-gold text-ink'
                : 'border-transparent text-ink-400 hover:text-ink'
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="text-xs text-ink-300">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Engagements tab */}
      {tab === 'engagements' && (
        <div className="space-y-6">
          {engagements.length === 0 ? (
            <p className="text-sm text-ink-400">No engagements yet.</p>
          ) : (
            <>
              {(['prospects', 'engagements', 'post-event'] as const).map(section => {
                const sectionEngagements = engagements.filter(e => e.section === section)
                if (sectionEngagements.length === 0) return null
                const sectionLabel = section === 'prospects' ? 'Prospects' : section === 'engagements' ? 'Engagements' : 'Completed'
                const sectionColor = section === 'prospects' ? '#7A9E87' : section === 'engagements' ? '#C9A84C' : '#4A4740'
                return (
                  <div key={section}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sectionColor }} />
                      <h3 className="text-sm font-semibold text-ink">{sectionLabel}</h3>
                      <span className="text-xs text-ink-400">{sectionEngagements.length}</span>
                    </div>
                    <div className="space-y-2">
                      {sectionEngagements.map(e => {
                        const pc = primaryContact(e)
                        const href = `/${e.section}/${e.id}`
                        return (
                          <Link key={e.id} href={href}
                            className="flex items-center gap-4 bg-white border border-ink-100 rounded-xl px-5 py-4 hover:border-gold/30 hover:shadow-sm transition-all group">
                            {pc && (
                              <div className="w-8 h-8 rounded-full bg-ink-800 flex items-center justify-center text-xs font-bold text-gold flex-shrink-0">
                                {getInitials(pc.first_name, pc.last_name)}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-ink">{e.event_name || e.topic || e.organization}</p>
                              <p className="text-xs text-ink-400">{pc?.first_name} {pc?.last_name}{e.event_date && ` · ${formatDate(e.event_date, 'MMM d, yyyy')}`}</p>
                              {e.alerts.length > 0 && (
                                <span className="text-[10px] text-red-500 flex items-center gap-1 mt-1">
                                  <AlertTriangle size={9} />{e.alerts[0].label}
                                </span>
                              )}
                            </div>
                            <ArrowRight size={14} className="text-ink-200 group-hover:text-gold transition-all" />
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}

      {/* Contacts tab */}
      {tab === 'contacts' && (
        <div className="bg-white border border-ink-100 rounded-xl overflow-hidden">
          {allContacts.length === 0 ? (
            <p className="p-5 text-sm text-ink-400">No contacts yet.</p>
          ) : (
            <div className="divide-y divide-ink-50">
              {allContacts.map(c => {
                return (
                <Link key={c.id} href={`/contacts/${c.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-parchment transition-all group">
                  <div className="w-8 h-8 rounded-full bg-ink-800 flex items-center justify-center text-xs font-bold text-gold flex-shrink-0">
                    {getInitials(c.first_name, c.last_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink flex items-center gap-2">
                      {c.first_name} {c.last_name}
                      {c.watching && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] text-blue-500 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-full font-semibold uppercase">
                          <Eye size={8} />Watching
                        </span>
                      )}
                      {c.is_current_point_of_contact && (
                        <span className="text-[9px] text-gold bg-gold/10 border border-gold/20 px-1.5 py-0.5 rounded-full font-semibold uppercase">POC</span>
                      )}
                    </p>
                    <p className="text-xs text-ink-400">{c.title}</p>
                  </div>
                  {c.email && (
                    <div className="flex items-center gap-3">
                    {c.email && (
                      <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()} className="flex items-center gap-1 text-xs text-ink-400 hover:text-ink transition-all">
                        <Mail size={12} />{c.email}
                      </a>
                    )}
                    <ArrowRight size={13} className="text-ink-200 group-hover:text-gold transition-all flex-shrink-0" />
                  </div>
                  )}
                </Link>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Teams tab */}
      {tab === 'teams' && (
        <div className="space-y-3">
          {company.teams.length === 0 ? (
            <div className="bg-white border border-dashed border-ink-200 rounded-xl px-6 py-8 text-center text-ink-300 text-sm">
              No teams yet — add sub-groups within this company
            </div>
          ) : company.teams.map(team => (
            <div key={team.id} className="flex items-center gap-3 bg-white border border-ink-100 rounded-xl px-5 py-4">
              <Users size={14} className="text-ink-300" />
              <p className="text-sm font-medium text-ink">{team.name}</p>
            </div>
          ))}
          <button className="flex items-center gap-2 text-sm text-ink-400 hover:text-ink px-2 py-1 transition-all">
            <Plus size={14} />Add team
          </button>
        </div>
      )}
    </div>
  )
}