'use client'
import { useState } from 'react'
import { MOCK_COMPANIES, MOCK_ENGAGEMENTS } from '@/lib/mock-data'
import { Company } from '@/types'
import { Search, Eye, ArrowRight, Plus, BookUser, Building2 } from 'lucide-react'
import Link from 'next/link'

type Filter = 'all' | 'prospects' | 'engagements' | 'post-event' | 'client' | 'expired' | 'watching'

function getCompanyStage(company: Company) {
  const engagements = MOCK_ENGAGEMENTS.filter(e => company.engagement_ids.includes(e.id))
  const hasProspect = engagements.some(e => e.section === 'prospects')
  const hasEngagement = engagements.some(e => e.section === 'engagements')
  const hasPostEvent = engagements.some(e => e.section === 'post-event')
  const isFullyComplete = engagements
    .filter(e => e.section === 'post-event')
    .every(e => e.post_event_flags.includes('marked_complete'))
  const hasAnyPostEvent = hasPostEvent

  if (hasEngagement) return 'engagements'
  if (hasAnyPostEvent && !isFullyComplete) return 'post-event'
  if (hasAnyPostEvent && isFullyComplete) return 'client'
  if (hasProspect) return 'prospects'
  return 'expired'
}

const FILTERS: { id: Filter; label: string; icon?: boolean; dividerBefore?: boolean }[] = [
  { id: 'all', label: 'All' },
  { id: 'prospects', label: 'Prospects' },
  { id: 'engagements', label: 'Engagements' },
  { id: 'post-event', label: 'Post-Event' },
  { id: 'client', label: 'Client', dividerBefore: true },
  { id: 'expired', label: 'Expired' },
  { id: 'watching', label: 'Watching', icon: true, dividerBefore: true },
]

const STAGE_COLORS: Record<string, string> = {
  prospects: 'text-sage bg-sage/10 border-sage/20',
  engagements: 'text-gold bg-gold/10 border-gold/20',
  'post-event': 'text-blue-500 bg-blue-50 border-blue-100',
  client: 'text-ink bg-ink/8 border-ink/20',
  expired: 'text-ink-300 bg-parchment border-ink-100',
}

const STAGE_LABELS: Record<string, string> = {
  prospects: 'Prospect',
  engagements: 'Engagement',
  'post-event': 'Post-Event',
  client: 'Client',
  expired: 'Expired',
}

export default function CompaniesPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = MOCK_COMPANIES.filter(company => {
    const q = search.toLowerCase()
    const matchesSearch = company.name.toLowerCase().includes(q) || (company.industry ?? '').toLowerCase().includes(q)
    if (!matchesSearch) return false

    if (filter === 'all') return true
    if (filter === 'watching') return !!company.watching
    return getCompanyStage(company) === filter
  })

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Companies</h1>
          <p className="text-ink-400 text-sm mt-1">{MOCK_COMPANIES.length} companies in your network</p>
          <div className="accent-line mt-3 w-24" />
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/contacts"
            className="flex items-center gap-2 px-3 py-2 bg-parchment border border-ink-100 text-ink-500 text-sm rounded-lg hover:bg-ink-100 transition-all"
          >
            <BookUser size={14} />
            Contacts
          </Link>
          <button className="flex items-center gap-2 px-4 py-2 bg-ink text-cream text-sm rounded-lg hover:bg-ink-700 transition-all">
            <Plus size={16} />
            Add Company
          </button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-ink-100 rounded-lg px-3 py-2 w-64">
          <Search size={14} className="text-ink-300" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search companies..."
            className="bg-transparent text-sm text-ink placeholder:text-ink-300 outline-none flex-1"
          />
        </div>

        <div className="flex items-center gap-1">
          {FILTERS.map(f => (
            <div key={f.id} className="flex items-center">
              {f.dividerBefore && (
                <div className="w-px h-5 bg-ink-100 mx-1.5" />
              )}
              <button
                onClick={() => setFilter(f.id)}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                  filter === f.id
                    ? 'bg-ink text-cream border-ink'
                    : 'bg-white text-ink-400 border-ink-100 hover:border-ink-300 hover:text-ink'
                }`}
              >
                {f.icon && <Eye size={11} />}
                {f.label}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Company list */}
      <div className="bg-white border border-ink-100 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] border-b border-ink-100 px-5 py-2.5 bg-parchment">
          <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Company</span>
          <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Industry</span>
          <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Stage</span>
          <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Contacts</span>
          <span></span>
        </div>
        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-ink-400">No companies match your filter.</div>
        ) : (
          <div className="divide-y divide-ink-50">
            {filtered.map(company => (
              <CompanyRow key={company.id} company={company} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CompanyRow({ company }: { company: Company }) {
  const stage = getCompanyStage(company)
  const stageColor = STAGE_COLORS[stage] ?? STAGE_COLORS.expired
  const stageLabel = STAGE_LABELS[stage] ?? '—'

  return (
    <Link
      href={`/companies/${company.id}`}
      className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] px-5 py-4 hover:bg-parchment transition-all group items-center"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-ink-100 flex items-center justify-center flex-shrink-0">
          <Building2 size={14} className="text-ink-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink flex items-center gap-2">
            {company.name}
            {company.watching && (
              <span className="inline-flex items-center gap-0.5 text-[9px] text-blue-500 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide">
                <Eye size={8} />Watching
              </span>
            )}
          </p>
          {company.teams.length > 0 && (
            <p className="text-xs text-ink-400 truncate">{company.teams.map(t => t.name).join(', ')}</p>
          )}
        </div>
      </div>
      <div>
        <span className="text-xs text-ink-500">{company.industry ?? '—'}</span>
      </div>
      <div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${stageColor}`}>
          {stageLabel}
        </span>
      </div>
      <div>
        <span className="text-sm font-medium text-ink">{company.contact_ids.length}</span>
      </div>
      <ArrowRight size={14} className="text-ink-200 group-hover:text-gold transition-all" />
    </Link>
  )
}