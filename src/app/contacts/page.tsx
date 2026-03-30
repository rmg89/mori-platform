'use client'
import { useState } from 'react'
import { MOCK_ENGAGEMENTS } from '@/lib/mock-data'
import { EngagementContact, Engagement, ContactStatus } from '@/types'
import { getInitials } from '@/lib/utils'
import { Search, Mail, ArrowRight, Eye } from 'lucide-react'
import Link from 'next/link'

type ContactWithEngagement = EngagementContact & { engagement: Engagement }

const ROLE_LABELS: Record<string, string> = {
  primary: 'Primary', bureau: 'Bureau', legal: 'Legal',
  logistics: 'Logistics', av: 'AV', assistant: 'Assistant', other: 'Other',
}

const ROLE_COLORS: Record<string, string> = {
  primary: 'text-sage bg-sage/10 border-sage/20',
  bureau: 'text-gold bg-gold/10 border-gold/20',
  legal: 'text-blue-500 bg-blue-50 border-blue-100',
  logistics: 'text-purple-500 bg-purple-50 border-purple-100',
  av: 'text-orange-500 bg-orange-50 border-orange-100',
  assistant: 'text-ink-400 bg-parchment border-ink-200',
  other: 'text-ink-400 bg-parchment border-ink-200',
}

const STATUS_LABELS: Record<ContactStatus, string> = {
  prospect_active: 'Prospect — Active',
  prospect_expired: 'Prospect — Expired',
  client: 'Client',
}

const STATUS_COLORS: Record<ContactStatus, string> = {
  prospect_active: 'text-sage bg-sage/10 border-sage/20',
  prospect_expired: 'text-ink-400 bg-parchment border-ink-200',
  client: 'text-gold bg-gold/10 border-gold/20',
}

type FilterStatus = ContactStatus | 'watching' | 'all'

const FILTERS: { id: FilterStatus; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'prospect_active', label: 'Prospect — Active' },
  { id: 'prospect_expired', label: 'Prospect — Expired' },
  { id: 'client', label: 'Client' },
  { id: 'watching', label: 'Watching' },
]

export default function ContactsPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterStatus>('all')

  const all: ContactWithEngagement[] = MOCK_ENGAGEMENTS.flatMap(e =>
    e.contacts.map(c => ({ ...c, engagement: e }))
  )

  const filtered = all.filter(c => {
    const q = search.toLowerCase()
    const matchesSearch = (
      c.first_name.toLowerCase().includes(q) ||
      c.last_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.engagement.organization.toLowerCase().includes(q) ||
      (c.title ?? '').toLowerCase().includes(q)
    )
    const matchesFilter =
      filter === 'all' ? true :
      filter === 'watching' ? !!c.watching :
      c.status === filter
    return matchesSearch && matchesFilter
  })

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-ink">Contacts</h1>
        <p className="text-ink-400 text-sm mt-1">{all.length} contacts across {MOCK_ENGAGEMENTS.length} engagements</p>
        <div className="accent-line mt-3 w-24" />
      </div>

      {/* Search + filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-ink-100 rounded-lg px-3 py-2 w-72">
          <Search size={14} className="text-ink-300" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, org, email..."
            className="bg-transparent text-sm text-ink placeholder:text-ink-300 outline-none flex-1"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                filter === f.id
                  ? 'bg-ink text-cream border-ink'
                  : 'bg-white text-ink-400 border-ink-100 hover:border-ink-300 hover:text-ink'
              }`}
            >
              {f.id === 'watching' && <Eye size={11} className="inline mr-1 -mt-0.5" />}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-ink-100 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[2fr_2fr_1fr_1fr_auto] border-b border-ink-100 px-5 py-2.5 bg-parchment">
          <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Contact</span>
          <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Organization</span>
          <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Role</span>
          <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Status</span>
          <span></span>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-ink-400">No contacts match your search.</div>
        ) : (
          <div className="divide-y divide-ink-50">
            {filtered.map(c => (
              <Link
                key={`${c.id}-${c.engagement.id}`}
                href={`/contacts/${c.id}`}
                className="grid grid-cols-[2fr_2fr_1fr_1fr_auto] px-5 py-3.5 hover:bg-parchment transition-all group items-center"
              >
                {/* Contact */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-ink-800 flex items-center justify-center text-xs font-bold text-gold flex-shrink-0">
                    {getInitials(c.first_name, c.last_name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate flex items-center gap-1.5">
                      {c.first_name} {c.last_name}
                      {c.watching && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] text-blue-500 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide">
                          <Eye size={8} />Watching
                        </span>
                      )}
                      {c.is_current_point_of_contact && (
                        <span className="text-[9px] text-gold bg-gold/10 border border-gold/20 px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide">POC</span>
                      )}
                    </p>
                    {c.email && (
                      <span className="text-[11px] text-ink-400 flex items-center gap-1 truncate mt-0.5">
                        <Mail size={10} />{c.email}
                      </span>
                    )}
                  </div>
                </div>

                {/* Organization */}
                <div className="min-w-0">
                  <p className="text-sm text-ink truncate">{c.engagement.organization}</p>
                  {c.title && <p className="text-xs text-ink-400 truncate">{c.title}</p>}
                </div>

                {/* Role */}
                <div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ROLE_COLORS[c.role] ?? ROLE_COLORS.other}`}>
                    {ROLE_LABELS[c.role] ?? c.role}
                  </span>
                </div>

                {/* Status */}
                <div>
                  {c.status ? (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[c.status]}`}>
                      {STATUS_LABELS[c.status]}
                    </span>
                  ) : (
                    <span className="text-xs text-ink-200">—</span>
                  )}
                </div>

                <ArrowRight size={14} className="text-ink-200 group-hover:text-gold transition-all" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}