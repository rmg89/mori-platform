'use client'
import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface ConfirmModalProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  requireText?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  open, title, description, confirmLabel, requireText, danger, onConfirm, onCancel,
}: ConfirmModalProps) {
  const [input, setInput] = useState('')
  if (!open) return null

  const canConfirm = !requireText || input === requireText

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-4" onClick={onCancel}>
      <div className="bg-white border border-ink-100 rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={ev => ev.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className={danger ? 'text-red-500' : 'text-amber-500'} />
            <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
          </div>
          <button onClick={onCancel} className="text-ink-300 hover:text-ink-500 transition-colors">
            <X size={16} />
          </button>
        </div>
        <p className="text-sm text-ink-400 mb-4">{description}</p>
        {requireText && (
          <input
            type="text"
            value={input}
            onChange={ev => setInput(ev.target.value)}
            placeholder={`Type ${requireText} to confirm`}
            autoFocus
            className="w-full text-sm bg-parchment/40 border border-ink-100 rounded-lg px-3 py-2 mb-4 text-ink placeholder:text-ink-300 focus:outline-none focus:border-ink-300"
          />
        )}
        <div className="flex items-center justify-end gap-2">
          <button onClick={onCancel}
            className="text-xs font-medium text-ink-400 hover:text-ink px-4 py-2 rounded-lg hover:bg-parchment transition-all">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`text-xs font-medium text-white px-4 py-2 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              danger ? 'bg-red-500 hover:bg-red-600' : 'bg-ink hover:bg-ink-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
