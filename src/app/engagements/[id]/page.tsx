'use client'
import React from 'react'
import { useParams } from 'next/navigation'
import { useState, useCallback, useEffect, useRef } from 'react'
import { useStore } from '@/lib/store'
import {
  Engagement, primaryContact, DEFAULT_OUTGOING_MATERIALS, DEFAULT_INCOMING_MATERIALS, OutgoingMaterial, IncomingMaterial, BriefingNote, EngagementContact
} from '@/types'
import { formatDate, formatCurrency, getInitials } from '@/lib/utils'
import {
  ArrowLeft, Calendar, MapPin, Users, AlertTriangle, CheckCircle2, Circle,
  Download, FileText, Mic, Radio, Newspaper,
  Clock, Wifi, Hotel, Plane, ExternalLink,
  Pencil, Check, X, Plus, Trash2, GripVertical, ChevronDown,
  FileCheck, Upload, Pin, PinOff, ArrowDown, Paperclip, Building2
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
      {label && <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-300">{label}</p>}
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

function hoursElapsed(isoDate?: string): number | null {
  if (!isoDate) return null
  return (Date.now() - new Date(isoDate).getTime()) / 36e5
}

function formatElapsed(isoDate?: string): string {
  const h = hoursElapsed(isoDate)
  if (h === null) return ''
  if (h < 1) return 'just now'
  if (h < 24) return `${Math.floor(h)}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
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
  return existing ?? []
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
  const outgoingComplete = !!e.outgoing_not_needed || (outgoing.length > 0 && outgoingDone === outgoing.length)
  const incomingComplete = !!e.incoming_not_needed || (incoming.length > 0 && incomingDone === incoming.length)
  const briefingComplete = !!e.briefing_complete

  function toggleOutgoing(id: string) {
    const now = new Date().toISOString()
    save({ outgoing_materials: outgoing.map(m => m.id === id ? { ...m, done: !m.done, sent_at: !m.done ? now : undefined } : m) })
  }
  function removeOutgoing(id: string) {
    save({ outgoing_materials: outgoing.filter(m => m.id !== id) })
  }
  function addCustomOutgoing(label: string) {
    save({ outgoing_materials: [...outgoing, { id: `custom_${Date.now()}`, label, done: false, custom: true, added_at: new Date().toISOString() }] })
  }
  function addIncoming(label: string, requested_at?: string) {
    save({ incoming_materials: [...incoming, { id: `in_${Date.now()}`, label, received: false, added_at: new Date().toISOString(), requested_at }] })
  }
  function toggleIncoming(id: string) {
    const now = new Date().toISOString()
    save({ incoming_materials: incoming.map(m => m.id === id ? { ...m, received: !m.received, received_at: !m.received ? now : undefined } : m) })
  }
  function captureNote(id: string, note: string) {
    const now = new Date().toISOString()
    save({ incoming_materials: incoming.map(m => m.id === id ? { ...m, note, received: true, received_at: m.received_at ?? now } : m) })
  }
  function captureLink(id: string, link: string) {
    const now = new Date().toISOString()
    save({ incoming_materials: incoming.map(m => m.id === id ? { ...m, link, received: true, received_at: m.received_at ?? now } : m) })
  }
  function toggleIncomingPin(id: string) {
    save({ incoming_materials: incoming.map(m => m.id === id ? { ...m, pinned_to_briefing: !m.pinned_to_briefing } : m) })
  }
  function removeIncoming(id: string) {
    save({ incoming_materials: incoming.filter(m => m.id !== id) })
  }
  function toggleContractFlag(flag: 'contract_sent' | 'contract_signed') {
    const current = e.engagement_flags ?? []
    const isAdding = !current.includes(flag)
    const now = new Date().toISOString()
    const patch: Partial<Engagement> = {
      engagement_flags: (isAdding ? [...current, flag] : current.filter(f => f !== flag)) as any,
    }
    if (flag === 'contract_sent') patch.contract_sent_at = isAdding ? now : undefined
    if (flag === 'contract_signed') patch.contract_signed_at = isAdding ? now : undefined
    save(patch)
  }

  function attachFile(id: string, file_url: string, file_name: string) {
    save({ incoming_materials: incoming.map(m => m.id === id ? { ...m, file_url, file_name, file_uploaded_by: 'user', received: true, received_at: m.received_at ?? new Date().toISOString() } : m) })
  }
  function removeFile(id: string) {
    save({ incoming_materials: incoming.map(m => m.id === id ? { ...m, file_url: undefined, file_name: undefined, file_uploaded_by: undefined } : m) })
  }

  return {
    outgoing, incoming, contractRequired, contractSent, contractSigned,
    outgoingDone, incomingDone,
    contractComplete, outgoingComplete, incomingComplete, briefingComplete,
    toggleOutgoing, removeOutgoing, addCustomOutgoing,
    addIncoming, toggleIncoming, toggleIncomingPin, removeIncoming, toggleContractFlag,
    attachFile, removeFile, captureNote, captureLink,
  }
}

// ─── Incoming Item ────────────────────────────────────────────────────────────

function IncomingItem({ item, overdue, captured, onUndo, onRemove, onPin, onCaptureNote, onCaptureLink, onAttachFile, onRemoveFile }: {
  item: IncomingMaterial
  overdue: boolean
  captured: boolean
  onUndo: () => void
  onRemove: () => void
  onPin: () => void
  onCaptureNote: (note: string) => void
  onCaptureLink: (link: string) => void
  onAttachFile: (url: string, name: string) => void
  onRemoveFile: () => void
  key?: string
}) {
  const [noteInput, setNoteInput] = useState(item.note ?? '')
  const [linkInput, setLinkInput] = useState(item.link ?? '')
  const [editingNote, setEditingNote] = useState(false)
  const [editingLink, setEditingLink] = useState(false)

  return (
    <div className="group/in rounded-lg border bg-white overflow-hidden transition-all">

      {/* Header row */}
      <div className={`flex items-center gap-2 px-3 py-2.5 ${
        captured ? 'bg-sage/8 border-b border-sage/10' : overdue ? 'bg-red-50' : 'bg-white'
      }`}>
        {captured
          ? <CheckCircle2 size={13} className="text-sage flex-shrink-0" />
          : <Circle size={13} className={`flex-shrink-0 ${overdue ? 'text-red-400' : 'text-ink-200'}`} />
        }
        <span className={`flex-1 text-sm font-medium truncate ${captured ? 'text-sage' : overdue ? 'text-red-600' : 'text-ink-400'}`}>
          {item.label}
        </span>
        {captured && item.received_at && (
          <span className="text-[10px] text-sage/70 flex-shrink-0">{formatElapsed(item.received_at)}</span>
        )}
        {overdue && !captured && (
          <span className="text-[10px] text-red-400 flex-shrink-0">{formatElapsed(item.added_at)} — overdue</span>
        )}
        {item.pinned_to_briefing && (
          <span className="text-[10px] text-gold bg-gold/10 px-1.5 py-0.5 rounded font-medium flex-shrink-0">Briefing</span>
        )}
        {/* Hover actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover/in:opacity-100 transition-all flex-shrink-0 ml-1">
          <button onClick={onPin}
            className={`p-1.5 rounded transition-colors ${item.pinned_to_briefing ? 'text-gold' : 'text-ink-300 hover:text-gold'}`}>
            <Pin size={12} />
          </button>
          {captured && (
            <button onClick={onUndo} className="p-1.5 rounded text-ink-300 hover:text-ink-500 transition-colors text-[10px] font-medium">
              undo
            </button>
          )}
          <button onClick={onRemove}
            className="p-1.5 rounded text-ink-300 hover:text-red-500 hover:bg-red-50 transition-colors">
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Capture area */}
      <div className={`divide-y divide-ink-50 border-t ${captured ? 'border-sage/10' : 'border-ink-100'}`}>

        {/* Note */}
        <div className="px-3 py-2 flex items-start gap-2">
          <FileText size={11} className="text-ink-300 flex-shrink-0 mt-0.5" />
          {item.note && !editingNote ? (
            <button onClick={() => setEditingNote(true)} className="flex-1 text-left text-xs text-ink leading-snug hover:underline decoration-dashed decoration-ink-200 underline-offset-2 line-clamp-2">
              {item.note}
            </button>
          ) : editingNote ? (
            <div className="flex-1 flex gap-1.5">
              <textarea autoFocus value={noteInput}
                onChange={(ev: React.ChangeEvent<HTMLTextAreaElement>) => setNoteInput(ev.target.value)}
                onKeyDown={(ev: React.KeyboardEvent<HTMLTextAreaElement>) => {
                  if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); onCaptureNote(noteInput); setEditingNote(false) }
                  if (ev.key === 'Escape') { setNoteInput(item.note ?? ''); setEditingNote(false) }
                }}
                rows={2} placeholder="Paste email text, run of show, notes…"
                className="flex-1 text-xs text-ink bg-parchment/60 border border-gold/30 rounded px-2 py-1.5 focus:outline-none focus:border-gold resize-none" />
              <div className="flex flex-col gap-1">
                <button onClick={() => { onCaptureNote(noteInput); setEditingNote(false) }} className="p-1 text-sage hover:text-sage-dark"><Check size={11} /></button>
                <button onClick={() => { setNoteInput(item.note ?? ''); setEditingNote(false) }} className="p-1 text-ink-300 hover:text-ink"><X size={11} /></button>
              </div>
            </div>
          ) : (
            <button onClick={() => setEditingNote(true)} className="text-xs text-ink-300 hover:text-ink-500 transition-colors">
              Add note or paste text…
            </button>
          )}
        </div>

        {/* Link */}
        <div className="px-3 py-2 flex items-center gap-2">
          <ExternalLink size={11} className="text-ink-300 flex-shrink-0" />
          {item.link && !editingLink ? (
            <div className="flex-1 flex items-center gap-1.5 min-w-0">
              <a href={item.link} target="_blank" rel="noopener noreferrer"
                className="text-xs text-gold hover:underline truncate flex-1">{item.link}</a>
              <button onClick={() => setEditingLink(true)} className="text-ink-200 hover:text-ink-400 flex-shrink-0"><Pencil size={9} /></button>
            </div>
          ) : editingLink ? (
            <div className="flex-1 flex gap-1.5">
              <input autoFocus value={linkInput}
                onChange={(ev: React.ChangeEvent<HTMLInputElement>) => setLinkInput(ev.target.value)}
                onKeyDown={(ev: React.KeyboardEvent<HTMLInputElement>) => {
                  if (ev.key === 'Enter') { onCaptureLink(linkInput); setEditingLink(false) }
                  if (ev.key === 'Escape') { setLinkInput(item.link ?? ''); setEditingLink(false) }
                }}
                placeholder="https://…"
                className="flex-1 text-xs text-ink bg-parchment/60 border border-gold/30 rounded px-2 py-1 focus:outline-none focus:border-gold" />
              <button onClick={() => { onCaptureLink(linkInput); setEditingLink(false) }} className="p-1 text-sage hover:text-sage-dark"><Check size={11} /></button>
              <button onClick={() => { setLinkInput(item.link ?? ''); setEditingLink(false) }} className="p-1 text-ink-300 hover:text-ink"><X size={11} /></button>
            </div>
          ) : (
            <button onClick={() => setEditingLink(true)} className="text-xs text-ink-300 hover:text-ink-500 transition-colors">
              Add link…
            </button>
          )}
        </div>

        {/* File */}
        <div className="px-3 py-2 flex items-center gap-2">
          <Paperclip size={11} className="text-ink-300 flex-shrink-0" />
          {item.file_url ? (
            <div className="flex-1 flex items-center gap-1.5 min-w-0 group/file">
              <a href={item.file_url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-gold hover:underline truncate flex-1">
                {item.file_name ?? 'Attached file'}
              </a>
              {item.file_uploaded_by === 'ai' && <span className="text-[9px] text-ink-200 flex-shrink-0">AI</span>}
              <button onClick={onRemoveFile}
                className="text-ink-200 hover:text-red-400 opacity-0 group-hover/file:opacity-100 transition-all flex-shrink-0">
                <X size={9} />
              </button>
            </div>
          ) : (
            <label className="text-xs text-ink-300 hover:text-ink-500 cursor-pointer transition-colors">
              Upload file…
              <input type="file" className="hidden"
                onChange={(ev: React.ChangeEvent<HTMLInputElement>) => {
                  const file = ev.target.files?.[0]
                  if (!file) return
                  // TODO: upload to Supabase storage, get URL back
                  const url = URL.createObjectURL(file)
                  onAttachFile(url, file.name)
                }} />
            </label>
          )}
        </div>

      </div>
    </div>
  )
}

// ─── Briefing Zone ────────────────────────────────────────────────────────────

function BriefingZone({ e, save, briefingComplete }: { e: Engagement; save: (p: Partial<Engagement>) => void; briefingComplete: boolean }) {
  const [draft, setDraft] = useState('')
  const notes: BriefingNote[] = e.briefing_notes ?? []

  function addNote() {
    if (!draft.trim()) return
    const note: BriefingNote = { id: `bn_${Date.now()}`, body: draft.trim(), created_at: new Date().toISOString() }
    save({ briefing_notes: [...notes, note] } as any)
    setDraft('')
  }

  function removeNote(id: string) {
    save({ briefing_notes: notes.filter(n => n.id !== id) } as any)
  }

  function resolveNote(id: string) {
    save({ briefing_notes: notes.map(n => n.id === id ? { ...n, resolved: true } : n) } as any)
  }

  return (
    <div className="border-t border-ink-100 px-5 py-4 bg-parchment/30">

      {/* Header — label + jump link + mark complete */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">Briefing Document</p>
        <div className="flex items-center gap-3">
          <a href="#briefing" className="flex items-center gap-1.5 text-xs font-medium text-ink-300 hover:text-gold transition-colors">
            <ArrowDown size={11} /> Jump to briefing
          </a>
          {briefingComplete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-sage font-medium flex items-center gap-1.5">
                <CheckCircle2 size={12} /> Ready{e.briefing_complete_at ? ` · ${formatElapsed(e.briefing_complete_at)}` : ''}
              </span>
              <button onClick={() => save({ briefing_complete: false, briefing_complete_at: undefined } as any)}
                className="text-xs text-ink-200 hover:text-ink-400 transition-colors">
                undo
              </button>
            </div>
          ) : (
            <button onClick={() => save({ briefing_complete: true, briefing_complete_at: new Date().toISOString() } as any)}
              className="flex items-center gap-1.5 text-xs font-medium text-ink-400 hover:text-ink border border-ink-200 hover:border-ink-400 bg-white rounded-lg px-2.5 py-1.5 transition-all">
              <Check size={11} /> Mark complete
            </button>
          )}
        </div>
      </div>

      {/* Notes log */}
      {notes.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {notes.map(note => {
            const resolved = note.resolved
            return (
              <div key={note.id} className={`group/note flex items-start gap-2 ${resolved ? 'opacity-40' : ''}`}>
                <div className={`flex-1 bg-white border rounded-lg px-3 py-2 ${resolved ? 'border-ink-100' : 'border-ink-100'}`}>
                  <p className={`text-xs leading-snug ${resolved ? 'line-through text-ink-300' : 'text-ink'}`}>{note.body}</p>
                  <p className="text-[10px] text-ink-300 mt-0.5">{formatElapsed(note.created_at)}</p>
                </div>
                <div className="flex flex-col gap-1 opacity-0 group-hover/note:opacity-100 transition-all flex-shrink-0 mt-1.5">
                  {!resolved && (
                    <button onClick={() => resolveNote(note.id)}
                      className="text-ink-200 hover:text-sage transition-colors" title="Mark resolved">
                      <Check size={11} />
                    </button>
                  )}
                  <button onClick={() => removeNote(note.id)}
                    className="text-ink-200 hover:text-red-400 transition-colors" title="Delete">
                    <X size={11} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add note input */}
      <div className="flex items-start gap-2">
        <textarea
          value={draft}
          onChange={(ev: React.ChangeEvent<HTMLTextAreaElement>) => setDraft(ev.target.value)}
          onKeyDown={(ev: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); addNote() }
          }}
          placeholder="Log a note about what's outstanding or blocking this…"
          rows={2}
          className="flex-1 text-sm text-ink bg-white border border-ink-100 rounded-lg px-3 py-2 focus:outline-none focus:border-gold/50 placeholder:text-ink-200 resize-none"
        />
        <button onClick={addNote}
          className="text-xs font-medium text-ink-300 hover:text-gold border border-dashed border-ink-200 hover:border-gold/40 rounded-lg px-3 py-2 transition-colors flex-shrink-0 mt-0.5">
          Add
        </button>
      </div>

    </div>
  )
}

// ─── Event Details Card ───────────────────────────────────────────────────────

function EventDetailsCard({ e, save }: { e: Engagement; save: (p: Partial<Engagement>) => void }) {
  const { companies, updateCompany } = useStore()
  const [addingTeam, setAddingTeam] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')

  const linkedCompany = companies.find(c => c.id === e.company_id)
    ?? companies.find(c => c.name.toLowerCase() === e.organization.toLowerCase())
  const linkedTeam = linkedCompany?.teams.find(t => t.id === e.team_id)

  function handleAddTeam() {
    if (!newTeamName.trim() || !linkedCompany) return
    const newTeam = { id: `t_${Date.now()}`, name: newTeamName.trim() }
    updateCompany(linkedCompany.id, { teams: [...linkedCompany.teams, newTeam] })
    save({ team_id: newTeam.id })
    setNewTeamName('')
    setAddingTeam(false)
  }

  return (
    <div className="bg-white border border-ink-100 rounded-xl p-5">
      <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Event Details</p>
      <div className="space-y-3">

        {/* Company */}
        <div className="flex items-start gap-2.5">
          <Building2 size={14} className="text-ink-300 mt-1 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            {linkedCompany ? (
              <div className="flex items-center gap-1.5 group/co">
                <span className="text-sm text-ink">{linkedCompany.name}</span>
                <button
                  onClick={() => save({ company_id: undefined, team_id: undefined })}
                  className="p-0.5 rounded text-ink-200 hover:text-red-400 hover:bg-red-50 opacity-0 group-hover/co:opacity-100 transition-all flex-shrink-0">
                  <X size={11} />
                </button>
              </div>
            ) : (
              <select value=""
                onChange={(ev: React.ChangeEvent<HTMLSelectElement>) => {
                  const id = ev.target.value
                  if (!id) return
                  const co = companies.find(c => c.id === id)
                  save({ company_id: id, team_id: undefined, organization: co?.name ?? e.organization })
                }}
                className="text-sm text-ink-400 bg-transparent border-none focus:outline-none cursor-pointer hover:text-ink transition-colors w-full appearance-none">
                <option value="">Link a company…</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* Team — only when company is linked */}
        {linkedCompany && (
          <div className="flex items-start gap-2.5 pl-5">
            <div className="flex-1 min-w-0">
              {linkedTeam ? (
                <div className="flex items-center gap-1.5 group/team">
                  <span className="text-sm text-ink-400">{linkedTeam.name}</span>
                  <button onClick={() => save({ team_id: undefined })}
                    className="p-0.5 rounded text-ink-200 hover:text-red-400 hover:bg-red-50 opacity-0 group-hover/team:opacity-100 transition-all flex-shrink-0">
                    <X size={11} />
                  </button>
                </div>
              ) : addingTeam ? (
                <div className="flex items-center gap-1.5">
                  <input autoFocus value={newTeamName}
                    onChange={(ev: React.ChangeEvent<HTMLInputElement>) => setNewTeamName(ev.target.value)}
                    onKeyDown={(ev: React.KeyboardEvent<HTMLInputElement>) => {
                      if (ev.key === 'Enter') handleAddTeam()
                      if (ev.key === 'Escape') { setAddingTeam(false); setNewTeamName('') }
                    }}
                    placeholder="New team name…"
                    className="flex-1 text-sm text-ink bg-parchment border border-gold/40 rounded px-2 py-1 focus:outline-none focus:border-gold" />
                  <button onClick={handleAddTeam} className="p-1 text-sage hover:text-sage-dark"><Check size={11} /></button>
                  <button onClick={() => { setAddingTeam(false); setNewTeamName('') }} className="p-1 text-ink-300 hover:text-ink"><X size={11} /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {linkedCompany.teams.length > 0 && (
                    <select value=""
                      onChange={(ev: React.ChangeEvent<HTMLSelectElement>) => save({ team_id: ev.target.value || undefined })}
                      className="text-sm text-ink-400 bg-transparent border-none focus:outline-none cursor-pointer hover:text-ink transition-colors appearance-none">
                      <option value="">Link a team…</option>
                      {linkedCompany.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  )}
                  <button onClick={() => setAddingTeam(true)}
                    className="text-xs text-ink-300 hover:text-gold transition-colors flex items-center gap-1">
                    <Plus size={10} /> {linkedCompany.teams.length === 0 ? 'Add team' : 'New'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="border-t border-ink-50 pt-2 space-y-3">
          <div className="flex items-start gap-2.5">
            <Calendar size={14} className="text-ink-300 mt-0.5 flex-shrink-0" />
            <EditableField label="" value={e.event_date ? formatDate(e.event_date) : undefined}
              placeholder="Date" onSave={v => save({ event_date: v })} />
          </div>
          <div className="flex items-start gap-2.5">
            <Clock size={14} className="text-ink-300 mt-0.5 flex-shrink-0" />
            <EditableField label="" value={(e as any).event_time}
              placeholder="Time" onSave={v => save({ event_time: v } as any)} />
          </div>
          <div className="flex items-start gap-2.5">
            <MapPin size={14} className="text-ink-300 mt-0.5 flex-shrink-0" />
            <EditableField label="" value={e.event_city}
              placeholder="Location" onSave={v => save({ event_city: v })} />
          </div>
          <div className="flex items-start gap-2.5">
            <Clock size={14} className="text-ink-300 mt-0.5 flex-shrink-0" />
            <EditableField label="" value={e.session_length ? `${e.session_length} min` : undefined}
              placeholder="Duration" onSave={v => save({ session_length: parseInt(v) || undefined })} />
          </div>
          <div className="flex items-start gap-2.5">
            <Users size={14} className="text-ink-300 mt-0.5 flex-shrink-0" />
            <EditableField label="" value={e.audience_size ? `${e.audience_size.toLocaleString()} attendees` : undefined}
              placeholder="Audience size" onSave={v => save({ audience_size: parseInt(v.replace(/\D/g, '')) || undefined })} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Contacts Card ────────────────────────────────────────────────────────────

type ContactDraft = { first_name: string; last_name: string; title: string; email: string; company_id: string; team_id: string }
const emptyDraft = (): ContactDraft => ({ first_name: '', last_name: '', title: '', email: '', company_id: '', team_id: '' })
const contactToDraft = (c: EngagementContact): ContactDraft => ({
  first_name: c.first_name, last_name: c.last_name, title: c.title ?? '',
  email: c.email, company_id: c.company_id ?? '', team_id: c.team_id ?? '',
})

function ContactForm({ initial, onSave, onCancel, originalEmail }: {
  initial: ContactDraft
  onSave: (d: ContactDraft) => void
  onCancel: () => void
  originalEmail?: string
}) {
  const { companies } = useStore()
  const [d, setD] = useState(initial)
  const set = (k: keyof ContactDraft) => (ev: React.ChangeEvent<HTMLInputElement>) => setD((prev: ContactDraft) => ({ ...prev, [k]: ev.target.value }))
  const linkedCompany = companies.find(c => c.id === d.company_id)

  return (
    <div className="space-y-2 p-3 bg-parchment/60 rounded-lg border border-ink-100">
      <div className="grid grid-cols-2 gap-2">
        <input value={d.first_name} onChange={set('first_name')} placeholder="First name"
          className="text-sm text-ink bg-white border border-ink-100 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gold/50 placeholder:text-ink-200" />
        <input value={d.last_name} onChange={set('last_name')} placeholder="Last name"
          className="text-sm text-ink bg-white border border-ink-100 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gold/50 placeholder:text-ink-200" />
      </div>
      <input value={d.title} onChange={set('title')} placeholder="Title"
        className="w-full text-sm text-ink bg-white border border-ink-100 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gold/50 placeholder:text-ink-200" />
      <input value={d.email} onChange={set('email')} placeholder="Email" type="email"
        className="w-full text-sm text-ink bg-white border border-ink-100 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gold/50 placeholder:text-ink-200" />
      {/* Company */}
      <select value={d.company_id}
        onChange={(ev: React.ChangeEvent<HTMLSelectElement>) => setD((prev: ContactDraft) => ({ ...prev, company_id: ev.target.value, team_id: '' }))}
        className="w-full text-sm text-ink-400 bg-white border border-ink-100 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gold/50 appearance-none cursor-pointer">
        <option value="">Company (optional)…</option>
        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {/* Team — only if company has teams */}
      {linkedCompany && linkedCompany.teams.length > 0 && (
        <select value={d.team_id}
          onChange={(ev: React.ChangeEvent<HTMLSelectElement>) => setD((prev: ContactDraft) => ({ ...prev, team_id: ev.target.value }))}
          className="w-full text-sm text-ink-400 bg-white border border-ink-100 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gold/50 appearance-none cursor-pointer">
          <option value="">Team (optional)…</option>
          {linkedCompany.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button onClick={onCancel} className="text-xs text-ink-300 hover:text-ink transition-colors">Cancel</button>
        <button onClick={() => onSave(d)}
          className="text-xs font-medium text-ink-400 hover:text-ink border border-ink-200 hover:border-ink-400 bg-white rounded-lg px-3 py-1.5 transition-all">
          Save
        </button>
      </div>
    </div>
  )
}

function ContactsCard({ e, save }: { e: Engagement; save: (p: Partial<Engagement>) => void }) {
  const { engagements, updateContact } = useStore()
  const [mode, setMode] = useState<'idle' | 'search' | 'add'>('idle')
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const linkedEmails = new Set(e.contacts.map(c => c.email.toLowerCase()))
  const pool: EngagementContact[] = []
  const seen = new Set<string>()
  const otherPool: EngagementContact[] = []
  const otherSeen = new Set<string>()

  for (const eng of engagements) {
    const sameOrg = eng.organization.toLowerCase() === e.organization.toLowerCase()
    for (const c of eng.contacts) {
      const key = c.email.toLowerCase()
      if (linkedEmails.has(key)) continue
      if (sameOrg && !seen.has(key)) { seen.add(key); pool.push(c) }
      else if (!sameOrg && !otherSeen.has(key) && !seen.has(key)) { otherSeen.add(key); otherPool.push(c) }
    }
  }

  const trimmed = query.trim().toLowerCase()
  const filter = (c: EngagementContact) =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(trimmed)
    || c.email.toLowerCase().includes(trimmed)
    || (c.title ?? '').toLowerCase().includes(trimmed)
  const orgResults = trimmed ? pool.filter(filter) : pool.slice(0, 6)
  const otherResults = trimmed ? otherPool.filter(filter) : []

  function linkContact(c: EngagementContact) {
    save({ contacts: [...e.contacts, { ...c, id: `lnk_${Date.now()}`, is_current_point_of_contact: e.contacts.length === 0 }] })
    setQuery(''); setMode('idle')
  }

  function addNewContact(d: ContactDraft) {
    if (!d.first_name.trim() || !d.email.trim()) return
    const c: EngagementContact = {
      id: `new_${Date.now()}`, first_name: d.first_name.trim(), last_name: d.last_name.trim(),
      email: d.email.trim(), title: d.title.trim() || undefined, role: 'primary',
      is_current_point_of_contact: e.contacts.length === 0,
      company_id: d.company_id || undefined, team_id: d.team_id || undefined,
    }
    save({ contacts: [...e.contacts, c] })
    setMode('idle')
  }

  function editContact(originalEmail: string, d: ContactDraft) {
    // Write globally — updates this contact across all engagements
    updateContact(originalEmail, {
      first_name: d.first_name.trim(), last_name: d.last_name.trim(),
      title: d.title.trim() || undefined, email: d.email.trim(),
      company_id: d.company_id || undefined, team_id: d.team_id || undefined,
    })
    setEditingId(null)
  }

  function removeContact(id: string) {
    save({ contacts: e.contacts.filter(c => c.id !== id) })
  }

  function togglePOC(id: string) {
    save({ contacts: e.contacts.map(c => ({ ...c, is_current_point_of_contact: c.id === id })) })
  }

  return (
    <div className="bg-white border border-ink-100 rounded-xl p-5">
      <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Contacts</p>

      <div className="space-y-3 mb-3">
        {e.contacts.map(c => (
          <div key={c.id}>
            {editingId === c.id ? (
              <ContactForm
                initial={contactToDraft(c)}
                originalEmail={c.email}
                onSave={d => editContact(c.email, d)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="flex items-center gap-3 group/contact">
                <div className="w-8 h-8 rounded-full bg-ink-800 flex items-center justify-center text-xs font-bold text-gold flex-shrink-0">
                  {getInitials(c.first_name, c.last_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{c.first_name} {c.last_name}</p>
                  {c.title && <p className="text-xs text-ink-400">{c.title}</p>}
                  <p className="text-xs text-ink-300 truncate">{c.email}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover/contact:opacity-100 transition-all">
                  {c.is_current_point_of_contact
                    ? <span className="text-[10px] text-gold bg-gold/10 px-2 py-0.5 rounded-full border border-gold/20">POC</span>
                    : <button onClick={() => togglePOC(c.id)}
                        className="text-[10px] text-ink-300 hover:text-gold px-2 py-0.5 rounded-full border border-transparent hover:border-gold/20 transition-all">
                        Set POC
                      </button>
                  }
                  <button onClick={() => setEditingId(c.id)}
                    className="p-1.5 rounded text-ink-300 hover:text-ink hover:bg-parchment transition-colors">
                    <Pencil size={11} />
                  </button>
                  <button onClick={() => removeContact(c.id)}
                    className="p-1.5 rounded text-ink-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <X size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add / search area */}
      {mode === 'add' ? (
        <div className="border-t border-ink-100 pt-3">
          <ContactForm initial={emptyDraft()} onSave={addNewContact} onCancel={() => setMode('idle')} />
        </div>
      ) : mode === 'search' ? (
        <div className="border-t border-ink-100 pt-3">
          <div className="flex items-center gap-2 mb-2">
            <input autoFocus value={query}
              onChange={(ev: React.ChangeEvent<HTMLInputElement>) => setQuery(ev.target.value)}
              placeholder="Search by name, title, or email…"
              className="flex-1 text-sm text-ink bg-parchment border border-ink-100 rounded-lg px-3 py-2 focus:outline-none focus:border-gold/50 placeholder:text-ink-200" />
            <button onClick={() => { setMode('idle'); setQuery('') }}
              className="p-2 text-ink-300 hover:text-ink transition-colors">
              <X size={13} />
            </button>
          </div>
          {(orgResults.length > 0 || otherResults.length > 0) ? (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {orgResults.map(c => (
                <button key={c.id} onClick={() => linkContact(c)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-parchment transition-colors text-left">
                  <div className="w-7 h-7 rounded-full bg-ink-800 flex items-center justify-center text-[11px] font-bold text-gold flex-shrink-0">
                    {getInitials(c.first_name, c.last_name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{c.first_name} {c.last_name}</p>
                    {c.title && <p className="text-[11px] text-ink-400 truncate">{c.title}</p>}
                  </div>
                </button>
              ))}
              {otherResults.length > 0 && (
                <>
                  <div className="flex items-center gap-2 py-1 px-1">
                    <div className="h-px flex-1 bg-ink-100" />
                    <span className="text-[10px] text-ink-300 uppercase tracking-widest">Other clients</span>
                    <div className="h-px flex-1 bg-ink-100" />
                  </div>
                  {otherResults.map(c => (
                    <button key={c.id} onClick={() => linkContact(c)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-parchment transition-colors text-left">
                      <div className="w-7 h-7 rounded-full bg-ink-800 flex items-center justify-center text-[11px] font-bold text-gold flex-shrink-0">
                        {getInitials(c.first_name, c.last_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">{c.first_name} {c.last_name}</p>
                        {c.title && <p className="text-[11px] text-ink-400 truncate">{c.title}</p>}
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-ink-300 italic px-1">No matching contacts found.</p>
              <button onClick={() => setMode('add')}
                className="text-xs text-gold hover:text-gold-dark transition-colors flex items-center gap-1 px-1">
                <Plus size={11} /> Add new contact
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="border-t border-ink-100 pt-3 flex items-center gap-2">
          <button onClick={() => setMode('search')}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs text-ink-300 hover:text-gold transition-colors font-medium border border-dashed border-ink-200 hover:border-gold/40 rounded-lg px-3 py-2">
            <Plus size={11} /> Link a contact
          </button>
          <button onClick={() => setMode('add')}
            className="flex items-center justify-center gap-1.5 text-xs text-ink-300 hover:text-gold transition-colors font-medium border border-dashed border-ink-200 hover:border-gold/40 rounded-lg px-3 py-2">
            <Plus size={11} /> New
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Progress Track ────────────────────────────────────────────────────────────

type ZoneKey = 'contract' | 'outgoing' | 'incoming' | 'briefing'

function ProgressTrack({ e, save }: { e: Engagement; save: (p: Partial<Engagement>) => void }) {
  const [openZones, setOpenZones] = useState<Set<ZoneKey>>(() => {
    // Auto-open first incomplete zone on mount
    const initial = new Set<ZoneKey>()
    const cr = e.contract_required
    const contractDone = cr === false || (cr === true && (e.engagement_flags?.includes('contract_sent') ?? false) && (e.engagement_flags?.includes('contract_signed') ?? false))
    const outgoing = getDefaultOutgoing(e.outgoing_materials)
    const outgoingDone = outgoing.filter(m => m.done).length === outgoing.length
    const incoming = e.incoming_materials ?? []
    const incomingDone = incoming.length > 0 && incoming.filter(m => m.received).length === incoming.length

    if (cr === undefined) { initial.add('contract'); return initial }
    if (!contractDone) { initial.add('contract'); return initial }
    if (!outgoingDone) { initial.add('outgoing'); return initial }
    if (!incomingDone) { initial.add('incoming'); return initial }
    if (!e.briefing_complete) { initial.add('briefing'); return initial }
    return initial
  })

  const [newIncomingLabel, setNewIncomingLabel] = useState('')
  const [customLabel, setCustomLabel] = useState('')

  const {
    outgoing, incoming, contractRequired, contractSent, contractSigned,
    outgoingDone, incomingDone, contractComplete, outgoingComplete, incomingComplete, briefingComplete,
    toggleOutgoing, removeOutgoing, addCustomOutgoing,
    addIncoming, toggleIncoming, toggleIncomingPin, removeIncoming, toggleContractFlag,
    attachFile, removeFile, captureNote, captureLink,
  } = useProgressState(e, save)

  function toggleZone(z: ZoneKey) {
    setOpenZones((prev: Set<ZoneKey>) => {
      if (prev.has(z)) return new Set<ZoneKey>()
      return new Set<ZoneKey>([z])
    })
  }

  function handleAddIncoming() {
    if (!newIncomingLabel.trim()) return
    addIncoming(newIncomingLabel.trim(), new Date().toISOString().split('T')[0])
    setNewIncomingLabel('')
  }

  function handleAddCustom() {
    if (!customLabel.trim()) return
    addCustomOutgoing(customLabel.trim())
    setCustomLabel('')
  }

  // Pill column
  function PillCol({ zoneKey, complete, label, sub }: { zoneKey: ZoneKey; complete: boolean; label: string; sub?: string }) {
    const open = openZones.has(zoneKey)
    return (
      <button
        onClick={() => toggleZone(zoneKey)}
        className={`flex-1 flex flex-col gap-1.5 px-4 py-3.5 text-left border-r border-ink-100 last:border-r-0 transition-colors hover:bg-parchment/60 ${open ? 'bg-parchment/60' : ''}`}
      >
        <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${complete ? 'text-ink-200' : 'text-ink-400'}`}>{label}</span>
        <div className="flex items-center gap-1.5">
          {complete
            ? <CheckCircle2 size={12} className="text-sage/60 flex-shrink-0" />
            : <Circle size={12} className="text-ink-200 flex-shrink-0" />
          }
          <span className={`text-sm font-medium ${complete ? 'text-ink-300' : 'text-ink'}`}>{sub}</span>
        </div>
        <div className={`mt-0.5 h-px w-4 transition-all ${open ? 'bg-gold/50 w-full' : 'bg-transparent'}`} />
      </button>
    )
  }

  // Contract pill sub-label
  const contractSub = contractRequired === undefined ? 'Not set'
    : contractRequired === false ? 'Not required'
    : contractSigned ? 'Signed'
    : contractSent ? 'Sent — awaiting signature'
    : 'Pending'

  const outgoingSub = e.outgoing_not_needed ? 'Not needed' : outgoingComplete ? 'All sent' : outgoing.length === 0 ? '0 of 0 sent' : `${outgoingDone} of ${outgoing.length} sent`
  const incomingSub = e.incoming_not_needed ? 'Not needed' : incomingComplete ? 'All received' : `${incomingDone} of ${incoming.length} received`
  const briefingSub = briefingComplete ? 'Complete' : 'Incomplete'

  return (
    <div className="bg-white border border-ink-100 rounded-xl mb-6 overflow-hidden">

      {/* ── Track row ── */}
      <div className="flex divide-x divide-ink-100">
        <PillCol zoneKey="contract"  complete={contractComplete}  label="Contract"         sub={contractSub} />
        <PillCol zoneKey="outgoing"  complete={outgoingComplete}  label="Materials Sent"     sub={outgoingSub} />
        <PillCol zoneKey="incoming"  complete={incomingComplete}  label="Materials Received" sub={incomingSub} />
        <PillCol zoneKey="briefing"  complete={briefingComplete}  label="Briefing doc"     sub={briefingSub} />
      </div>

      {/* ── Contract zone ── */}
      {openZones.has('contract') && (
        <div className="border-t border-ink-100 px-5 py-4 bg-parchment/30">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">Contract</p>
            {contractRequired !== undefined && (
              <button
                onClick={() => save({ contract_required: undefined, engagement_flags: (e.engagement_flags ?? []).filter(f => f !== 'contract_sent' && f !== 'contract_signed') as any })}
                className="text-[11px] text-ink-200 hover:text-ink-400 transition-colors">
                reset
              </button>
            )}
          </div>

          {contractRequired === undefined && (
            <div className="flex gap-2">
              <button
                onClick={() => save({ contract_required: true, engagement_flags: (e.engagement_flags ?? []).filter(f => f !== 'contract_sent' && f !== 'contract_signed') as any })}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-ink-200 bg-white text-sm font-medium text-ink-500 hover:border-gold/50 hover:text-ink transition-all">
                <Circle size={13} className="flex-shrink-0" /> Required
              </button>
              <button
                onClick={() => save({ contract_required: false })}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-ink-100 bg-white text-sm font-medium text-ink-300 hover:border-ink-300 hover:text-ink-500 transition-all">
                Not required
              </button>
            </div>
          )}

          {contractRequired === false && (
            <p className="text-xs text-ink-300 italic">No contract needed for this engagement.</p>
          )}

          {contractRequired === true && (
            <div className="flex gap-2">
              {([{ flag: 'contract_sent' as const, label: 'Contract Sent', ts: e.contract_sent_at }, { flag: 'contract_signed' as const, label: 'Contract Signed', ts: e.contract_signed_at }]).map(({ flag, label, ts }) => {
                const done = e.engagement_flags?.includes(flag) ?? false
                const locked = flag === 'contract_signed' && !contractSent
                return (
                  <button key={flag}
                    onClick={() => !locked && toggleContractFlag(flag)}
                    disabled={locked}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                      done ? 'bg-sage/8 border-sage/20 text-sage'
                      : locked ? 'bg-parchment border-ink-100 text-ink-200 cursor-not-allowed opacity-50'
                      : 'bg-white border-ink-200 text-ink-400 hover:border-ink-300 hover:text-ink active:scale-95'
                    }`}>
                    {done ? <CheckCircle2 size={13} className="flex-shrink-0" /> : <Circle size={13} className="flex-shrink-0" />}
                    <span>{label}</span>
                    {done && ts && <span className="text-[10px] opacity-60 font-normal">{formatElapsed(ts)}</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Outgoing zone ── */}
      {openZones.has('outgoing') && (
        <div className="border-t border-ink-100 px-5 py-4 bg-parchment/30">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">Materials Sent</p>
            {outgoing.length > 0 && <span className="text-xs text-ink-300">{outgoingDone} / {outgoing.length} sent</span>}
          </div>

          {outgoing.length === 0 && (
            <p className="text-xs text-ink-300 italic mb-3">Nothing added yet — add what we need to send to the client.</p>
          )}

          {outgoing.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {outgoing.map(item => {
                const hours = !item.done ? hoursElapsed(item.added_at) : null
                const overdue = hours !== null && hours > 48
                return (
                  <div key={item.id} className="flex items-start gap-2 group/item">
                    <button onClick={() => toggleOutgoing(item.id)}
                      className={`flex-1 flex items-start gap-2 px-3 py-2 rounded-lg border text-sm font-medium text-left transition-all ${
                        item.done ? 'bg-sage/8 border-sage/20 text-sage'
                        : overdue ? 'bg-red-50 border-red-100 text-red-600'
                        : 'bg-white border-ink-100 text-ink-400 hover:border-ink-300'
                      }`}>
                      {item.done ? <CheckCircle2 size={13} className="flex-shrink-0 mt-0.5" /> : <Circle size={13} className="flex-shrink-0 mt-0.5" />}
                      <div className="min-w-0 flex-1">
                        <span className="truncate block">{item.label}</span>
                        {item.done && item.sent_at && (
                          <span className="text-[10px] opacity-60 font-normal">Sent {formatElapsed(item.sent_at)}</span>
                        )}
                        {overdue && (
                          <span className="text-[10px] font-normal text-red-400">{formatElapsed(item.added_at)} — overdue</span>
                        )}
                      </div>
                    </button>
                    <button onClick={() => removeOutgoing(item.id)}
                      className="p-1.5 rounded text-ink-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover/item:opacity-100 transition-all flex-shrink-0 mt-0.5">
                      <X size={13} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add row */}
          <div className="border-t border-ink-100 pt-3 space-y-2">
            {(() => {
              const existingLabels = outgoing.map(m => m.label)
              const available = DEFAULT_OUTGOING_MATERIALS.filter(m => !existingLabels.includes(m.label))
              if (available.length === 0) return null
              return (
                <select
                  value=""
                  onChange={(ev: React.ChangeEvent<HTMLSelectElement>) => {
                    const label = ev.target.value
                    if (!label) return
                    const preset = DEFAULT_OUTGOING_MATERIALS.find(m => m.label === label)
                    if (preset) save({ outgoing_materials: [...outgoing, { ...preset, done: false, added_at: new Date().toISOString() }] })
                  }}
                  className="w-full text-sm text-ink-400 bg-white border border-ink-100 rounded-lg px-3 py-2 focus:outline-none focus:border-gold/50 appearance-none cursor-pointer hover:border-ink-300 transition-colors">
                  <option value="">+ Quick add…</option>
                  {available.map(m => <option key={m.id} value={m.label}>{m.label}</option>)}
                </select>
              )
            })()}
            <div className="flex items-center gap-2">
              <input value={customLabel}
                onChange={(ev: React.ChangeEvent<HTMLInputElement>) => setCustomLabel(ev.target.value)}
                onKeyDown={(ev: React.KeyboardEvent<HTMLInputElement>) => { if (ev.key === 'Enter') handleAddCustom() }}
                placeholder="Add a custom item…"
                className="flex-1 text-sm text-ink bg-white border border-ink-100 rounded-lg px-3 py-2 focus:outline-none focus:border-gold/50 placeholder:text-ink-200" />
              <button onClick={handleAddCustom}
                className="text-xs font-medium text-ink-300 hover:text-gold border border-dashed border-ink-200 hover:border-gold/40 rounded-lg px-3 py-2 transition-colors flex-shrink-0">
                Add
              </button>
            </div>
            {/* No items needed — only when list is empty */}
            {outgoing.length === 0 && (
              e.outgoing_not_needed ? (
                <div className="mt-2 flex items-center justify-between px-3 py-2.5 rounded-lg border border-sage/20 bg-sage/8">
                  <span className="text-xs text-sage font-medium flex items-center gap-1.5">
                    <CheckCircle2 size={12} /> No materials to send for this engagement
                  </span>
                  <button onClick={() => save({ outgoing_not_needed: false } as any)}
                    className="text-[11px] text-sage/60 hover:text-sage transition-colors ml-3 flex-shrink-0">
                    undo
                  </button>
                </div>
              ) : (
                <div className="pt-1 border-t border-ink-100">
                  <button onClick={() => save({ outgoing_not_needed: true } as any)}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-ink-200 text-xs text-ink-300 hover:border-ink-400 hover:text-ink-500 transition-all">
                    <Check size={11} /> Mark step complete — no materials needed
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* ── Incoming zone ── */}
      {openZones.has('incoming') && (
        <div className="border-t border-ink-100 px-5 py-4 bg-parchment/30">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">Materials Received</p>
            {incoming.length > 0 && <span className="text-xs text-ink-300">{incomingDone} / {incoming.length} received</span>}
          </div>

          {incoming.length === 0 && (
            <p className="text-xs text-ink-300 italic mb-3">Nothing added yet — add what we're expecting from the client.</p>
          )}

          {incoming.length > 0 && (
            <div className="space-y-2 mb-3">
              {incoming.map(item => {
                const hours = !item.received ? hoursElapsed(item.added_at) : null
                const overdue = hours !== null && hours > 72
                const captured = item.received
                return (
                  <IncomingItem key={item.id} item={item} overdue={overdue} captured={captured}
                    onUndo={() => toggleIncoming(item.id)}
                    onRemove={() => removeIncoming(item.id)}
                    onPin={() => toggleIncomingPin(item.id)}
                    onCaptureNote={(note) => captureNote(item.id, note)}
                    onCaptureLink={(link) => captureLink(item.id, link)}
                    onAttachFile={(url, name) => attachFile(item.id, url, name)}
                    onRemoveFile={() => removeFile(item.id)}
                  />
                )
              })}
            </div>
          )}

          {/* Add row */}
          <div className="border-t border-ink-100 pt-3 space-y-2">
            {(() => {
              const existingLabels = incoming.map(m => m.label)
              const available = DEFAULT_INCOMING_MATERIALS.filter(m => !existingLabels.includes(m.label))
              if (available.length === 0) return null
              return (
                <select
                  value=""
                  onChange={(ev: React.ChangeEvent<HTMLSelectElement>) => {
                    const label = ev.target.value
                    if (!label) return
                    const preset = DEFAULT_INCOMING_MATERIALS.find(m => m.label === label)
                    if (preset) addIncoming(preset.label)
                  }}
                  className="w-full text-sm text-ink-400 bg-white border border-ink-100 rounded-lg px-3 py-2 focus:outline-none focus:border-gold/50 appearance-none cursor-pointer hover:border-ink-300 transition-colors">
                  <option value="">+ Quick add…</option>
                  {available.map(m => <option key={m.id} value={m.label}>{m.label}</option>)}
                </select>
              )
            })()}
            <div className="flex items-center gap-2">
              <input value={newIncomingLabel}
                onChange={(ev: React.ChangeEvent<HTMLInputElement>) => setNewIncomingLabel(ev.target.value)}
                onKeyDown={(ev: React.KeyboardEvent<HTMLInputElement>) => { if (ev.key === 'Enter') handleAddIncoming() }}
                placeholder="Add a custom item…"
                className="flex-1 text-sm text-ink bg-white border border-ink-100 rounded-lg px-3 py-2 focus:outline-none focus:border-gold/50 placeholder:text-ink-200" />
              <button onClick={handleAddIncoming}
                className="text-xs font-medium text-ink-300 hover:text-gold border border-dashed border-ink-200 hover:border-gold/40 rounded-lg px-3 py-2 transition-colors flex-shrink-0">
                Add
              </button>
            </div>
            {/* No items needed — only when list is empty, styled as a deliberate action */}
            {incoming.length === 0 && (
              e.incoming_not_needed ? (
                <div className="mt-2 flex items-center justify-between px-3 py-2.5 rounded-lg border border-sage/20 bg-sage/8">
                  <span className="text-xs text-sage font-medium flex items-center gap-1.5">
                    <CheckCircle2 size={12} /> No materials to receive for this engagement
                  </span>
                  <button onClick={() => save({ incoming_not_needed: false } as any)}
                    className="text-[11px] text-sage/60 hover:text-sage transition-colors ml-3 flex-shrink-0">
                    undo
                  </button>
                </div>
              ) : (
                <div className="pt-1 border-t border-ink-100">
                  <button onClick={() => save({ incoming_not_needed: true } as any)}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-ink-200 text-xs text-ink-300 hover:border-ink-400 hover:text-ink-500 transition-all">
                    <Check size={11} /> Mark step complete — no materials needed
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* ── Briefing zone ── */}
      {openZones.has('briefing') && (
        <BriefingZone e={e} save={save} briefingComplete={briefingComplete} />
      )}

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

      {/* Progress track */}
      <ProgressTrack e={e} save={save} />

      {/* Event details + contacts */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <EventDetailsCard e={e} save={save} />

        <ContactsCard e={e} save={save} />
      </div>

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