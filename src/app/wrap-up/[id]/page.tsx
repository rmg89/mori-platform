'use client'
import { useParams } from 'next/navigation'
import { useStore } from '@/lib/store'
import { POST_EVENT_FLAGS, PostEventFlag, primaryContact } from '@/types'
import { formatDate, getInitials } from '@/lib/utils'
import { ArrowLeft, AlertTriangle, CheckCircle2, Clock, Calendar, MapPin, Users, DollarSign, FileText, MinusCircle } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

function daysSince(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  const start = new Date(y, m - 1, d)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

function elapsed(dateStr: string): string {
  const days = daysSince(dateStr)
  if (days === 0) return 'today'
  if (days === 1) return '1 day ago'
  if (days < 7) return `${days} days ago`
  if (days < 14) return '1 week ago'
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  if (days < 60) return '1 month ago'
  return `${Math.floor(days / 30)} months ago`
}

type FlagState = 'unmarked' | 'needed' | 'done' | 'not_needed'

function getFlagState(flag: PostEventFlag, done: PostEventFlag[], needed: PostEventFlag[], notNeeded: PostEventFlag[]): FlagState {
  if (done.includes(flag)) return 'done'
  if (needed.includes(flag)) return 'needed'
  if (notNeeded.includes(flag)) return 'not_needed'
  return 'unmarked'
}

function FlagTile({
  flag,
  state,
  onNeeded,
  onDone,
  onNotNeeded,
  onReset,
  followUpDetails,
  onFollowUpDetails,
}: {
  flag: { id: PostEventFlag; label: string }
  state: FlagState
  onNeeded: () => void
  onDone: () => void
  onNotNeeded: () => void
  onReset: () => void
  followUpDetails?: string
  onFollowUpDetails?: (v: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const isFollowUp = flag.id === 'follow_up'

  const tileClass = {
    unmarked: 'bg-white border-ink-100',
    needed: 'bg-white border-ink-200',
    done: 'bg-sage/8 border-sage/30',
    not_needed: 'bg-parchment border-ink-100',
  }[state]

  const dotClass = {
    unmarked: 'border-ink-200 bg-white',
    needed: 'border-sage bg-sage/10',
    done: 'border-sage bg-sage',
    not_needed: 'border-ink-200 bg-ink-200',
  }[state]

  const labelClass = {
    unmarked: 'text-ink',
    needed: 'text-ink',
    done: 'text-sage-dark',
    not_needed: 'text-ink-300',
  }[state]

  const subText = {
    unmarked: 'Not assessed',
    needed: 'Needed',
    done: 'Done',
    not_needed: 'Not needed',
  }[state]

  const subClass = {
    unmarked: 'text-ink-300',
    needed: 'text-sage',
    done: 'text-sage',
    not_needed: 'text-ink-300',
  }[state]

  return (
    <div className={`relative rounded-xl border transition-all ${tileClass} ${isFollowUp ? 'flex-1 min-w-[160px]' : ''}`}>
      <div
        className="flex items-center gap-2.5 px-4 py-3 cursor-pointer"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className={`w-3.5 h-3.5 rounded-full border-[1.5px] flex items-center justify-center flex-shrink-0 ${dotClass}`}>
          {state === 'done' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
          {state === 'not_needed' && <div className="w-2 h-[1.5px] bg-white rounded-full" />}
        </div>
        <div>
          <p className={`text-sm font-medium ${labelClass}`}>{flag.label}</p>
          <p className={`text-[11px] ${subClass}`}>{subText}</p>
        </div>

        {/* Hover actions */}
        {hovered && (
          <div className="absolute inset-0 rounded-xl bg-parchment/95 flex overflow-hidden z-10"
            onMouseLeave={() => setHovered(false)}>
            {state === 'unmarked' && <>
              <button onClick={() => { onNeeded(); setHovered(false) }}
                className="flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-ink-400 hover:bg-sage/10 hover:text-sage-dark transition-colors border-r border-ink-100">
                <CheckCircle2 size={13} />Needed
              </button>
              <button onClick={() => { onNotNeeded(); setHovered(false) }}
                className="flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-ink-400 hover:bg-parchment hover:text-ink-500 transition-colors">
                <MinusCircle size={13} />Not needed
              </button>
            </>}
            {state === 'needed' && <>
              <button onClick={() => { onDone(); setHovered(false) }}
                className="flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-ink-400 hover:bg-sage/10 hover:text-sage-dark transition-colors border-r border-ink-100">
                <CheckCircle2 size={13} />Mark done
              </button>
              <button onClick={() => { onNotNeeded(); setHovered(false) }}
                className="flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-ink-400 hover:bg-parchment hover:text-ink-500 transition-colors">
                <MinusCircle size={13} />Not needed
              </button>
            </>}
            {state === 'done' && <>
              <button onClick={() => { onNeeded(); setHovered(false) }}
                className="flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-ink-400 hover:bg-sage/10 hover:text-sage-dark transition-colors border-r border-ink-100">
                <CheckCircle2 size={13} />Mark needed
              </button>
              <button onClick={() => { onNotNeeded(); setHovered(false) }}
                className="flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-ink-400 hover:bg-parchment hover:text-ink-500 transition-colors">
                <MinusCircle size={13} />Not needed
              </button>
            </>}
            {state === 'not_needed' && <>
              <button onClick={() => { onNeeded(); setHovered(false) }}
                className="flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-ink-400 hover:bg-sage/10 hover:text-sage-dark transition-colors border-r border-ink-100">
                <CheckCircle2 size={13} />Needed
              </button>
              <button onClick={() => { onReset(); setHovered(false) }}
                className="flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-ink-400 hover:bg-parchment hover:text-ink-500 transition-colors">
                <MinusCircle size={13} />Reset
              </button>
            </>}
          </div>
        )}
      </div>

      {/* Follow-up details expansion */}
      {isFollowUp && (state === 'needed' || state === 'done') && (
        <div className="px-4 pb-3 pt-0 border-t border-ink-100 mt-0">
          <p className="text-[10px] font-medium text-ink-400 uppercase tracking-wider mb-1.5 mt-2">Follow-up details</p>
          <input
            type="text"
            value={followUpDetails ?? ''}
            onChange={e => onFollowUpDetails?.(e.target.value)}
            placeholder="e.g. re-booking conversation, debrief call..."
            className="w-full text-xs bg-white border border-ink-100 rounded-lg px-3 py-2 text-ink placeholder:text-ink-300 focus:outline-none focus:border-ink-300"
          />
        </div>
      )}
    </div>
  )
}

export default function WrapUpDetailPage() {
  const { id } = useParams()
  const {
    engagements: allEngagements,
    setPostEventFlagNeeded,
    setPostEventFlagDone,
    setPostEventFlagNotNeeded,
    resetPostEventFlag,
    updatePostEventFollowUpDetails,
    updatePostEventNotes,
  } = useStore()

  const e = allEngagements.find(eng => eng.id === id)
  if (!e) return <div className="p-8 text-ink-400">Not found</div>

  const pc = primaryContact(e)
  const done = e.post_event_flags ?? []
  const needed = e.post_event_needed ?? []
  const notNeeded = e.post_event_not_needed ?? []
  const sinceEvent = e.event_date ? daysSince(e.event_date) : null

  const neededCount = needed.length + done.length
  const doneCount = done.length
  const outstandingCount = needed.length
  const allAssessedAndDone = neededCount > 0 && outstandingCount === 0

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fade-in">
      <Link href="/wrap-up" className="flex items-center gap-2 text-sm text-ink-400 hover:text-ink mb-6 transition-all">
        <ArrowLeft size={14} /> Back to Wrap-Up
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <FileText size={13} className="text-ink-400" />
          <span className="text-xs text-ink-400 uppercase tracking-widest font-medium">Wrap-Up</span>
        </div>
        <h1 className="font-display text-3xl font-semibold text-ink">{e.event_name || e.organization}</h1>
        <p className="text-ink-400 text-sm mt-1">{e.organization}{e.booker_name ? ` · via ${e.booker_name}` : ''}</p>
        <div className="accent-line mt-3 w-24" />
      </div>

      {/* Alerts */}
      {e.alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {e.alerts.map((alert, i) => (
            <div key={i} className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium ${
              alert.severity === 'high' ? 'text-red-500 bg-red-50 border-red-100' : 'text-gold bg-gold/8 border-gold/20'
            }`}>
              <AlertTriangle size={14} />{alert.label}
            </div>
          ))}
        </div>
      )}

      {/* Wrap-Up Items */}
      <div className="bg-white border border-ink-100 rounded-xl mb-6 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-ink-100">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">Wrap-Up Items</p>
          <span className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border ${
            allAssessedAndDone
              ? 'bg-sage/8 border-sage/20 text-sage'
              : outstandingCount > 0
              ? 'bg-amber-50 border-amber-100 text-amber-600'
              : 'bg-parchment border-ink-100 text-ink-400'
          }`}>
            {allAssessedAndDone ? <CheckCircle2 size={11} /> : <Clock size={11} />}
            {allAssessedAndDone
              ? 'All done'
              : outstandingCount > 0
              ? `${outstandingCount} item${outstandingCount !== 1 ? 's' : ''} outstanding`
              : 'Not yet assessed'}
          </span>
        </div>

        <div className="p-4 flex flex-wrap gap-3">
          {POST_EVENT_FLAGS.map((flag) => {
            const state = getFlagState(flag.id as PostEventFlag, done, needed, notNeeded)
            return (
              <FlagTile
                key={flag.id}
                flag={flag as { id: PostEventFlag; label: string }}
                state={state}
                onNeeded={() => setPostEventFlagNeeded(e.id, flag.id as PostEventFlag)}
                onDone={() => setPostEventFlagDone(e.id, flag.id as PostEventFlag)}
                onNotNeeded={() => setPostEventFlagNotNeeded(e.id, flag.id as PostEventFlag)}
                onReset={() => resetPostEventFlag(e.id, flag.id as PostEventFlag)}
                followUpDetails={e.post_event_follow_up_details}
                onFollowUpDetails={(v) => updatePostEventFollowUpDetails(e.id, v)}
              />
            )
          })}
        </div>

        {/* Notes */}
        <div className="px-5 pb-5 pt-1 border-t border-ink-100">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400 mb-2 mt-4">Notes</p>
          <textarea
            value={e.post_event_notes ?? ''}
            onChange={ev => updatePostEventNotes(e.id, ev.target.value)}
            placeholder="Any context, outstanding items, or details about this engagement's wrap-up..."
            rows={3}
            className="w-full text-sm bg-parchment/40 border border-ink-100 rounded-xl px-4 py-3 text-ink placeholder:text-ink-300 focus:outline-none focus:border-ink-200 resize-none"
          />
        </div>
      </div>

      {/* Event details + contacts */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-ink-100 rounded-xl p-5">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Event Details</p>
          <div className="space-y-3">
            {e.event_date && (
              <div className="flex items-center gap-2.5 text-sm">
                <Calendar size={14} className="text-ink-300 flex-shrink-0" />
                {formatDate(e.event_date)}
                {sinceEvent !== null && sinceEvent > 0 && (
                  <span className="text-xs text-ink-300">· {elapsed(e.event_date)}</span>
                )}
              </div>
            )}
            {e.event_city && <div className="flex items-center gap-2.5 text-sm"><MapPin size={14} className="text-ink-300 flex-shrink-0" />{e.event_city}</div>}
            {e.session_length && <div className="flex items-center gap-2.5 text-sm"><Clock size={14} className="text-ink-300 flex-shrink-0" />{e.session_length} min</div>}
            {e.audience_size && <div className="flex items-center gap-2.5 text-sm"><Users size={14} className="text-ink-300 flex-shrink-0" />{e.audience_size.toLocaleString()} attendees</div>}
            {e.fee && (
              <div className="flex items-center gap-2.5 text-sm">
                <DollarSign size={14} className="text-ink-300 flex-shrink-0" />
                <span className={done.includes('invoice') ? 'text-sage font-medium' : ''}>${e.fee.toLocaleString()}</span>
                <span className={`text-xs ${done.includes('invoice') ? 'text-sage' : 'text-ink-300'}`}>
                  {done.includes('invoice') ? '· Invoice handled' : needed.includes('invoice') ? '· Invoice needed' : '· Invoice pending'}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-ink-100 rounded-xl p-5">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Contacts</p>
          <div className="space-y-3">
            {e.contacts.map(c => (
              <div key={c.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-ink-800 flex items-center justify-center text-xs font-bold text-gold flex-shrink-0">
                  {getInitials(c.first_name, c.last_name)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{c.first_name} {c.last_name}</p>
                  {c.title && <p className="text-xs text-ink-400">{c.title}</p>}
                  <p className="text-xs text-ink-300 truncate">{c.email}</p>
                </div>
                {c.is_current_point_of_contact && (
                  <span className="ml-auto text-[10px] text-gold bg-gold/10 px-2 py-0.5 rounded-full border border-gold/20 flex-shrink-0">POC</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white border border-ink-100 rounded-xl p-5">
        <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Timeline</p>
        <div className="space-y-4">
          {e.comms.map(comm => (
            <div key={comm.id} className={`flex gap-3 ${comm.type === 'email_outbound' ? 'flex-row-reverse' : ''}`}>
              <div className={`text-xs px-3 py-2 rounded-xl max-w-lg ${
                comm.type === 'email_outbound' ? 'bg-ink text-cream ml-auto'
                : comm.type === 'stage_change' ? 'bg-parchment text-ink-400 italic'
                : 'bg-parchment text-ink'
              }`}>
                {comm.subject && <p className="font-semibold mb-1">{comm.subject}</p>}
                <p className="whitespace-pre-line">{comm.body}</p>
                <p className="text-[10px] opacity-60 mt-1">{comm.from_name} · {formatDate(comm.date, 'MMM d, h:mm a')}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}