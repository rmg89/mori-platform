'use client'
import Link from 'next/link'
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
    <div className="flex items-center gap-1.5 mb-6">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-300 mr-1">History</span>
      {STAGE_ORDER.filter(s => stages.includes(s)).map(stage => {
        const isCurrent = stage === current
        return isCurrent ? (
          <span key={stage} className="text-xs font-medium px-3 py-1 rounded-full border bg-ink text-cream border-ink">
            {STAGE_LABEL[stage]}
          </span>
        ) : (
          <Link key={stage} href={`${STAGE_PATH[stage]}/${engagement.id}`}
            className="text-xs font-medium px-3 py-1 rounded-full border bg-parchment text-ink-400 border-ink-100 hover:border-gold/40 hover:text-ink transition-all">
            {STAGE_LABEL[stage]}
          </Link>
        )
      })}
    </div>
  )
}
