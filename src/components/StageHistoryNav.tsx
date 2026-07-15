'use client'
import Link from 'next/link'
import { History } from 'lucide-react'
import { Engagement, Section } from '@/types'

const STAGE_PATH: Record<Section, string> = {
  prospects: '/prospects',
  engagements: '/engagements',
  'wrap-up': '/wrap-up',
}
const STAGE_LABEL: Record<Section, string> = {
  prospects: 'Prospects',
  engagements: 'Engagements',
  'wrap-up': 'Wrap-Up',
}
const STAGE_ORDER: Section[] = ['prospects', 'engagements', 'wrap-up']

// A record's stage history: prospects always happened, engagements only if it
// was ever confirmed (a directly-declined prospect skips straight to wrap-up
// and never gets an engagement_snapshot), wrap-up only once it's reached.
export function getRecordStages(e: Engagement): Section[] {
  const stages: Section[] = ['prospects']
  if (e.section === 'engagements' || e.engagement_snapshot != null) stages.push('engagements')
  if (e.section === 'wrap-up') stages.push('wrap-up')
  return stages
}

export default function StageHistoryNav({ engagement, current }: { engagement: Engagement; current: Section }) {
  const stages = getRecordStages(engagement)
  if (stages.length <= 1) return null

  return (
    <div className="bg-white border border-ink-100 rounded-xl p-5">
      <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-3 flex items-center gap-1.5">
        <History size={12} /> Stage History
      </p>
      <div className="flex items-center gap-2">
        {STAGE_ORDER.filter(s => stages.includes(s)).map(stage => {
          const isCurrent = stage === current
          return isCurrent ? (
            <span key={stage} className="text-sm font-medium px-4 py-1.5 rounded-full border bg-ink text-cream border-ink">
              {STAGE_LABEL[stage]}
            </span>
          ) : (
            <Link key={stage} href={`${STAGE_PATH[stage]}/${engagement.id}`}
              className="text-sm font-medium px-4 py-1.5 rounded-full border bg-parchment text-ink-400 border-ink-100 hover:border-gold/40 hover:text-ink transition-all">
              {STAGE_LABEL[stage]}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
