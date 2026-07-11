'use client'
import { useStore } from '@/lib/store'
import { Engagement, primaryContact } from '@/types'
import { formatDate, getInitials } from '@/lib/utils'
import { ArrowRight, Calendar, MapPin } from 'lucide-react'
import Link from 'next/link'
import UnarchiveButton from '@/components/UnarchiveButton'

const SECTION_PATH: Record<string, string> = {
  prospects: '/prospects',
  engagements: '/engagements',
  'wrap-up': '/wrap-up',
}

const SECTION_LABEL: Record<string, string> = {
  prospects: 'Prospect',
  engagements: 'Engagement',
  'wrap-up': 'Wrap-Up',
}

function ArchiveCard({ engagement: e }: { engagement: Engagement }) {
  const pc = primaryContact(e)
  const path = SECTION_PATH[e.section] ?? '/engagements'

  return (
    <Link href={`${path}/${e.id}`}
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
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-ink-50 border-ink-100 text-ink-400">
                {SECTION_LABEL[e.section] ?? e.section}
              </span>
              <UnarchiveButton
                engagementId={e.id}
                onClick={ev => { ev.preventDefault(); ev.stopPropagation() }}
                className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full border border-ink-100 text-ink-400 hover:bg-ink hover:text-white hover:border-ink transition-all"
              />
              <ArrowRight size={13} className="text-ink-200 group-hover:text-gold transition-all" />
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-ink-400 mt-2">
            {e.event_date && <span className="flex items-center gap-1"><Calendar size={11} />{formatDate(e.event_date)}</span>}
            {e.event_city && <span className="flex items-center gap-1"><MapPin size={11} />{e.event_city}</span>}
            {e.archived_at && <span>Archived {formatDate(e.archived_at)}</span>}
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function ArchivePage() {
  const { engagements: allEngagements } = useStore()
  const archived = allEngagements.filter(e => e.archived)

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-ink">Archive</h1>
        <p className="text-ink-400 text-sm mt-1">{archived.length} archived</p>
        <div className="accent-line mt-3 w-24" />
      </div>

      {archived.length === 0 ? (
        <p className="text-sm text-ink-400">Nothing archived yet.</p>
      ) : (
        <div className="space-y-3">
          {archived
            .sort((a, b) => (b.archived_at ?? '') > (a.archived_at ?? '') ? 1 : -1)
            .map(e => <ArchiveCard key={e.id} engagement={e} />)
          }
        </div>
      )}
    </div>
  )
}
