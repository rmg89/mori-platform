'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserSearch, Handshake, Archive, Building2 } from 'lucide-react'
import { useStore } from '@/lib/store'
import { getInitials } from '@/lib/utils'
import type { Section } from '@/types'

type Result =
  | { kind: 'engagement'; id: string; href: string; title: string; subtitle: string; section: Section }
  | { kind: 'company'; id: string; href: string; title: string; subtitle: string }
  | { kind: 'contact'; id: string; href: string; title: string; subtitle: string; firstName: string; lastName: string }

const MAX_PER_GROUP = 4

const SECTION_ICON: Record<Section, typeof UserSearch> = {
  prospects: UserSearch,
  engagements: Handshake,
  'wrap-up': Archive,
}

const SECTION_LABEL: Record<Section, string> = {
  prospects: 'Prospect',
  engagements: 'Engagement',
  'wrap-up': 'Wrap-Up',
}

export default function GlobalSearch() {
  const { engagements, companies } = useStore()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const { engagementResults, companyResults, contactResults } = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return { engagementResults: [] as Result[], companyResults: [] as Result[], contactResults: [] as Result[] }

    const engagementResults: Result[] = engagements
      .filter(e =>
        e.organization.toLowerCase().includes(q) ||
        (e.topic ?? '').toLowerCase().includes(q) ||
        (e.event_city ?? '').toLowerCase().includes(q) ||
        (e.event_name ?? '').toLowerCase().includes(q)
      )
      .slice(0, MAX_PER_GROUP)
      .map(e => ({
        kind: 'engagement' as const,
        id: e.id,
        href: `/${e.section}/${e.id}`,
        title: e.organization,
        subtitle: e.topic || e.event_city || SECTION_LABEL[e.section],
        section: e.section,
      }))

    const companyResults: Result[] = companies
      .filter(c => c.name.toLowerCase().includes(q) || (c.industry ?? '').toLowerCase().includes(q))
      .slice(0, MAX_PER_GROUP)
      .map(c => ({
        kind: 'company' as const,
        id: c.id,
        href: `/companies/${c.id}`,
        title: c.name,
        subtitle: c.industry || 'Company',
      }))

    const contactResults: Result[] = engagements
      .flatMap(e => e.contacts.map(c => ({ ...c, engagement: e })))
      .filter(c =>
        c.first_name.toLowerCase().includes(q) ||
        c.last_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.title ?? '').toLowerCase().includes(q)
      )
      .slice(0, MAX_PER_GROUP)
      .map(c => ({
        kind: 'contact' as const,
        id: c.id,
        href: `/contacts/${c.id}`,
        title: `${c.first_name} ${c.last_name}`.trim(),
        subtitle: c.engagement.organization,
        firstName: c.first_name,
        lastName: c.last_name,
      }))

    return { engagementResults, companyResults, contactResults }
  }, [query, engagements, companies])

  const allResults = [...engagementResults, ...companyResults, ...contactResults]
  const hasQuery = query.trim().length > 0

  function goTo(href: string) {
    router.push(href)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={wrapperRef} className="relative w-48">
      <div className="flex items-center gap-2 rounded-lg px-2.5 py-1 bg-ink-50/60 border border-ink-100/60">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-300 flex-shrink-0">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Escape') { setQuery(''); setOpen(false); (e.target as HTMLInputElement).blur() }
            if (e.key === 'Enter' && allResults[0]) goTo(allResults[0].href)
          }}
          placeholder="Search clients, events..."
          className="bg-transparent text-xs text-ink-600 placeholder:text-ink-300 outline-none flex-1"
        />
      </div>

      {open && hasQuery && (
        <div className="absolute left-0 top-full mt-1.5 w-80 max-h-96 overflow-y-auto bg-white border border-ink-100 rounded-lg shadow-lg p-1.5 z-50">
          {allResults.length === 0 ? (
            <p className="text-xs text-ink-300 italic px-2 py-3 text-center">No results for &ldquo;{query}&rdquo;</p>
          ) : (
            <>
              {engagementResults.length > 0 && (
                <ResultGroup label="Engagements">
                  {engagementResults.map(r => <ResultRow key={r.id} result={r} onClick={() => goTo(r.href)} />)}
                </ResultGroup>
              )}
              {companyResults.length > 0 && (
                <ResultGroup label="Companies">
                  {companyResults.map(r => <ResultRow key={r.id} result={r} onClick={() => goTo(r.href)} />)}
                </ResultGroup>
              )}
              {contactResults.length > 0 && (
                <ResultGroup label="Contacts">
                  {contactResults.map(r => <ResultRow key={r.id} result={r} onClick={() => goTo(r.href)} />)}
                </ResultGroup>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ResultGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1 last:mb-0">
      <div className="text-[10px] text-ink-300 uppercase tracking-widest px-2 pt-1.5 pb-1">{label}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function ResultRow({ result, onClick }: { result: Result; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-parchment transition-colors text-left">
      <div className="w-6 h-6 rounded-full bg-ink-800 flex items-center justify-center text-[10px] font-bold text-gold flex-shrink-0">
        {result.kind === 'company' && <Building2 size={11} />}
        {result.kind === 'engagement' && (() => {
          const Icon = SECTION_ICON[result.section]
          return <Icon size={11} />
        })()}
        {result.kind === 'contact' && getInitials(result.firstName, result.lastName)}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink truncate">{result.title}</p>
        <p className="text-[11px] text-ink-400 truncate">{result.subtitle}</p>
      </div>
    </button>
  )
}
