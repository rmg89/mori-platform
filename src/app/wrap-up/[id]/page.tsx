'use client'
import { useState, useTransition } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { POST_EVENT_FLAGS, PostEventFlag, WrapUpFlagStages, PostEventMediaType, Invoice, primaryContact } from '@/types'
import { formatDate, getInitials, formatRelativeDue } from '@/lib/utils'
import { ArrowLeft, AlertTriangle, CheckCircle2, Clock, Calendar, MapPin, Users, DollarSign, FileText, Plus, X, FolderArchive, Trash2, Image as ImageIcon, UploadCloud, StickyNote, Film, Music, Link2, History, ChevronDown, ChevronUp, Flag, Bell, BellOff, Download } from 'lucide-react'
import Link from 'next/link'
import ConfirmModal from '@/components/ConfirmModal'
import ArchiveModal from '@/components/ArchiveModal'
import InvoiceEditModal from '@/components/InvoiceEditModal'

function daysSince(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  const start = new Date(y, m - 1, d)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

function isFollowUpOverdue(dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return date.getTime() < today.getTime()
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

const FLAG_STAGES: Record<PostEventFlag, { id: string; label: string }[]> = {
  invoice:     [{ id: 'finalized', label: 'Finalized' }, { id: 'sent', label: 'Sent' }, { id: 'partial_payment', label: 'Partial payment' }, { id: 'paid', label: 'Paid' }],
  thank_you:   [{ id: 'sent', label: 'Sent' }],
  testimonial: [{ id: 'requested', label: 'Requested' }, { id: 'received', label: 'Received' }],
  media:       [{ id: 'received', label: 'Received' }, { id: 'uploaded', label: 'Uploaded' }, { id: 'processed', label: 'Processed' }],
  social_media:[{ id: 'planned', label: 'Planned' }, { id: 'in_progress', label: 'In progress' }, { id: 'complete', label: 'Complete' }],
  follow_up:   [{ id: 'done', label: 'Done' }],
}

const FINAL_STAGES: Record<PostEventFlag, string> = {
  invoice:     'paid',
  thank_you:   'sent',
  testimonial: 'received',
  media:       'processed',
  social_media:'complete',
  follow_up:   'done',
}

const MEDIA_TYPE_ICONS: Record<PostEventMediaType, typeof ImageIcon> = {
  photo: ImageIcon,
  video: Film,
  audio: Music,
  link:  Link2,
}

function mediaDefaultName(type: PostEventMediaType, url: string): string {
  const typeLabel: Record<PostEventMediaType, string> = { photo: 'Photo', video: 'Video', audio: 'Audio', link: 'Link' }
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return `${typeLabel[type]} — ${host}`
  } catch {
    return typeLabel[type]
  }
}

function StagePills({
  flagId,
  currentStage,
  onStageClick,
  isDone,
}: {
  flagId: PostEventFlag
  currentStage?: string
  onStageClick: (stageId: string) => void
  isDone: boolean
}) {
  const stages = FLAG_STAGES[flagId]
  const currentIdx = currentStage ? stages.findIndex(s => s.id === currentStage) : -1

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {stages.map((stage, idx) => {
        const isActive = idx === currentIdx
        const isPast = idx < currentIdx
        const isFuture = idx > currentIdx

        return (
          <button
            key={stage.id}
            onClick={() => {
              if (isActive && currentIdx > 0) {
                // rewind to previous
                onStageClick(stages[currentIdx - 1].id)
              } else if (isActive && currentIdx === 0) {
                // rewind to no stage
                onStageClick('')
              } else if (!isFuture || idx === currentIdx + 1) {
                // advance to next or jump back to past
                onStageClick(stage.id)
              }
            }}
            className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-all ${
              isActive && isDone
                ? 'bg-sage text-white border-sage'
                : isActive
                ? 'bg-ink text-cream border-ink'
                : isPast
                ? 'bg-sage/10 text-sage-dark border-sage/20 hover:bg-sage/20'
                : 'bg-parchment text-ink-300 border-ink-100 hover:border-ink-200 hover:text-ink-500'
            }`}
          >
            {stage.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Snapshot Panel ───────────────────────────────────────────────────────────

const SNAPSHOT_LABELS: Record<string, string> = {
  prospect_step: 'Pipeline Step', source: 'Source', notes: 'Notes',
  event_date: 'Target Date', event_city: 'City', fee: 'Fee',
  topic: 'Topic', audience_size: 'Audience', event_format: 'Format',
  contract_required: 'Contract Required', contract_sent_at: 'Contract Sent',
  contract_signed_at: 'Contract Signed', briefing_complete: 'Briefing Complete',
  deposit_amount: 'Deposit', join_link: 'Join Link',
  arrival_time: 'Arrival Time', hotel_name: 'Hotel',
  flight_details: 'Flight Details',
}
const SKIP_KEYS = new Set(['calls', 'comms', 'contacts', 'proposed_dates', 'outgoing_materials', 'incoming_materials', 'briefing_notes', 'run_of_show'])

function fmtVal(key: string, val: unknown): string | null {
  if (val === null || val === undefined || val === '' || val === false) return null
  if (Array.isArray(val)) return val.length > 0 ? `${val.length} items` : null
  if (typeof val === 'object') return null
  if (key.endsWith('_at') || key.endsWith('_date')) {
    try { return new Date(val as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return String(val) }
  }
  if (key === 'fee' || key === 'deposit_amount') return `$${Number(val).toLocaleString()}`
  if (key === 'audience_size') return `${Number(val).toLocaleString()} attendees`
  return String(val)
}

function WrapUpSnapshotPanel({ label = 'Engagement Stage History', snapshot }: { label?: string; snapshot: Record<string, unknown> }) {
  const [open, setOpen] = useState(false)
  const entries = Object.entries(snapshot).filter(([k, v]) => !SKIP_KEYS.has(k) && fmtVal(k, v) !== null)
  if (entries.length === 0) return null
  return (
    <div className="border border-ink-100 rounded-xl overflow-hidden mt-3">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-3 bg-parchment/60 hover:bg-parchment transition-colors text-left">
        <History size={13} className="text-ink-300 flex-shrink-0" />
        <span className="text-xs font-semibold text-ink-400 uppercase tracking-widest flex-1">{label}</span>
        <span className="text-[10px] text-ink-300 mr-1">{entries.length} fields</span>
        {open ? <ChevronUp size={13} className="text-ink-300" /> : <ChevronDown size={13} className="text-ink-300" />}
      </button>
      {open && (
        <div className="bg-white px-5 py-4">
          <p className="text-[10px] text-ink-300 italic mb-3">Read-only snapshot from the previous stage — for reference only.</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            {entries.map(([k, v]) => {
              const display = fmtVal(k, v)
              if (!display) return null
              const lbl = SNAPSHOT_LABELS[k] ?? k.replace(/_/g, ' ')
              return (
                <div key={k} className="flex items-start gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-300 w-28 flex-shrink-0 mt-0.5 truncate">{lbl}</span>
                  <span className="text-xs text-ink-500 flex-1">{display}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Timeline Panel ───────────────────────────────────────────────────────────

function WrapUpNextStepBadge({ comm, engagementId }: { comm: import('@/types').CommEntry; engagementId: string }) {
  const { updateComm } = useStore()
  const [snoozePicking, setSnoozePicking] = useState(false)
  const [snoozeDate, setSnoozeDate] = useState('')
  if (!comm.next_step) return null
  if (comm.next_step_cleared) return (
    <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-ink-200 line-through">
      <span>✓</span> {comm.next_step}
    </div>
  )
  const now = new Date()
  const snoozed = comm.next_step_snoozed_until && new Date(comm.next_step_snoozed_until) > now
  const due = comm.next_step_due_at ? new Date(comm.next_step_due_at) : null
  const overdue = !snoozed && due && due < now
  if (snoozed) return (
    <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-ink-300">
      <BellOff size={9} />
      <span className="italic">{comm.next_step} — snoozed until {new Date(comm.next_step_snoozed_until!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
      <button onClick={() => updateComm(engagementId, comm.id, { next_step_snoozed_until: undefined })} className="text-ink-200 hover:text-ink-400">wake</button>
    </div>
  )
  return (
    <div className={`mt-1.5 rounded-lg px-2.5 py-1.5 border flex items-start gap-2 ${overdue ? 'bg-red-50 border-red-100' : 'bg-gold/6 border-gold/20'}`}>
      <Flag size={9} className={`flex-shrink-0 mt-0.5 ${overdue ? 'text-red-400' : 'text-gold'}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-[10px] font-medium ${overdue ? 'text-red-600' : 'text-gold-dark'}`}>{comm.next_step}</p>
        {due && <p className={`text-[9px] mt-0.5 ${overdue ? 'text-red-400' : 'text-gold/70'}`}>{overdue ? 'Overdue — ' : 'Due '}{due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {!snoozePicking ? (
          <button onClick={() => setSnoozePicking(true)} title="Snooze" className="text-ink-300 hover:text-ink-500 p-0.5"><Bell size={9} /></button>
        ) : (
          <div className="flex items-center gap-1">
            <input type="date" value={snoozeDate} onChange={e => setSnoozeDate(e.target.value)}
              className="text-[10px] border border-ink-100 rounded px-1 py-0.5 focus:outline-none focus:border-gold/50 bg-white" />
            <button onClick={() => { if (snoozeDate) updateComm(engagementId, comm.id, { next_step_snoozed_until: new Date(snoozeDate + 'T09:00:00').toISOString() }); setSnoozePicking(false); setSnoozeDate('') }} className="text-sage hover:text-sage-dark p-0.5">✓</button>
            <button onClick={() => { setSnoozePicking(false); setSnoozeDate('') }} className="text-ink-300 p-0.5">✕</button>
          </div>
        )}
        <button onClick={() => updateComm(engagementId, comm.id, { next_step_cleared: true })} title="Mark done" className="text-ink-300 hover:text-sage p-0.5">✓</button>
      </div>
    </div>
  )
}

function WrapUpLogCommPanel({ engagementId, onClose }: { engagementId: string; onClose: () => void }) {
  const { addComm } = useStore()
  const [type, setType] = useState<'note' | 'call' | 'email_outbound'>('note')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [nextStepDue, setNextStepDue] = useState('')
  const submit = () => {
    if (!body.trim()) return
    const now = new Date().toISOString()
    const defaultDue = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    addComm(engagementId, {
      id: `cm_${Date.now()}`, type, date: now,
      subject: subject || undefined, body,
      from_name: "Mori's Team", staff_name: 'Ryan G.', needs_response: false,
      next_step: nextStep || undefined,
      next_step_due_at: nextStep ? (nextStepDue ? new Date(nextStepDue + 'T09:00:00').toISOString() : defaultDue) : undefined,
    })
    onClose()
  }
  return (
    <div className="bg-parchment/60 border border-ink-100 rounded-xl p-4 mt-4 space-y-3">
      <div className="flex gap-2">
        {(['note', 'call', 'email_outbound'] as const).map(t => (
          <button key={t} onClick={() => setType(t)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${type === t ? 'bg-ink text-cream border-ink' : 'bg-white text-ink-400 border-ink-100 hover:border-ink-300'}`}>
            {t === 'note' ? 'Note' : t === 'call' ? 'Call' : 'Email Sent'}
          </button>
        ))}
      </div>
      <input type="text" placeholder="Subject (optional)" value={subject} onChange={e => setSubject(e.target.value)}
        className="w-full text-sm border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-gold bg-white" />
      <textarea placeholder="Notes…" value={body} onChange={e => setBody(e.target.value)} rows={3}
        className="w-full text-sm border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-gold resize-none bg-white" />
      <div className="border-t border-ink-50 pt-3 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-300">Next Step (optional)</p>
        <input type="text" placeholder="What needs to happen next?" value={nextStep} onChange={e => setNextStep(e.target.value)}
          className="w-full text-sm border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-gold bg-white" />
        {nextStep && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-300 flex-shrink-0">Due by:</span>
            <input type="date" value={nextStepDue} onChange={e => setNextStepDue(e.target.value)}
              className="text-xs border border-ink-100 rounded-lg px-2.5 py-1.5 outline-none focus:border-gold bg-white" />
            {!nextStepDue && <span className="text-xs text-ink-300 italic">default: 48 hours</span>}
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button onClick={submit} className="text-xs font-medium text-white bg-ink px-4 py-2 rounded-lg hover:bg-ink-700 transition-all">Log</button>
        <button onClick={onClose} className="text-xs font-medium text-ink-400 px-4 py-2 rounded-lg hover:text-ink transition-all">Cancel</button>
      </div>
    </div>
  )
}


function WrapUpTimelinePanel({ engagementId, comms }: { engagementId: string; comms: import('@/types').CommEntry[] }) {
  const [showLog, setShowLog] = useState(false)
  const sorted = [...comms].sort((a, b) => a.date > b.date ? 1 : -1)
  return (
    <div className="bg-white border border-ink-100 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-ink-400 uppercase tracking-widest font-medium">Timeline</p>
        <button onClick={() => setShowLog(v => !v)}
          className="flex items-center gap-1 text-xs font-medium text-gold hover:text-gold-dark transition-all">
          <Plus size={12} /> Log Activity
        </button>
      </div>
      {showLog && <WrapUpLogCommPanel engagementId={engagementId} onClose={() => setShowLog(false)} />}
      <div className="space-y-4 mt-2">
        {sorted.map(comm => (
          <div key={comm.id} className={`flex gap-3 ${comm.type === 'email_outbound' ? 'flex-row-reverse' : ''}`}>
            <div className={`text-xs px-3 py-2 rounded-xl max-w-lg w-full ${
              comm.type === 'email_outbound' ? 'bg-ink text-cream ml-auto'
              : comm.type === 'stage_change' ? 'bg-parchment text-ink-400 italic'
              : 'bg-parchment text-ink'
            }`}>
              {comm.subject && <p className="font-semibold mb-1">{comm.subject}</p>}
              <p className="whitespace-pre-line">{comm.body}</p>
              <p className="text-[10px] opacity-60 mt-1">{comm.from_name} · {formatDate(comm.date, 'MMM d, h:mm a')}</p>
              <WrapUpNextStepBadge comm={comm} engagementId={engagementId} />
            </div>
          </div>
        ))}
        {sorted.length === 0 && <p className="text-xs text-ink-300 italic">No activity logged yet.</p>}
      </div>
    </div>
  )
}

export default function WrapUpDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const {
    engagements: allEngagements,
    setPostEventFlagNeeded,
    setPostEventFlagDone,
    setPostEventFlagNotNeeded,
    resetPostEventFlag,
    updatePostEventFollowUpDetails,
    updatePostEventFollowUpDate,
    updatePostEventTestimonialLink,
    updatePostEventTestimonialText,
    updatePostEventNotes,
    updatePostEventItemNote,
    addPostEventMedia,
    removePostEventMedia,
    updatePostEventMediaDescription,
    updatePostEventStage,
    confirmWrapUpReview,
    archiveEngagement,
    deleteEngagement,
  } = useStore()
  const [archiveModalOpen, setArchiveModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [, startTransition] = useTransition()
  const [mediaUploading, setMediaUploading] = useState(false)
  const [addingMediaType, setAddingMediaType] = useState<PostEventMediaType | null>(null)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkDescription, setLinkDescription] = useState('')
  const [invoiceDownloading, setInvoiceDownloading] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)

  const e = allEngagements.find(eng => eng.id === id)
  if (!e) return <div className="p-8 text-ink-400">Not found</div>

  const engagementId = e.id
  const done = e.post_event_flags ?? []
  const needed = e.post_event_needed ?? []
  const notNeeded = e.post_event_not_needed ?? []
  const stages = e.post_event_stages ?? {}
  const sinceEvent = e.event_date ? daysSince(e.event_date) : null

  const activeFlags = POST_EVENT_FLAGS.filter(f =>
    needed.includes(f.id as PostEventFlag) || done.includes(f.id as PostEventFlag)
  )
  const availableFlags = POST_EVENT_FLAGS.filter(f =>
    !needed.includes(f.id as PostEventFlag) &&
    !done.includes(f.id as PostEventFlag) &&
    !notNeeded.includes(f.id as PostEventFlag)
  )
  const naFlags = POST_EVENT_FLAGS.filter(f => notNeeded.includes(f.id as PostEventFlag))

  const outstandingCount = needed.length
  const allDone = activeFlags.length > 0 && outstandingCount === 0

  async function handleInvoiceDownload() {
    if (!e || !e.fee) return
    setInvoiceDownloading(true)
    try {
      const { generateInvoice } = await import('@/lib/documents')
      const { ensureDraftInvoice, buildInvoiceSnapshot } = await import('@/lib/invoices')
      const { fetchBusinessProfile } = await import('@/lib/business')
      const [inv, business] = await Promise.all([
        ensureDraftInvoice({
          engagementId: e.id,
          type: 'invoice',
          organization: e.organization,
          amount: e.fee,
          snapshot: buildInvoiceSnapshot(e),
        }),
        fetchBusinessProfile(),
      ])
      const blob = await generateInvoice(e, inv.invoice_number, business)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoice-${e.organization.toLowerCase().replace(/\s+/g, '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setInvoiceDownloading(false)
    }
  }

  async function handleEditInvoice() {
    if (!e) return
    const { findLatestInvoice, ensureDraftInvoice, buildInvoiceSnapshot } = await import('@/lib/invoices')
    let inv = await findLatestInvoice(engagementId, 'invoice')
    if (!inv && e.fee) {
      inv = await ensureDraftInvoice({
        engagementId: e.id, type: 'invoice', organization: e.organization,
        amount: e.fee, snapshot: buildInvoiceSnapshot(e),
      })
    }
    if (inv) setEditingInvoice(inv)
  }

  async function handleAddFlag(flagId: PostEventFlag) {
    setPostEventFlagNeeded(engagementId, flagId)
    if (flagId === 'invoice' && e?.fee) {
      const { ensureDraftInvoice, buildInvoiceSnapshot } = await import('@/lib/invoices')
      await ensureDraftInvoice({
        engagementId: e.id,
        type: 'invoice',
        organization: e.organization,
        amount: e.fee,
        snapshot: buildInvoiceSnapshot(e),
      })
    }
  }

  async function handleStageClick(flagId: PostEventFlag, stageId: string) {
    if (stageId === '') {
      // rewound all the way back — stay needed but clear stage
      updatePostEventStage(engagementId, { [flagId]: undefined } as any)
      if (done.includes(flagId)) setPostEventFlagNeeded(engagementId, flagId)
      return
    }
    updatePostEventStage(engagementId, { [flagId]: stageId } as Partial<WrapUpFlagStages>)
    if (stageId === FINAL_STAGES[flagId]) {
      setPostEventFlagDone(engagementId, flagId)
    } else {
      if (done.includes(flagId)) setPostEventFlagNeeded(engagementId, flagId)
    }

    // Mirror finalized/sent/paid onto the matching invoices-table row so the central Invoices page agrees
    if (flagId === 'invoice' && (stageId === 'finalized' || stageId === 'sent' || stageId === 'paid')) {
      const { findLatestInvoice, setInvoiceStatus } = await import('@/lib/invoices')
      const inv = await findLatestInvoice(engagementId, 'invoice')
      if (inv) await setInvoiceStatus(inv, stageId)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fade-in">
      <Link href="/wrap-up" className="flex items-center gap-2 text-sm text-ink-400 hover:text-ink mb-6 transition-all">
        <ArrowLeft size={14} /> Back to Wrap-Up
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <FileText size={13} className="text-ink-400" />
          <span className="text-xs text-ink-400 uppercase tracking-widest font-medium">Wrap-Up</span>
        </div>
        <h1 className="font-display text-3xl font-semibold text-ink">{e.event_name || e.organization}</h1>
        <p className="text-ink-400 text-sm mt-1">{e.organization}{e.booker_name ? ` · via ${e.booker_name}` : ''}</p>
        <div className="accent-line mt-3 w-24" />
      </div>

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

      {e.wrap_up_review_needed && (
        <div className="mb-6 flex items-center justify-between gap-3 px-4 py-3 rounded-xl border bg-amber-50 border-amber-200 text-amber-700 text-sm font-medium">
          <span className="flex items-center gap-2"><AlertTriangle size={14} />AI flagged this engagement for review — confirm to move it into the active list.</span>
          <button onClick={() => confirmWrapUpReview(e.id)}
            className="text-xs font-medium text-white bg-ink px-4 py-2 rounded-lg hover:bg-ink-700 transition-all flex-shrink-0">
            Confirm
          </button>
        </div>
      )}

      <div className="bg-white border border-ink-100 rounded-xl mb-6 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-ink-100">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">Wrap-Up Items</p>
          <span className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border ${
            allDone ? 'bg-sage/8 border-sage/20 text-sage'
            : outstandingCount > 0 ? 'bg-amber-50 border-amber-100 text-amber-600'
            : 'bg-parchment border-ink-100 text-ink-400'
          }`}>
            {allDone ? <CheckCircle2 size={11} /> : <Clock size={11} />}
            {allDone ? 'All done' : outstandingCount > 0 ? `${outstandingCount} outstanding` : 'Not yet assessed'}
          </span>
        </div>

        {/* Active chase list */}
        {activeFlags.length > 0 && (
          <div className="px-5 pt-4 pb-3 space-y-2">
            {activeFlags.map(flag => {
              const flagId = flag.id as PostEventFlag
              const isDone = done.includes(flagId)
              const isFollowUp = flagId === 'follow_up'
              const currentStage = (stages as any)[flagId] as string | undefined

              return (
                <div key={flag.id} className={`flex items-start gap-3 px-4 py-3 rounded-xl border transition-all ${
                  isDone ? 'bg-sage/8 border-sage/20' : 'bg-white border-ink-100'
                }`}>
                  <div className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDone ? 'bg-sage' : 'bg-ink-200'}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <p className={`text-sm font-medium ${isDone ? 'text-sage-dark' : 'text-ink'}`}>
                        {flag.label}
                      </p>
                    </div>
                    <StagePills
                      flagId={flagId}
                      currentStage={currentStage}
                      onStageClick={(stageId) => handleStageClick(flagId, stageId)}
                      isDone={isDone}
                    />
                    {isFollowUp && (
                      <div className="mt-2 space-y-1.5">
                        <input
                          type="text"
                          value={e.post_event_follow_up_details ?? ''}
                          onChange={ev => updatePostEventFollowUpDetails(engagementId, ev.target.value)}
                          placeholder="Follow-up details..."
                          className="w-full text-xs bg-parchment/60 border border-ink-100 rounded-lg px-3 py-1.5 text-ink placeholder:text-ink-300 focus:outline-none focus:border-ink-300"
                        />
                        <div className="flex items-center gap-2">
                          <Calendar size={12} className="text-ink-300 flex-shrink-0" />
                          <input
                            type="date"
                            value={e.post_event_follow_up_date ?? ''}
                            onChange={ev => updatePostEventFollowUpDate(engagementId, ev.target.value)}
                            className="text-xs bg-parchment/60 border border-ink-100 rounded-lg px-2.5 py-1.5 text-ink focus:outline-none focus:border-ink-300"
                          />
                          {e.post_event_follow_up_date && (
                            <span className={`text-xs ${isDone ? 'text-ink-300' : isFollowUpOverdue(e.post_event_follow_up_date) ? 'text-red-500 font-medium' : 'text-ink-400'}`}>
                              {formatRelativeDue(e.post_event_follow_up_date)}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-2 flex items-start gap-1.5">
                      <StickyNote size={12} className="text-ink-200 mt-1.5 flex-shrink-0" />
                      <input
                        type="text"
                        value={e.post_event_item_notes?.[flagId] ?? ''}
                        onChange={ev => updatePostEventItemNote(engagementId, flagId, ev.target.value)}
                        placeholder="Add a note..."
                        className="w-full text-xs bg-transparent border-b border-transparent hover:border-ink-100 focus:border-ink-200 px-1 py-1 text-ink-500 placeholder:text-ink-300 focus:outline-none transition-colors"
                      />
                    </div>

                    {flagId === 'invoice' && (
                      <div className="mt-2.5 pt-2.5 border-t border-dashed border-ink-100 space-y-2">
                        {(() => {
                          const contact = primaryContact(e)
                          const gaps: string[] = []
                          if (!e.fee) gaps.push('speaking fee')
                          if (!contact?.first_name && !contact?.last_name) gaps.push('primary contact name')
                          if (!contact?.email) gaps.push('contact email')
                          if (!e.event_date) gaps.push('event date')
                          if (!e.event_name && !e.topic) gaps.push('event name or topic')
                          if (gaps.length === 0) return null
                          return (
                            <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
                              <AlertTriangle size={10} className="text-amber-500 flex-shrink-0 mt-0.5" />
                              <p className="text-[10px] text-amber-700 leading-relaxed">
                                <span className="font-semibold">Invoice will have blanks:</span>{' '}
                                {gaps.join(', ')}
                              </p>
                            </div>
                          )
                        })()}
                        {e.fee ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleInvoiceDownload}
                              disabled={invoiceDownloading}
                              className="flex items-center gap-1.5 text-xs font-medium text-gold hover:text-gold-dark border border-gold/30 hover:border-gold/60 rounded-lg px-3 py-1.5 transition-all disabled:opacity-50"
                            >
                              <Download size={11} />
                              {invoiceDownloading ? 'Generating…' : 'Download Invoice'}
                            </button>
                            <button
                              onClick={handleEditInvoice}
                              className="text-xs font-medium text-ink-400 hover:text-ink border border-ink-100 hover:border-ink-300 rounded-lg px-3 py-1.5 transition-all"
                            >
                              Edit Details
                            </button>
                          </div>
                        ) : (
                          <p className="text-[10px] text-ink-300 italic">Set a speaking fee to enable invoice generation.</p>
                        )}
                      </div>
                    )}

                    {flagId === 'testimonial' && (
                      <div className="mt-2.5 pt-2.5 border-t border-dashed border-ink-100 space-y-1.5">
                        <input
                          type="url"
                          value={e.post_event_testimonial_link ?? ''}
                          onChange={ev => updatePostEventTestimonialLink(engagementId, ev.target.value)}
                          placeholder="Link to testimonial (video, review, etc.)..."
                          className="w-full text-xs bg-parchment/60 border border-ink-100 rounded-lg px-3 py-1.5 text-ink placeholder:text-ink-300 focus:outline-none focus:border-ink-300"
                        />
                        <textarea
                          value={e.post_event_testimonial_text ?? ''}
                          onChange={ev => updatePostEventTestimonialText(engagementId, ev.target.value)}
                          placeholder="Or paste the testimonial text..."
                          rows={2}
                          className="w-full text-xs bg-parchment/60 border border-ink-100 rounded-lg px-3 py-1.5 text-ink placeholder:text-ink-300 focus:outline-none focus:border-ink-300 resize-none"
                        />
                      </div>
                    )}

                    {flagId === 'media' && (
                      <div className="mt-2.5 pt-2.5 border-t border-dashed border-ink-100">
                        {(e.post_event_media ?? []).length > 0 && (
                          <div className="space-y-1.5 mb-2">
                            {(e.post_event_media ?? []).map(m => {
                              const Icon = MEDIA_TYPE_ICONS[m.type] ?? Link2
                              return (
                                <div key={m.id} className="flex items-start gap-2 text-xs bg-parchment/50 border border-ink-100 rounded-lg px-2.5 py-1.5">
                                  <Icon size={12} className="text-ink-300 flex-shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-ink-500 hover:text-ink hover:underline truncate block">
                                      {m.name}
                                    </a>
                                    <input
                                      type="text"
                                      value={m.description ?? ''}
                                      onChange={ev => updatePostEventMediaDescription(engagementId, m.id, ev.target.value)}
                                      placeholder="Add description..."
                                      className="mt-0.5 w-full text-[11px] bg-transparent text-ink-400 placeholder:text-ink-200 focus:outline-none"
                                    />
                                  </div>
                                  <button
                                    onClick={() => removePostEventMedia(engagementId, m.id)}
                                    className="text-ink-200 hover:text-ink-400 transition-colors flex-shrink-0 mt-0.5"
                                    title="Remove"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-1.5">
                          <label className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-ink-100 bg-white hover:border-ink-200 cursor-pointer transition-all ${mediaUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                            {mediaUploading ? (
                              <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                              </svg>
                            ) : (
                              <UploadCloud size={12} className="text-ink-300" />
                            )}
                            <span className="text-ink-400">{mediaUploading ? 'Uploading...' : 'Upload photos'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              disabled={mediaUploading}
                              onChange={async (ev: React.ChangeEvent<HTMLInputElement>) => {
                                const files = Array.from(ev.target.files ?? [])
                                if (files.length === 0) return
                                setMediaUploading(true)
                                try {
                                  const { supabase } = await import('@/lib/supabase')
                                  for (const file of files) {
                                    const path = `${engagementId}/wrapup/${Date.now()}-${file.name}`
                                    const { data, error } = await supabase.storage
                                      .from('materials')
                                      .upload(path, file, { contentType: file.type })
                                    if (!error && data) {
                                      const { data: { publicUrl } } = supabase.storage.from('materials').getPublicUrl(data.path)
                                      addPostEventMedia(engagementId, { type: 'photo', name: file.name, url: publicUrl })
                                    }
                                  }
                                } finally {
                                  setMediaUploading(false)
                                  ev.target.value = ''
                                }
                              }}
                            />
                          </label>

                          <button
                            onClick={() => { setAddingMediaType('video'); setLinkUrl(''); setLinkDescription('') }}
                            className="flex items-center gap-1.5 text-xs font-medium text-ink-400 hover:text-ink bg-white border border-ink-100 hover:border-ink-200 px-2.5 py-1.5 rounded-lg transition-all"
                          >
                            <Film size={12} className="text-ink-300" />Link video
                          </button>
                          <button
                            onClick={() => { setAddingMediaType('audio'); setLinkUrl(''); setLinkDescription('') }}
                            className="flex items-center gap-1.5 text-xs font-medium text-ink-400 hover:text-ink bg-white border border-ink-100 hover:border-ink-200 px-2.5 py-1.5 rounded-lg transition-all"
                          >
                            <Music size={12} className="text-ink-300" />Link audio
                          </button>
                          <button
                            onClick={() => { setAddingMediaType('link'); setLinkUrl(''); setLinkDescription('') }}
                            className="flex items-center gap-1.5 text-xs font-medium text-ink-400 hover:text-ink bg-white border border-ink-100 hover:border-ink-200 px-2.5 py-1.5 rounded-lg transition-all"
                          >
                            <Link2 size={12} className="text-ink-300" />Addtl links
                          </button>
                        </div>

                        {addingMediaType && (
                          <div className="mt-2 flex flex-col gap-1.5 bg-parchment/30 border border-ink-100 rounded-lg p-2">
                            <input
                              type="url"
                              autoFocus
                              value={linkUrl}
                              onChange={ev => setLinkUrl(ev.target.value)}
                              placeholder="Paste a link..."
                              className="w-full text-xs bg-white border border-ink-100 rounded-lg px-2.5 py-1.5 text-ink placeholder:text-ink-300 focus:outline-none focus:border-ink-200"
                            />
                            <input
                              type="text"
                              value={linkDescription}
                              onChange={ev => setLinkDescription(ev.target.value)}
                              placeholder="Description (optional)..."
                              className="w-full text-xs bg-white border border-ink-100 rounded-lg px-2.5 py-1.5 text-ink placeholder:text-ink-300 focus:outline-none focus:border-ink-200"
                            />
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setAddingMediaType(null)}
                                className="text-xs font-medium text-ink-300 hover:text-ink-500 px-2.5 py-1.5 rounded-lg transition-all"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => {
                                  const url = linkUrl.trim()
                                  if (!url) return
                                  addPostEventMedia(engagementId, {
                                    type: addingMediaType,
                                    name: mediaDefaultName(addingMediaType, url),
                                    url,
                                    description: linkDescription.trim() || undefined,
                                  })
                                  setAddingMediaType(null)
                                  setLinkUrl('')
                                  setLinkDescription('')
                                }}
                                className="text-xs font-medium text-white bg-ink px-2.5 py-1.5 rounded-lg hover:bg-ink-700 transition-all"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      resetPostEventFlag(engagementId, flagId)
                      updatePostEventStage(engagementId, { [flagId]: undefined } as any)
                    }}
                    className="text-ink-200 hover:text-ink-400 transition-colors mt-0.5 flex-shrink-0"
                    title="Remove"
                  >
                    <X size={13} />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {activeFlags.length === 0 && (
          <div className="px-5 py-4">
            <p className="text-sm text-ink-300 italic">No items added yet — add from the list below.</p>
          </div>
        )}

        {/* Available to add */}
        {(availableFlags.length > 0 || naFlags.length > 0) && (
          <>
            <div className="mx-5 border-t border-dashed border-ink-100 my-1" />
            <div className="px-5 pt-3 pb-4">
              <p className="text-[10px] font-medium text-ink-300 uppercase tracking-wider mb-3">Available</p>
              <div className="grid grid-cols-3 gap-2">
                {availableFlags.map(flag => (
                  <div key={flag.id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-ink-100 bg-parchment/30">
                    <span className="text-sm text-ink-400 font-medium">{flag.label}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleAddFlag(flag.id as PostEventFlag)}
                        className="flex items-center gap-1 text-[11px] font-medium text-ink-400 hover:text-ink bg-white border border-ink-100 hover:border-ink-200 px-2 py-1 rounded-md transition-all"
                      >
                        <Plus size={10} />Add
                      </button>
                      <button
                        onClick={() => setPostEventFlagNotNeeded(engagementId, flag.id as PostEventFlag)}
                        className="text-[11px] font-medium text-ink-300 hover:text-ink-500 px-2 py-1 rounded-md hover:bg-parchment transition-all"
                      >
                        N/A
                      </button>
                    </div>
                  </div>
                ))}
                {naFlags.map(flag => (
                  <div key={flag.id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-ink-100/50 bg-parchment/20 opacity-50">
                    <span className="text-sm text-ink-300 font-medium line-through">{flag.label}</span>
                    <button
                      onClick={() => resetPostEventFlag(engagementId, flag.id as PostEventFlag)}
                      className="text-[11px] font-medium text-ink-300 hover:text-ink-500 px-2 py-1 rounded-md hover:bg-parchment transition-all flex-shrink-0"
                    >
                      Undo
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Notes */}
        <div className="px-5 pb-5 border-t border-ink-100">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400 mb-2 mt-4">Notes</p>
          <textarea
            value={e.post_event_notes ?? ''}
            onChange={ev => updatePostEventNotes(engagementId, ev.target.value)}
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
                  {done.includes('invoice') ? '· Paid' : needed.includes('invoice') ? '· Invoice in progress' : '· Invoice pending'}
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
      <WrapUpTimelinePanel engagementId={e.id} comms={e.comms} />

      {/* Engagement stage history — always shown */}
      <WrapUpSnapshotPanel label="Engagement Stage History" snapshot={e.engagement_snapshot ?? {
        event_name: e.event_name,
        event_date: e.event_date,
        event_city: e.event_city,
        fee: e.fee,
        event_format: e.event_format,
        audience_size: e.audience_size,
        topic: e.topic,
        hotel_name: e.hotel_name,
        contract_required: e.contract_required,
        contract_signed_at: (e as any).contract_signed_at,
        confirmed_at: (e as any).confirmed_at,
      }} />

      {/* Prospect background — always shown */}
      <WrapUpSnapshotPanel label="Prospect Background" snapshot={e.prospect_snapshot ?? {
        prospect_step: e.prospect_step,
        source: e.source,
        notes: e.notes,
        event_date: e.event_date,
        event_city: e.event_city,
        fee: e.fee,
        audience_size: e.audience_size,
      }} />

      {/* Archive */}
      <div className="mt-6 flex items-center justify-between gap-3 px-5 py-4 bg-white border border-ink-100 rounded-xl">
        <div>
          <p className="text-sm font-medium text-ink">Archive this engagement</p>
          <p className="text-xs text-ink-400 mt-0.5">
            {allDone
              ? 'All wrap-up items are complete — archiving moves it out of the active list.'
              : `${outstandingCount} item${outstandingCount === 1 ? '' : 's'} still outstanding.`}
          </p>
        </div>
        <button
          onClick={() => setArchiveModalOpen(true)}
          className={`flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg transition-all flex-shrink-0 ${
            allDone
              ? 'text-white bg-ink hover:bg-ink-700'
              : 'text-ink-400 hover:text-ink border border-ink-100 hover:bg-parchment'
          }`}>
          <FolderArchive size={13} /> {allDone ? 'Archive' : 'Archive Anyway'}
        </button>
      </div>

      {/* Delete */}
      <div className="mt-3 flex items-center justify-between gap-3 px-5 py-4 bg-red-50/40 border border-red-100 rounded-xl">
        <div>
          <p className="text-sm font-medium text-red-600">Delete this engagement</p>
          <p className="text-xs text-red-400 mt-0.5">Permanently removes all data for this engagement. This cannot be undone.</p>
        </div>
        <button
          onClick={() => setDeleteModalOpen(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-red-600 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50 transition-all flex-shrink-0">
          <Trash2 size={13} /> Delete
        </button>
      </div>

      <ArchiveModal
        open={archiveModalOpen}
        engagement={e}
        onConfirm={reason => { archiveEngagement(e.id, reason); router.push('/archive') }}
        onCancel={() => setArchiveModalOpen(false)}
      />

      <ConfirmModal
        open={deleteModalOpen}
        title="Delete permanently?"
        description={`This will permanently delete "${e.organization}" and all associated contacts, calls, and communications. This cannot be undone.`}
        confirmLabel="Delete"
        requireText="DELETE"
        danger
        onConfirm={() => { deleteEngagement(e.id); startTransition(() => router.push('/wrap-up')) }}
        onCancel={() => setDeleteModalOpen(false)}
      />

      {editingInvoice && (
        <InvoiceEditModal
          invoice={editingInvoice}
          onClose={() => setEditingInvoice(null)}
          onSaved={() => setEditingInvoice(null)}
        />
      )}
    </div>
  )
}