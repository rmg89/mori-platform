'use client'
import { useState } from 'react'
import { useStore } from '@/lib/store'
import { ReviewItem, ReviewAction } from '@/types'
import { formatDate } from '@/lib/utils'
import { Sparkles, CheckCircle2, AlertCircle, Clock, ChevronRight, Mail, UserPlus, EyeOff, HelpCircle } from 'lucide-react'

const ACTION_LABELS: Record<ReviewAction, string> = {
  create_prospect: 'Create Prospect',
  add_to_existing: 'Add to Existing',
  ignore: 'Ignore',
  update_prospect: 'Update Prospect',
}

const ACTION_COLORS: Record<ReviewAction, string> = {
  create_prospect: 'text-sage bg-sage/10 border-sage/20',
  add_to_existing: 'text-gold bg-gold/10 border-gold/20',
  ignore: 'text-ink-400 bg-parchment border-ink-200',
  update_prospect: 'text-blue-600 bg-blue-50 border-blue-100',
}

export default function ReviewPage() {
  const { reviewItems } = useStore()
  const [items, setItems] = useState(reviewItems)

  const pending = items.filter(i => !i.confirmed_at)
  const confirmed = items.filter(i => i.confirmed_at)

  const prospects = pending.filter(i => i.state === 'ai_sorted' && i.ai_suggested_action === 'create_prospect')
  const ignores = pending.filter(i => i.state === 'ai_sorted' && i.ai_suggested_action === 'ignore')
  const undecided = pending.filter(i => i.state === 'needs_review')

  function confirm(id: string, action?: ReviewAction) {
    setItems(prev => prev.map(i => i.id === id
      ? { ...i, ai_suggested_action: action ?? i.ai_suggested_action, confirmed_by: 'team@moritaheripour.com', confirmed_at: new Date().toISOString() }
      : i
    ))
  }

  function confirmAll(ids: string[]) {
    setItems(prev => prev.map(i => ids.includes(i.id)
      ? { ...i, confirmed_by: 'team@moritaheripour.com', confirmed_at: new Date().toISOString() }
      : i
    ))
  }

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-ink">Review</h1>
        <p className="text-ink-400 text-sm mt-1">
          {pending.length} item{pending.length !== 1 ? 's' : ''} need your attention
        </p>
        <div className="accent-line mt-3 w-24" />
      </div>

      {prospects.length > 0 && (
        <ReviewSection
          icon={<UserPlus size={14} className="text-sage" />}
          title="New Prospects"
          subtitle="AI is confident these are speaking inquiries"
          count={prospects.length}
          items={prospects}
          onConfirm={confirm}
          onConfirmAll={() => confirmAll(prospects.map(i => i.id))}
          borderColor="border-sage/20"
        />
      )}

      {ignores.length > 0 && (
        <ReviewSection
          icon={<EyeOff size={14} className="text-ink-400" />}
          title="Ignore"
          subtitle="AI flagged these as non-business emails"
          count={ignores.length}
          items={ignores}
          onConfirm={confirm}
          onConfirmAll={() => confirmAll(ignores.map(i => i.id))}
          borderColor="border-ink-100"
        />
      )}

      {undecided.length > 0 && (
        <ReviewSection
          icon={<HelpCircle size={14} className="text-amber-500" />}
          title="Needs a Decision"
          subtitle="AI wasn't confident — your call"
          count={undecided.length}
          items={undecided}
          onConfirm={confirm}
          borderColor="border-amber-200"
        />
      )}

      {pending.length === 0 && (
        <div className="bg-white border border-ink-100 rounded-xl p-12 text-center">
          <CheckCircle2 size={32} className="text-sage mx-auto mb-3" />
          <p className="text-sm font-semibold text-ink">All clear</p>
          <p className="text-xs text-ink-400 mt-1">Nothing needs your attention right now.</p>
        </div>
      )}

      {confirmed.length > 0 && (
        <div className="mt-8">
          <h2 className="font-display text-base font-semibold text-ink-400 mb-3">Recently Actioned</h2>
          <div className="space-y-2">
            {confirmed.map(item => (
              <div key={item.id} className="flex items-center gap-3 bg-parchment border border-ink-100 rounded-xl px-4 py-3 opacity-60">
                <CheckCircle2 size={14} className="text-sage flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-ink truncate">{item.from_name} — {item.subject}</p>
                  <p className="text-[10px] text-ink-400">{ACTION_LABELS[item.ai_suggested_action]} · {formatDate(item.confirmed_at!, 'MMM d, h:mm a')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ReviewSection({ icon, title, subtitle, count, items, onConfirm, onConfirmAll, borderColor }: {
  icon: React.ReactNode
  title: string
  subtitle: string
  count: number
  items: ReviewItem[]
  onConfirm: (id: string, action?: ReviewAction) => void
  onConfirmAll?: () => void
  borderColor: string
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
          <span className="text-sm text-ink-400">{count}</span>
        </div>
        {onConfirmAll && count > 1 && (
          <button
            onClick={onConfirmAll}
            className="flex items-center gap-1.5 text-xs font-medium text-ink-400 hover:text-ink bg-parchment hover:bg-ink-100 border border-ink-100 px-3 py-1.5 rounded-lg transition-all"
          >
            <CheckCircle2 size={12} />
            Confirm all {count}
          </button>
        )}
      </div>
      <p className="text-xs text-ink-400 mb-3">{subtitle}</p>
      <div className="space-y-2">
        {items.map(item => (
          <ReviewCard key={item.id} item={item} onConfirm={onConfirm} borderColor={borderColor} />
        ))}
      </div>
    </div>
  )
}

function ReviewCard({ item, onConfirm, borderColor }: {
  item: ReviewItem
  onConfirm: (id: string, action?: ReviewAction) => void
  borderColor: string
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`bg-white border ${borderColor} rounded-xl px-4 py-3`}>
      <div className="flex items-center justify-between gap-3 mb-0.5">
        <div className="flex items-center gap-2 min-w-0">
          <Mail size={13} className="text-ink-300 flex-shrink-0" />
          <span className="text-sm font-semibold text-ink truncate">{item.from_name}</span>
          <span className="text-xs text-ink-300 truncate hidden sm:block">{item.from_email}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Clock size={11} className="text-ink-300" />
          <span className="text-[10px] text-ink-300">{formatDate(item.received_at, 'MMM d')}</span>
        </div>
      </div>

      <p className="text-sm font-medium text-ink ml-5 mb-0.5">{item.subject}</p>
      <p className="text-xs text-ink-400 ml-5 line-clamp-1 mb-3">{item.body_preview}</p>

      <div className="flex items-center gap-2 ml-5 flex-wrap">
        <div className="flex items-center gap-1.5 bg-parchment rounded-lg px-2.5 py-1.5 flex-1 min-w-0">
          <Sparkles size={11} className="text-gold flex-shrink-0" />
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${ACTION_COLORS[item.ai_suggested_action]}`}>
            {ACTION_LABELS[item.ai_suggested_action]}
          </span>
          <span className="text-[10px] text-ink-400 truncate">{item.ai_reasoning}</span>
          <span className="text-[10px] text-ink-300 flex-shrink-0 ml-auto">{Math.round(item.ai_confidence * 100)}%</span>
        </div>
        <button
          onClick={() => onConfirm(item.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-ink text-cream text-xs font-medium rounded-lg hover:bg-ink-700 transition-all flex-shrink-0"
        >
          <CheckCircle2 size={12} />
          Confirm
        </button>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-parchment text-ink-500 text-xs font-medium rounded-lg hover:bg-ink-100 transition-all flex-shrink-0"
        >
          Sort as
          <ChevronRight size={11} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
      </div>

      {expanded && (
        <div className="mt-2 ml-5 flex gap-2 flex-wrap">
          {(['create_prospect', 'add_to_existing', 'ignore'] as ReviewAction[]).map(action => (
            <button
              key={action}
              onClick={() => { onConfirm(item.id, action); setExpanded(false) }}
              className={`text-[11px] font-medium px-3 py-1.5 rounded-lg border transition-all hover:opacity-80 ${ACTION_COLORS[action]}`}
            >
              {ACTION_LABELS[action]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}