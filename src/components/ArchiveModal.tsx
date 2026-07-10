'use client'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Archive, X, Wand2, Loader2 } from 'lucide-react'
import type { Engagement } from '@/types'

interface ArchiveModalProps {
  open: boolean
  engagement: Engagement
  onConfirm: (reason: string) => void
  onCancel: () => void
}

function buildDraft(e: Engagement): string {
  const parts: string[] = []

  const who = e.event_name ? `${e.event_name} (${e.organization})` : e.organization
  const section = e.section === 'prospects' ? 'prospect' : e.section === 'engagements' ? 'confirmed engagement' : 'wrap-up'
  parts.push(`Archiving ${who} — ${section}.`)

  if (e.prospect_step === 'declined') parts.push('Declined.')
  if (e.event_date) parts.push(`Event date: ${e.event_date}.`)
  if (e.fee) parts.push(`Fee: $${e.fee.toLocaleString()}.`)
  if (e.notes) parts.push(`Notes: ${e.notes}`)

  return parts.join(' ')
}

export default function ArchiveModal({ open, engagement, onConfirm, onCancel }: ArchiveModalProps) {
  const [reason, setReason] = useState('')
  const [drafting, setDrafting] = useState(false)

  useEffect(() => { if (open) setReason('') }, [open])

  if (!open) return null

  const handleDraft = async () => {
    setDrafting(true)
    await new Promise(r => setTimeout(r, 120))
    setReason(buildDraft(engagement))
    setDrafting(false)
  }

  const canConfirm = reason.trim().length > 0

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white border border-ink-100 rounded-2xl p-6 w-full max-w-md shadow-xl"
        onClick={ev => ev.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Archive size={16} className="text-ink-400" />
            <h3 className="font-display text-lg font-semibold text-ink">Archive this engagement</h3>
          </div>
          <button onClick={onCancel} className="text-ink-300 hover:text-ink-500 transition-colors">
            <X size={16} />
          </button>
        </div>

        <p className="text-sm text-ink-400 mb-4">
          Add a note explaining why this is being archived. This will be saved with the record.
        </p>

        <div className="relative mb-1">
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Client cancelled due to budget cuts. Relationship in good standing — revisit Q1 next year."
            rows={4}
            autoFocus
            className="w-full text-sm bg-parchment/40 border border-ink-100 rounded-lg px-3 py-2.5 text-ink placeholder:text-ink-300 focus:outline-none focus:border-ink-300 resize-none"
          />
        </div>

        <div className="flex items-center justify-between mt-3">
          <button
            onClick={handleDraft}
            disabled={drafting}
            className="flex items-center gap-1.5 text-xs font-medium text-ink-400 hover:text-ink border border-ink-100 hover:border-ink-300 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
          >
            {drafting ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
            Draft from record
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="text-xs font-medium text-ink-400 hover:text-ink px-4 py-2 rounded-lg hover:bg-parchment transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => canConfirm && onConfirm(reason.trim())}
              disabled={!canConfirm}
              className="text-xs font-medium text-white bg-ink px-4 py-2 rounded-lg hover:bg-ink-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Archive
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
