'use client'
import React from 'react'
import { useParams } from 'next/navigation'
import { useState, useCallback, useEffect, useRef } from 'react'
import { useStore } from '@/lib/store'
import {
  Engagement, primaryContact, DEFAULT_OUTGOING_MATERIALS, OutgoingMaterial, IncomingMaterial
} from '@/types'
import { formatDate, formatCurrency, getInitials } from '@/lib/utils'
import {
  ArrowLeft, Calendar, MapPin, Users, AlertTriangle, CheckCircle2, Circle,
  Download, FileText, Mic, Radio, Newspaper,
  Clock, Wifi, Hotel, Plane, ExternalLink,
  Pencil, Check, X, Plus, Trash2, GripVertical, ChevronDown,
  FileCheck, Upload, Pin, PinOff, ArrowDown
} from 'lucide-react'
import Link from 'next/link'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MEDIA_TYPES = ['podcast', 'interview', 'panel', 'livestream']

function eventTypeIcon(type: string) {
  const cls = 'text-ink-300'
  if (type === 'podcast')    return <Mic size={14} className={cls} />
  if (type === 'interview')  return <Newspaper size={14} className={cls} />
  if (type === 'panel')      return <Users size={14} className={cls} />
  if (type === 'livestream') return <Radio size={14} className={cls} />
  return <FileText size={14} className={cls} />
}

function eventTypeLabel(type: string) {
  const map: Record<string, string> = {
    speaking: 'Speaking Engagement', podcast: 'Podcast', interview: 'Interview',
    panel: 'Panel', livestream: 'Livestream',
  }
  return map[type] || 'Engagement'
}

// ─── Inline edit primitives ───────────────────────────────────────────────────

function EditableField({
  label, value, placeholder, onSave, multiline, link
}: {
  label: string
  value?: string | null
  placeholder?: string
  onSave: (v: string) => void
  multiline?: boolean
  link?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value || '')

  function commit() { onSave(draft); setEditing(false) }
  function cancel() { setDraft(value || ''); setEditing(false) }
  const displayPlaceholder = placeholder || `Add ${label.toLowerCase()}…`

  return (
    <div className="group flex flex-col gap-1.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-300">{label}</p>
      {editing ? (
        <div className="flex items-start gap-2">
          {multiline ? (
            <textarea autoFocus value={draft}
              onChange={(ev: React.ChangeEvent<HTMLTextAreaElement>) => setDraft(ev.target.value)}
              rows={3}
              className="flex-1 text-sm text-ink bg-parchment border border-gold/40 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gold resize-none" />
          ) : (
            <input autoFocus value={draft}
              onChange={(ev: React.ChangeEvent<HTMLInputElement>) => setDraft(ev.target.value)}
              onKeyDown={(ev: React.KeyboardEvent<HTMLInputElement>) => { if (ev.key === 'Enter') commit(); if (ev.key === 'Escape') cancel() }}
              className="flex-1 text-sm text-ink bg-parchment border border-gold/40 rounded-lg px-2.5 py-1 focus:outline-none focus:border-gold" />
          )}
          <button onClick={commit} className="p-1 text-sage hover:text-sage-dark mt-0.5 flex-shrink-0"><Check size={13} /></button>
          <button onClick={cancel} className="p-1 text-ink-300 hover:text-ink mt-0.5 flex-shrink-0"><X size={13} /></button>
        </div>
      ) : (
        <button onClick={() => { setDraft(value || ''); setEditing(true) }} className="text-left">
          {value ? (
            link ? (
              <span className="text-sm font-semibold text-gold hover:text-gold-dark inline-flex items-center gap-1">
                {value} <ExternalLink size={10} />
              </span>
            ) : (
              <span className="text-sm text-ink leading-snug group-hover:underline decoration-dashed decoration-ink-200 underline-offset-2">{value}</span>
            )
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-300 border border-dashed border-ink-200 rounded px-2 py-0.5 hover:border-gold/40 hover:text-gold/70 transition-colors">
              <Plus size={9} className="flex-shrink-0" />{displayPlaceholder}
            </span>
          )}
        </button>
      )}
    </div>
  )
}

function BDivider() { return <div className="border-t border-ink-100 my-5" /> }

function BSectionHeader({ children, onRemove }: { children: React.ReactNode; onRemove?: () => void }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="h-px flex-1 bg-gold/25" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-gold">{children}</span>
      <div className="h-px flex-1 bg-gold/25" />
      {onRemove && (
        <button onClick={onRemove} className="text-ink-200 hover:text-red-400 transition-colors flex-shrink-0"><X size={12} /></button>
      )}
    </div>
  )
}

function BTwoCol({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-8 gap-y-5">{children}</div>
}

// ─── Progress helpers ──────────────────────────────────────────────────────────

function getDefaultOutgoing(existing?: OutgoingMaterial[]): OutgoingMaterial[] {
  if (existing && existing.length > 0) return existing
  return DEFAULT_OUTGOING_MATERIALS.map(m => ({ ...m, done: false }))
}

function useProgressState(e: Engagement, save: (p: Partial<Engagement>) => void) {
  const outgoing = getDefaultOutgoing(e.outgoing_materials)
  const incoming: IncomingMaterial[] = e.incoming_materials ?? []
  const contractRequired = e.contract_required
  const contractSent = e.engagement_flags?.includes('contract_sent') ?? false
  const contractSigned = e.engagement_flags?.includes('contract_signed') ?? false
  const outgoingDone = outgoing.filter(m => m.done).length
  const incomingDone = incoming.filter(m => m.received).length

  const contractComplete = contractRequired === false || (contractRequired === true && contractSent && contractSigned)
  const outgoingComplete = outgoingDone === outgoing.length
  const incomingComplete = incoming.length > 0 && incomingDone === incoming.length
  const briefingComplete = !!e.briefing_complete

  function toggleOutgoing(id: string) {
    save({ outgoing_materials: outgoing.map(m => m.id === id ? { ...m, done: !m.done } : m) })
  }
  function removeCustomOutgoing(id: string) {
    save({ outgoing_materials: outgoing.filter(m => m.id !== id) })
  }
  function addCustomOutgoing(label: string) {
    save({ outgoing_materials: [...outgoing, { id: `custom_${Date.now()}`, label, done: false, custom: true }] })
  }
  function addIncoming(label: string, requested_at?: string) {
    save({ incoming_materials: [...incoming, { id: `in_${Date.now()}`, label, received: false, requested_at }] })
  }
  function toggleIncoming(id: string) {
    save({ incoming_materials: incoming.map(m => m.id === id ? { ...m, received: !m.received } : m) })
  }
  function toggleIncomingPin(id: string) {
    save({ incoming_materials: incoming.map(m => m.id === id ? { ...m, pinned_to_briefing: !m.pinned_to_briefing } : m) })
  }
  function removeIncoming(id: string) {
    save({ incoming_materials: incoming.filter(m => m.id !== id) })
  }
  function toggleContractFlag(flag: 'contract_sent' | 'contract_signed') {
    const current = e.engagement_flags ?? []
    save({ engagement_flags: (current.includes(flag) ? current.filter(f => f !== flag) : [...current, flag]) as any })
  }

  return {
    outgoing, incoming, contractRequired, contractSent, contractSigned,
    outgoingDone, incomingDone,
    contractComplete, outgoingComplete, incomingComplete, briefingComplete,
    toggleOutgoing, removeCustomOutgoing, addCustomOutgoing,
    addIncoming, toggleIncoming, toggleIncomingPin, removeIncoming, toggleContractFlag,
  }
}

// ─── Progress Bar (compact summary) ───────────────────────────────────────────

function ProgressBar({ e, save }: { e: Engagement; save: (p: Partial<Engagement>) => void }) {
  const { contractComplete, outgoingComplete, incomingComplete, briefingComplete, outgoing, outgoingDone, contractSent, contractSigned, contractRequired } = useProgressState(e, save)
  const incoming = e.incoming_materials ?? []
  const incomingCount = incoming.filter(m => m.received).length

  // Contract renders as 1 or 2 pills depending on state
  const contractNA = contractRequired === false

  const pill = (done: boolean, label: string, sub?: string) => (
    <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium flex-shrink-0 ${done ? 'bg-sage/8 border-sage/20 text-sage' : 'bg-parchment border-ink-100 text-ink-400'}`}>
      {done ? <CheckCircle2 size={13} className="flex-shrink-0" /> : <Circle size={13} className="text-ink-200 flex-shrink-0" />}
      {label}
      {sub && <span className="text-[11px] text-ink-300 ml-0.5">{sub}</span>}
    </div>
  )

  const dot = <span className="text-ink-200 text-sm flex-shrink-0">·</span>

  return (
    <div className="bg-white border border-ink-100 rounded-xl p-5 mb-6">
      <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Progress</p>

      {/* Contract decision prompt — only when unresolved */}
      {contractRequired === undefined && (
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-ink-50">
          <span className="text-xs text-ink-400">Contract status not yet set</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => save({ contract_required: true, engagement_flags: [...(e.engagement_flags ?? []).filter(f => f !== 'contract_sent' && f !== 'contract_signed'), 'contract_sent'] as any })}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-ink-200 bg-parchment text-ink-500 hover:border-gold/50 hover:text-ink transition-all">
              Required
            </button>
            <button
              onClick={() => save({ contract_required: false })}
              className="text-xs px-3 py-1.5 rounded-lg border border-ink-100 bg-parchment text-ink-400 hover:border-ink-300 hover:text-ink transition-all">
              Not Required
            </button>
          </div>
        </div>
      )}

      {/* Pill row — centered */}
      <div className="flex items-center justify-center gap-3 flex-wrap">

        {/* Contract N/A */}
        {contractRequired === false && (
          <>
            <div className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-ink-100 bg-parchment text-sm font-medium text-ink-300 flex-shrink-0">
              <CheckCircle2 size={13} className="text-ink-200 flex-shrink-0" />
              No Contract
              <button onClick={() => save({ contract_required: undefined })} className="text-ink-200 hover:text-ink-400 ml-1 transition-colors"><X size={9} /></button>
            </div>
            {dot}
          </>
        )}

        {/* Contract Sent + Signed */}
        {contractRequired === true && (
          <>
            {pill(contractSent, 'Contract Sent')}
            <span className="text-ink-300 text-xs flex-shrink-0">→</span>
            {pill(contractSigned, 'Contract Signed')}
            {dot}
          </>
        )}

        {pill(outgoingComplete, 'Prep Materials Sent', outgoingComplete ? undefined : `${outgoingDone}/${outgoing.length}`)}
        {dot}
        {pill(incomingComplete, 'Awaiting Client Materials', incoming.length > 0 && !incomingComplete ? `${incomingCount}/${incoming.length}` : undefined)}

      </div>

      {/* Briefing — terminal */}
      <div className="border-t border-ink-100 mt-4 pt-3 flex justify-center">
        <div className={`flex items-center gap-2 px-5 py-2.5 rounded-lg border text-sm font-semibold ${briefingComplete ? 'bg-sage/8 border-sage/20 text-sage' : 'bg-parchment border-ink-100 text-ink-400'}`}>
          {briefingComplete ? <CheckCircle2 size={13} className="flex-shrink-0" /> : <Circle size={13} className="text-ink-200 flex-shrink-0" />}
          Briefing Document Complete
        </div>
      </div>

    </div>
  )
}

// ─── Progress Detail// ─── Progress Detail (full working area, below event details) ─────────────────

function ProgressDetail({ e, save }: { e: Engagement; save: (p: Partial<Engagement>) => void }) {
  const [newIncomingLabel, setNewIncomingLabel] = useState('')
  const [addingCustom, setAddingCustom] = useState(false)
  const [customLabel, setCustomLabel] = useState('')

  const {
    outgoing, incoming, contractRequired, contractSent, contractSigned,
    outgoingDone, incomingDone,
    toggleOutgoing, removeCustomOutgoing, addCustomOutgoing,
    addIncoming, toggleIncoming, toggleIncomingPin, removeIncoming, toggleContractFlag,
  } = useProgressState(e, save)

  function handleAddIncoming() {
    if (!newIncomingLabel.trim()) return
    addIncoming(newIncomingLabel.trim(), new Date().toISOString().split('T')[0])
    setNewIncomingLabel('')
  }

  function handleAddCustom() {
    if (!customLabel.trim()) return
    addCustomOutgoing(customLabel.trim())
    setCustomLabel('')
    setAddingCustom(false)
  }

  return (
    <div className="space-y-4 mb-6">

      {/* ── Contract ── */}
      <div className="bg-white border border-ink-100 rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium">Contract</p>
          {contractRequired === true && (
            <button onClick={() => save({ contract_required: undefined, engagement_flags: (e.engagement_flags ?? []).filter(f => f !== 'contract_sent' && f !== 'contract_signed') as any })}
              className="text-[11px] text-ink-200 hover:text-ink-400">reset</button>
          )}
          {contractRequired === false && (
            <button onClick={() => save({ contract_required: undefined })} className="text-ink-200 hover:text-ink-400"><X size={11} /></button>
          )}
        </div>

        {contractRequired === undefined && (
          <div className="flex gap-3 mt-3">
            <button onClick={() => save({ contract_required: true, engagement_flags: [...(e.engagement_flags ?? []).filter(f => f !== 'contract_sent' && f !== 'contract_signed'), 'contract_sent'] as any })}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-ink-100 bg-parchment text-sm font-medium text-ink-400 hover:border-ink-300 transition-all">
              <Circle size={14} className="flex-shrink-0" /> Contract Sent
            </button>
            <button onClick={() => save({ contract_required: false })}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-ink-100 bg-parchment text-sm font-medium text-ink-300 hover:border-ink-300 transition-all italic">
              No Contract Needed
            </button>
          </div>
        )}

        {contractRequired === false && (
          <p className="text-xs text-ink-300 italic mt-2">No contract needed for this engagement.</p>
        )}

        {contractRequired === true && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            {[{ flag: 'contract_sent' as const, label: 'Contract Sent' }, { flag: 'contract_signed' as const, label: 'Contract Signed' }].map(({ flag, label }) => {
              const done = e.engagement_flags?.includes(flag) ?? false
              const isSignedAndSentNotDone = flag === 'contract_signed' && !(e.engagement_flags?.includes('contract_sent'))
              return (
                <button key={flag} onClick={() => !isSignedAndSentNotDone && toggleContractFlag(flag)}
                  disabled={isSignedAndSentNotDone}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium text-left transition-all ${
                    done ? 'bg-sage/8 border-sage/20 text-sage'
                    : isSignedAndSentNotDone ? 'bg-parchment border-ink-100 text-ink-200 cursor-not-allowed opacity-50'
                    : 'bg-parchment border-ink-100 text-ink-400 hover:border-ink-300 hover:opacity-80 active:scale-95'
                  }`}>
                  {done ? <CheckCircle2 size={14} className="flex-shrink-0" /> : <Circle size={14} className="flex-shrink-0" />}
                  {label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Outgoing Materials ── */}
      <div className="bg-white border border-ink-100 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium">Outgoing Materials</p>
          <span className="text-xs text-ink-300">{outgoingDone} / {outgoing.length}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {outgoing.map(item => (
            <div key={item.id} className="flex items-center gap-1.5 group/item">
              <button onClick={() => toggleOutgoing(item.id)}
                className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium text-left transition-all hover:opacity-80 active:scale-95 ${
                  item.done ? 'bg-sage/8 border-sage/20 text-sage' : 'bg-parchment border-ink-100 text-ink-400 hover:border-ink-300'
                }`}>
                {item.done ? <CheckCircle2 size={13} className="flex-shrink-0" /> : <Circle size={13} className="flex-shrink-0" />}
                <span className="truncate">{item.label}</span>
              </button>
              {item.custom && (
                <button onClick={() => removeCustomOutgoing(item.id)}
                  className="text-ink-200 hover:text-red-400 opacity-0 group-hover/item:opacity-100 transition-all flex-shrink-0">
                  <X size={11} />
                </button>
              )}
            </div>
          ))}
          {addingCustom ? (
            <div className="flex items-center gap-1.5 col-span-2">
              <input autoFocus value={customLabel}
                onChange={(ev: React.ChangeEvent<HTMLInputElement>) => setCustomLabel(ev.target.value)}
                onKeyDown={(ev: React.KeyboardEvent<HTMLInputElement>) => { if (ev.key === 'Enter') handleAddCustom(); if (ev.key === 'Escape') { setAddingCustom(false); setCustomLabel('') } }}
                placeholder="Item label…"
                className="flex-1 text-sm text-ink bg-parchment border border-gold/40 rounded-lg px-3 py-2 focus:outline-none focus:border-gold" />
              <button onClick={handleAddCustom} className="p-1.5 text-sage hover:text-sage-dark"><Check size={13} /></button>
              <button onClick={() => { setAddingCustom(false); setCustomLabel('') }} className="p-1.5 text-ink-300 hover:text-ink"><X size={13} /></button>
            </div>
          ) : (
            <button onClick={() => setAddingCustom(true)}
              className="flex items-center gap-1.5 text-xs text-ink-300 hover:text-gold transition-colors border border-dashed border-ink-200 hover:border-gold/40 rounded-lg px-3 py-2 font-medium">
              <Plus size={11} /> Add item
            </button>
          )}
        </div>
      </div>

      {/* ── Awaiting Client Materials ── */}
      <div className="bg-white border border-ink-100 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium">Awaiting Client Materials</p>
          {incoming.length > 0 && <span className="text-xs text-ink-300">{incomingDone} / {incoming.length} received</span>}
        </div>
        {incoming.length === 0 && (
          <p className="text-xs text-ink-300 italic mb-3">Nothing requested yet — log anything you're waiting on from the client.</p>
        )}
        {incoming.length > 0 && (
          <div className="space-y-2 mb-3">
            {incoming.map(item => (
              <div key={item.id} className="flex items-start gap-2 group/in">
                <button onClick={() => toggleIncoming(item.id)}
                  className={`flex-1 flex items-start gap-2 px-3 py-2 rounded-lg border text-sm font-medium text-left transition-all ${
                    item.received ? 'bg-sage/8 border-sage/20 text-sage' : 'bg-parchment border-ink-100 text-ink-400 hover:border-ink-300'
                  }`}>
                  {item.received ? <CheckCircle2 size={13} className="flex-shrink-0 mt-0.5" /> : <Circle size={13} className="flex-shrink-0 mt-0.5" />}
                  <div className="min-w-0">
                    <span className="truncate block">{item.label}</span>
                    {item.requested_at && (
                      <span className="text-[10px] opacity-60 font-normal">Requested {formatDate(item.requested_at)}</span>
                    )}
                  </div>
                  {item.pinned_to_briefing && (
                    <span className="text-[10px] text-gold bg-gold/10 px-1.5 py-0.5 rounded font-medium flex-shrink-0 ml-auto">Briefing</span>
                  )}
                </button>
                <button onClick={() => toggleIncomingPin(item.id)}
                  className={`transition-colors flex-shrink-0 mt-2 ${item.pinned_to_briefing ? 'text-gold' : 'text-ink-200 hover:text-gold opacity-0 group-hover/in:opacity-100'}`}>
                  <Pin size={12} />
                </button>
                <button onClick={() => removeIncoming(item.id)}
                  className="text-ink-200 hover:text-red-400 opacity-0 group-hover/in:opacity-100 transition-all flex-shrink-0 mt-2">
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input value={newIncomingLabel}
            onChange={(ev: React.ChangeEvent<HTMLInputElement>) => setNewIncomingLabel(ev.target.value)}
            onKeyDown={(ev: React.KeyboardEvent<HTMLInputElement>) => { if (ev.key === 'Enter') handleAddIncoming() }}
            placeholder="What are you waiting on from them?"
            className="flex-1 text-sm text-ink bg-parchment border border-ink-100 rounded-lg px-3 py-2 focus:outline-none focus:border-gold/50 placeholder:text-ink-200" />
          <button onClick={handleAddIncoming}
            className="text-xs font-medium text-ink-300 hover:text-gold border border-dashed border-ink-200 hover:border-gold/40 rounded-lg px-3 py-2 transition-colors flex-shrink-0">
            Add
          </button>
        </div>
      </div>

      {/* ── Briefing Document ── */}
      <div className="bg-white border border-ink-100 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium">Briefing Document</p>
          <a href="#briefing" className="flex items-center gap-1.5 text-xs font-medium text-ink-300 hover:text-gold transition-colors">
            <ArrowDown size={11} /> Jump to briefing
          </a>
        </div>
        {e.briefing_complete ? (
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2 text-sm text-sage font-medium">
              <CheckCircle2 size={14} />
              Ready{e.briefing_complete_at ? ` · ${formatDate(e.briefing_complete_at)}` : ''}
            </div>
            <button onClick={() => save({ briefing_complete: false, briefing_complete_at: undefined } as any)}
              className="text-xs text-ink-200 hover:text-ink-400 transition-colors">
              Mark incomplete
            </button>
          </div>
        ) : (
          <p className="text-xs text-ink-300 italic mt-2">Fill in the briefing document below, then mark it ready.</p>
        )}
      </div>

    </div>
  )
}

// ─── Floating Briefing CTA ─────────────────────────────────────────────────────

function FloatingBriefingButton({ e, save }: { e: Engagement; save: (p: Partial<Engagement>) => void }) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 300)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (e.briefing_complete) return null

  return (
    <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
      <button
        onClick={() => save({ briefing_complete: true, briefing_complete_at: new Date().toISOString() } as any)}
        className="flex items-center gap-2 bg-ink text-cream text-sm font-semibold px-5 py-3 rounded-full shadow-xl hover:bg-ink-800 active:scale-95 transition-all border border-ink-700">
        <FileCheck size={15} />
        Mark Briefing Complete
      </button>
    </div>
  )
}

// ─── Section types ────────────────────────────────────────────────────────────

type SectionKey = 'header' | 'contact' | 'details' | 'venue' | 'travel' | 'runofshow' | 'prepnotes'

const ALL_SECTIONS: { key: SectionKey; label: string; always?: boolean }[] = [
  { key: 'header',     label: 'Event / Date / Format', always: true },
  { key: 'contact',    label: 'Primary Contact',        always: true },
  { key: 'details',    label: 'Event Details',          always: true },
  { key: 'venue',      label: 'Venue' },
  { key: 'travel',     label: 'Travel Details' },
  { key: 'runofshow',  label: 'Run of Show' },
  { key: 'prepnotes',  label: 'Prep Notes',             always: true },
]

function getDefaultSections(e: Engagement): SectionKey[] {
  const hasPhysical = e.event_format === 'in_person' || e.event_format === 'hybrid'
  const hasTravel = (e as any).flight_details || (e as any).hotel_name || (e as any).drive_time
  const hasRos = (e as any).run_of_show?.length > 0
  const base: SectionKey[] = ['header', 'contact', 'details', 'prepnotes']
  if (hasPhysical) base.splice(3, 0, 'venue')
  if (hasTravel || hasPhysical) base.splice(-1, 0, 'travel')
  if (hasRos) base.splice(-1, 0, 'runofshow')
  return base
}

// ─── Briefing sub-sections ────────────────────────────────────────────────────

function SectionHeader({ e, save }: { e: Engagement; save: (p: Partial<Engagement>) => void }) {
  const hasPhysical = e.event_format === 'in_person' || e.event_format === 'hybrid'
  const isVirtual = !hasPhysical
  const eventType = (e as any).event_type || 'speaking'
  const formatStr = hasPhysical
    ? `In-Person${e.event_city ? ` — ${e.event_city}` : ''}`
    : 'Virtual'

  return (
    <div className="space-y-4">
      <BTwoCol>
        <EditableField label="Event" value={e.event_name || e.organization} onSave={v => save({ event_name: v })} />
        <EditableField label="Date / Time"
          value={[formatDate(e.event_date), e.event_time].filter(Boolean).join(' | ')}
          placeholder="Date and time" onSave={v => save({ event_time: v })} />
      </BTwoCol>
      <EditableField label="Format" value={`${eventTypeLabel(eventType)} — ${formatStr}`}
        placeholder="Format and location" onSave={v => save({ event_city: v })} />

      {isVirtual && (
        <div className="bg-gold/6 border border-gold/20 rounded-xl px-4 py-3 space-y-3">
          <EditableField label="Join Link" value={(e as any).join_link} placeholder="Join link"
            onSave={v => save({ join_link: v } as any)} />
          <BTwoCol>
            <EditableField label="Backup Dial-In" value={(e as any).dial_in_backup} placeholder="Backup dial-in number"
              onSave={v => save({ dial_in_backup: v } as any)} />
            <EditableField label="Green Room Opens" value={(e as any).green_room_time} placeholder="Green room time"
              onSave={v => save({ green_room_time: v } as any)} />
          </BTwoCol>
          <EditableField label="Go Live" value={(e as any).go_live_time} placeholder="Go live time"
            onSave={v => save({ go_live_time: v } as any)} />
        </div>
      )}
      {hasPhysical && (
        <BTwoCol>
          <EditableField label="Green Room / Load-In" value={(e as any).green_room_time}
            placeholder="Green room / load-in time" onSave={v => save({ green_room_time: v } as any)} />
        </BTwoCol>
      )}
    </div>
  )
}

function SectionContact({ e, save }: { e: Engagement; save: (p: Partial<Engagement>) => void }) {
  const contact = primaryContact(e)
  const fullName = contact ? `${contact.first_name} ${contact.last_name}` : ''
  const nameTitle = contact?.title ? `${fullName}  |  ${contact.title}` : fullName

  return (
    <div className="space-y-5">
      <BSectionHeader>Primary Contact</BSectionHeader>
      <BTwoCol>
        <EditableField label="Name / Title" value={nameTitle} placeholder="Name and title" onSave={() => {}} />
        <div className="space-y-3">
          <EditableField label="Cell" value={contact?.phone} placeholder="Cell number" onSave={() => {}} />
          <EditableField label="Email" value={contact?.email} placeholder="Email address" onSave={() => {}} />
        </div>
      </BTwoCol>
    </div>
  )
}

function SectionDetails({ e, save }: { e: Engagement; save: (p: Partial<Engagement>) => void }) {
  return (
    <div className="space-y-5">
      <BSectionHeader>Event Details</BSectionHeader>
      <EditableField label="Purpose" value={(e as any).purpose}
        placeholder="What is this event / engagement for?" multiline onSave={v => save({ purpose: v } as any)} />
      <EditableField label="Audience" value={(e as any).audience_description || (e.audience_size ? `~${e.audience_size.toLocaleString()} attendees` : '')}
        placeholder="Who is she speaking to/with?" onSave={v => save({ audience_description: v } as any)} />
      <EditableField
        label="Duration (her speaking time only)"
        value={e.session_length ? `${e.session_length} minutes` : ''}
        placeholder="Duration in minutes" onSave={v => save({ session_length: parseInt(v) || undefined })} />
    </div>
  )
}

function SectionVenue({ e, save, onRemove }: { e: Engagement; save: (p: Partial<Engagement>) => void; onRemove: () => void }) {
  return (
    <div className="space-y-4">
      <BDivider />
      <BSectionHeader onRemove={onRemove}>Venue</BSectionHeader>
      <EditableField label="Venue Name" value={e.event_location} placeholder="Venue name" onSave={v => save({ event_location: v })} />
      <EditableField label="Full Address (Google Maps link)" value={(e as any).venue_maps_link}
        placeholder="Google Maps link" onSave={v => save({ venue_maps_link: v } as any)} />
      <BTwoCol>
        <EditableField label="Arrival Time" value={(e as any).arrival_time} placeholder="Arrival time" onSave={v => save({ arrival_time: v } as any)} />
        <EditableField label="Special Instructions" value={(e as any).venue_special_instructions}
          placeholder="Special instructions" onSave={v => save({ venue_special_instructions: v } as any)} />
      </BTwoCol>
    </div>
  )
}

function SectionTravel({ e, save, onRemove }: { e: Engagement; save: (p: Partial<Engagement>) => void; onRemove: () => void }) {
  const [mode, setMode] = useState<'fly' | 'drive'>((e as any).drive_time && !(e as any).flight_details ? 'drive' : 'fly')

  return (
    <div className="space-y-4">
      <BDivider />
      <div className="flex items-center gap-3 mb-4">
        <div className="h-px flex-1 bg-gold/25" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-gold">Travel Details</span>
        <div className="h-px flex-1 bg-gold/25" />
        <div className="flex rounded-lg border border-ink-100 overflow-hidden text-[10px] font-bold uppercase tracking-wide flex-shrink-0">
          <button onClick={() => setMode('fly')} className={`px-2.5 py-1 transition-colors ${mode === 'fly' ? 'bg-ink text-cream' : 'text-ink-400 hover:text-ink'}`}>✈ Fly</button>
          <button onClick={() => setMode('drive')} className={`px-2.5 py-1 transition-colors ${mode === 'drive' ? 'bg-ink text-cream' : 'text-ink-400 hover:text-ink'}`}>⛽ Drive</button>
        </div>
        <button onClick={onRemove} className="text-ink-200 hover:text-red-400 transition-colors flex-shrink-0"><X size={12} /></button>
      </div>

      {mode === 'fly' ? (
        <div className="space-y-4">
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Flight</p>
            <EditableField label="Airline + Flight #  |  Route  |  Times" value={(e as any).flight_details}
              placeholder="Airline, flight number, route, times" onSave={v => save({ flight_details: v } as any)} />
            <EditableField label="Confirmation Link" value={(e as any).flight_confirmation}
              placeholder="Confirmation link" onSave={v => save({ flight_confirmation: v } as any)} />
          </div>
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Hotel</p>
            <EditableField label="Hotel Name" value={(e as any).hotel_name} placeholder="Hotel name" onSave={v => save({ hotel_name: v } as any)} />
            <BTwoCol>
              <EditableField label="Check-In Date" value={(e as any).hotel_checkin} placeholder="Check-in date" onSave={v => save({ hotel_checkin: v } as any)} />
              <EditableField label="Confirmation #" value={(e as any).hotel_confirmation} placeholder="Confirmation number" onSave={v => save({ hotel_confirmation: v } as any)} />
            </BTwoCol>
            <EditableField label="Hotel Address (Google Maps link)" value={(e as any).hotel_maps_link}
              placeholder="Google Maps link" onSave={v => save({ hotel_maps_link: v } as any)} />
          </div>
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Ground</p>
            <EditableField label="Airport → Hotel → Venue" value={(e as any).ground_transport}
              placeholder="How she gets from airport to hotel to venue" multiline onSave={v => save({ ground_transport: v } as any)} />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <EditableField label="Drive Time from Her Location" value={(e as any).drive_time}
            placeholder="Drive time from her location" onSave={v => save({ drive_time: v } as any)} />
          <EditableField label="Route (Google Maps link with departure time)" value={(e as any).drive_route_link}
            placeholder="Google Maps link" onSave={v => save({ drive_route_link: v } as any)} />
          <EditableField label="Parking" value={(e as any).parking_details}
            placeholder="Parking details" onSave={v => save({ parking_details: v } as any)} />
        </div>
      )}
    </div>
  )
}

type RosRow = { time: string; what: string; notes?: string }

function SectionRunOfShow({ e, save, onRemove }: { e: Engagement; save: (p: Partial<Engagement>) => void; onRemove: () => void }) {
  const rows: RosRow[] = (e as any).run_of_show ?? []

  function updateRows(next: RosRow[]) { save({ run_of_show: next } as any) }
  function updateRow(i: number, patch: Partial<RosRow>) { updateRows(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r)) }
  function addRow() { updateRows([...rows, { time: '', what: '', notes: '' }]) }
  function removeRow(i: number) { updateRows(rows.filter((_, idx) => idx !== i)) }

  return (
    <div className="space-y-3">
      <BDivider />
      <BSectionHeader onRemove={onRemove}>Schedule / Run of Show</BSectionHeader>
      <div className="rounded-xl border border-ink-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-parchment border-b border-ink-100">
              <th className="w-5 px-2" />
              <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-ink-300 w-28">Time</th>
              <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-ink-300">What&apos;s Happening</th>
              <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-ink-300 w-40">Her Role / Notes</th>
              <th className="w-8 px-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={`border-b border-ink-50 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-parchment/20'} group`}>
                <td className="px-2 text-ink-200"><GripVertical size={12} /></td>
                <td className="px-2 py-1.5">
                  <input value={row.time} onChange={(ev: React.ChangeEvent<HTMLInputElement>) => updateRow(i, { time: ev.target.value })}
                    placeholder="Time" className="w-full text-xs text-ink bg-transparent border-b border-transparent focus:border-gold/50 focus:outline-none py-0.5" />
                </td>
                <td className="px-2 py-1.5">
                  <input value={row.what} onChange={(ev: React.ChangeEvent<HTMLInputElement>) => updateRow(i, { what: ev.target.value })}
                    placeholder="What's happening" className="w-full text-xs text-ink bg-transparent border-b border-transparent focus:border-gold/50 focus:outline-none py-0.5" />
                </td>
                <td className="px-2 py-1.5">
                  <input value={row.notes || ''} onChange={(ev: React.ChangeEvent<HTMLInputElement>) => updateRow(i, { notes: ev.target.value })}
                    placeholder="Her role or notes" className="w-full text-xs text-ink-400 bg-transparent border-b border-transparent focus:border-gold/50 focus:outline-none py-0.5" />
                </td>
                <td className="px-2">
                  <button onClick={() => removeRow(i)} className="text-ink-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"><X size={11} /></button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="text-center text-xs text-ink-200 italic py-4">No schedule yet — add a row below</td></tr>
            )}
          </tbody>
        </table>
        <div className="border-t border-ink-100 px-4 py-2">
          <button onClick={addRow} className="flex items-center gap-1.5 text-xs text-ink-300 hover:text-gold transition-colors font-medium">
            <Plus size={11} /> Add row
          </button>
        </div>
      </div>
    </div>
  )
}

function SectionPrepNotes({ e, save }: { e: Engagement; save: (p: Partial<Engagement>) => void }) {
  return (
    <div className="space-y-4">
      <BDivider />
      <BSectionHeader>Prep Notes</BSectionHeader>
      <EditableField label="Topics / Questions" value={e.topic}
        placeholder="What will she be discussing or asked about?" multiline onSave={v => save({ topic: v })} />
      <EditableField label="Moderator" value={(e as any).moderator_info}
        placeholder="Moderator name and research link" onSave={v => save({ moderator_info: v } as any)} />
      <EditableField label="Co-Panelists" value={(e as any).panelist_info}
        placeholder="Panelist names and research" multiline onSave={v => save({ panelist_info: v } as any)} />
      <EditableField label="VIPs" value={(e as any).vip_info}
        placeholder="VIPs or key attendees" onSave={v => save({ vip_info: v } as any)} />
      <EditableField label="Dress Code / Vibe" value={(e as any).dress_code}
        placeholder="Dress code or vibe" onSave={v => save({ dress_code: v } as any)} />
      <EditableField label="Post-Event" value={(e as any).post_event_notes}
        placeholder="Post-event plans" onSave={v => save({ post_event_notes: v } as any)} />
      {e.notes && (
        <EditableField label="Additional Notes" value={e.notes} multiline onSave={v => save({ notes: v })} />
      )}
    </div>
  )
}

function AddSectionMenu({ available, onAdd }: { available: { key: SectionKey; label: string }[]; onAdd: (k: SectionKey) => void }) {
  const [open, setOpen] = useState(false)
  if (available.length === 0) return null
  return (
    <div className="relative">
      <button onClick={() => setOpen((o: boolean) => !o)}
        className="flex items-center gap-1.5 text-xs text-ink-300 hover:text-gold transition-colors font-medium border border-dashed border-ink-200 hover:border-gold/40 rounded-lg px-3 py-2 w-full justify-center">
        <Plus size={12} /> Add section
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute bottom-full mb-1 left-0 right-0 bg-white border border-ink-100 rounded-xl shadow-lg overflow-hidden z-10">
          {available.map(s => (
            <button key={s.key} onClick={() => { onAdd(s.key); setOpen(false) }}
              className="w-full text-left px-4 py-2.5 text-sm text-ink hover:bg-parchment transition-colors">
              + {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function BriefingDocument({ e }: { e: Engagement }) {
  const { updateEngagement } = useStore()
  const [sections, setSections] = useState<SectionKey[]>(() => getDefaultSections(e))
  const [downloading, setDownloading] = useState(false)

  const save = useCallback((patch: Partial<Engagement>): void => {
    updateEngagement(e.id, patch)
  }, [e.id, updateEngagement]) as (p: Partial<Engagement>) => void

  function removeSection(k: SectionKey) { setSections((s: SectionKey[]) => s.filter((x: SectionKey) => x !== k)) }
  function addSection(k: SectionKey) {
    setSections((s: SectionKey[]) => {
      const prepIdx = s.indexOf('prepnotes')
      const next = [...s]
      if (prepIdx >= 0) next.splice(prepIdx, 0, k)
      else next.push(k)
      return next
    })
  }

  const optionalSections = ALL_SECTIONS.filter(s => !s.always)
  const available = optionalSections.filter(s => !sections.includes(s.key))

  async function handleDownload() {
    setDownloading(true)
    try {
      const { generateBriefingDoc } = await import('@/lib/documents')
      const blob = generateBriefingDoc(e)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `briefing-${e.organization.toLowerCase().replace(/\s+/g, '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div id="briefing" className="bg-white border border-ink-100 rounded-xl mb-6 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-gold" />
          <span className="text-sm font-semibold text-ink">Briefing Document</span>
          <span className="text-[10px] text-ink-300 font-medium ml-1">— click any field to edit</span>
        </div>
        <button onClick={handleDownload} disabled={downloading}
          className="flex items-center gap-1.5 text-xs font-medium text-ink-400 hover:text-ink border border-ink-100 hover:border-ink-300 rounded-lg px-3 py-1.5 transition-all disabled:opacity-50">
          <Download size={12} />
          {downloading ? 'Generating…' : 'Download PDF'}
        </button>
      </div>

      <div className="px-6 py-5 space-y-0">
        {sections.map((key: SectionKey) => {
          if (key === 'header')    return <React.Fragment key="header"><SectionHeader e={e} save={save} /></React.Fragment>
          if (key === 'contact')   return <React.Fragment key="contact"><SectionContact e={e} save={save} /></React.Fragment>
          if (key === 'details')   return <React.Fragment key="details"><BDivider /><SectionDetails e={e} save={save} /></React.Fragment>
          if (key === 'venue')     return <React.Fragment key="venue"><SectionVenue e={e} save={save} onRemove={() => removeSection('venue')} /></React.Fragment>
          if (key === 'travel')    return <React.Fragment key="travel"><SectionTravel e={e} save={save} onRemove={() => removeSection('travel')} /></React.Fragment>
          if (key === 'runofshow') return <React.Fragment key="runofshow"><SectionRunOfShow e={e} save={save} onRemove={() => removeSection('runofshow')} /></React.Fragment>
          if (key === 'prepnotes') return <React.Fragment key="prepnotes"><SectionPrepNotes e={e} save={save} /></React.Fragment>
          return null
        })}
        <div className="mt-6">
          <AddSectionMenu available={available} onAdd={addSection} />
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EngagementDetailPage() {
  const { id } = useParams()
  const { engagements: allEngagements, updateEngagement } = useStore()
  const e = allEngagements.find(e => e.id === id)
  if (!e) return <div className="p-8 text-ink-400">Engagement not found</div>

  const eventType = (e as any).event_type || 'speaking'

  const save = useCallback((patch: Partial<Engagement>) => {
    updateEngagement(e.id, patch)
  }, [e.id, updateEngagement])

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fade-in">
      <Link href="/engagements" className="flex items-center gap-2 text-sm text-ink-400 hover:text-ink mb-6 transition-all">
        <ArrowLeft size={14} /> Back to Engagements
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {eventTypeIcon(eventType)}
            <span className="text-xs text-ink-400 uppercase tracking-widest font-medium">{eventTypeLabel(eventType)}</span>
          </div>
          <h1 className="font-display text-3xl font-semibold text-ink">{e.event_name || e.organization}</h1>
          <p className="text-ink-400 text-sm mt-1">
            {e.organization}{e.booker_name ? ` · via ${e.booker_name}` : ''}
          </p>
          <div className="accent-line mt-3 w-24" />
        </div>
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

      {/* Progress bar */}
      <ProgressBar e={e} save={save} />

      {/* Event details + contacts */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-ink-100 rounded-xl p-5">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Event Details</p>
          <div className="space-y-3">
            {e.event_date && <div className="flex items-center gap-2 text-sm"><Calendar size={14} className="text-ink-300" />{formatDate(e.event_date)}</div>}
            {(e as any).event_time && <div className="flex items-center gap-2 text-sm"><Clock size={14} className="text-ink-300" />{(e as any).event_time}</div>}
            {e.event_city && <div className="flex items-center gap-2 text-sm"><MapPin size={14} className="text-ink-300" />{e.event_city}</div>}
            {e.session_length && <div className="flex items-center gap-2 text-sm"><Clock size={14} className="text-ink-300" />{e.session_length} min</div>}
            {e.audience_size && <div className="flex items-center gap-2 text-sm"><Users size={14} className="text-ink-300" />{e.audience_size.toLocaleString()} attendees</div>}
            {e.event_format === 'virtual' && <div className="flex items-center gap-2 text-sm"><Wifi size={14} className="text-ink-300" />Virtual</div>}
            {e.travel_covered !== undefined && (
              <div className="flex items-center gap-2 text-xs text-ink-400 pt-1">
                <Plane size={11} />{e.travel_covered ? 'Travel covered' : 'Self-travel'}
                {e.hotel_covered !== undefined && (
                  <><span className="mx-1">·</span><Hotel size={11} />{e.hotel_covered ? 'Hotel covered' : 'Self-hotel'}</>
                )}
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
                  <p className="text-xs text-ink-400">{c.title}</p>
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

      {/* Progress detail — full working area */}
      <ProgressDetail e={e} save={save} />

      {/* Briefing Document */}
      <BriefingDocument e={e} />

      {/* Comms timeline */}
      <div className="bg-white border border-ink-100 rounded-xl p-5">
        <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Timeline</p>
        <div className="space-y-4">
          {e.comms.map(comm => (
            <div key={comm.id} className={`flex gap-3 ${comm.type === 'email_outbound' ? 'flex-row-reverse' : ''}`}>
              <div className={`text-xs px-3 py-2 rounded-xl max-w-lg ${
                comm.type === 'email_outbound' ? 'bg-ink text-cream ml-auto' :
                comm.type === 'stage_change' ? 'bg-parchment text-ink-400 italic' :
                'bg-parchment text-ink'
              }`}>
                {comm.subject && <p className="font-semibold mb-1">{comm.subject}</p>}
                <p className="whitespace-pre-line">{comm.body}</p>
                <p className="text-[10px] opacity-60 mt-1">{comm.from_name} · {formatDate(comm.date, 'MMM d, h:mm a')}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating briefing CTA */}
      <FloatingBriefingButton e={e} save={save} />
    </div>
  )
}