'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { LifeBuoy, X, Check, AlertCircle, AlertTriangle } from 'lucide-react'
import {
  installErrorReporting,
  submitUserReport,
  getRecentErrors,
  getUserLabel,
  setUserLabel,
  addBreadcrumb,
  onErrorCaptured,
  type RecentError,
} from '@/lib/error-reporting'

interface Toast {
  id: number
  message: string
}

/** Plain-language version of an error, since the raw message is developer text. */
function toastMessage(error: RecentError): string {
  if (error.kind === 'render') return "This page hit an error and couldn't finish loading."
  if (error.kind === 'window' || error.kind === 'promise') return 'Something went wrong on this page.'
  if (error.httpStatus === 404) return "That record couldn't be found."
  if (error.method && error.method !== 'GET') return "That didn't save. Your change may not have been kept."
  return "Something didn't load. What you're seeing may be incomplete."
}

/**
 * Installs the global browser error handlers and renders the "Report a problem"
 * affordance. Mounted once from Providers, so it is present on every page.
 *
 * The modal portals to document.body: AppShell's header uses backdrop-blur and
 * pages use transform-based entrance animations, both of which create stacking
 * contexts a position:fixed child would otherwise be trapped inside.
 */
export default function ReportProblem() {
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [name, setName] = useState('')
  const [sent, setSent] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const pathname = usePathname()

  useEffect(() => {
    setMounted(true)
    return installErrorReporting()
  }, [])

  // One visible notice per failure. Capped and deduped by text so a page that
  // fires several failed requests at once doesn't bury the screen.
  useEffect(() => onErrorCaptured(error => {
    const message = toastMessage(error)
    const id = Date.now() + Math.random()
    setToasts(prev => (prev.some(t => t.message === message) ? prev : [...prev, { id, message }].slice(-3)))
    window.setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 9000)
  }), [])

  // Navigation is the cheapest useful breadcrumb: it turns "it broke" into
  // "it broke two clicks after they opened this engagement".
  useEffect(() => {
    addBreadcrumb(`Opened ${pathname}`)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    setName(getUserLabel())
    // Explicit focus rather than autoFocus: the trigger button unmounts focus
    // in the same render that mounts this, and the browser can win that race.
    const t = window.setTimeout(() => noteRef.current?.focus(), 0)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => { window.clearTimeout(t); window.removeEventListener('keydown', onKey) }
  }, [open])

  function handleSubmit() {
    if (!note.trim()) return
    if (name.trim()) setUserLabel(name)
    submitUserReport(note.trim())
    setSent(true)
    setNote('')
    window.setTimeout(() => { setOpen(false); setSent(false) }, 1600)
  }

  if (!mounted) return null

  const recent = open ? getRecentErrors() : []

  return createPortal(
    <>
      {/* Failure notices */}
      {toasts.length > 0 && (
        <div className="fixed bottom-16 right-4 z-[65] flex flex-col gap-2 max-w-xs">
          {toasts.map(t => (
            <div
              key={t.id}
              className="flex items-start gap-2 bg-white border border-red-100 rounded-xl shadow-md px-3.5 py-3"
            >
              <AlertTriangle size={13} className="text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-ink leading-snug">{t.message}</p>
                <button
                  onClick={() => { setToasts(prev => prev.filter(x => x.id !== t.id)); setOpen(true) }}
                  className="text-[11px] font-medium text-gold-dark hover:text-ink mt-1 transition-colors"
                >
                  Tell us what happened
                </button>
              </div>
              <button
                onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                className="text-ink-300 hover:text-ink transition-colors flex-shrink-0"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Trigger */}
      <button
        onClick={() => setOpen(true)}
        title="Report a problem"
        className="fixed bottom-4 right-4 z-[60] flex items-center gap-1.5 text-[11px] font-medium text-ink-400 bg-white/90 backdrop-blur-sm border border-ink-100 rounded-full pl-2.5 pr-3 py-1.5 shadow-sm hover:text-ink hover:shadow-md transition-all"
      >
        <LifeBuoy size={13} className="text-gold" />
        Report a problem
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-ink/25 backdrop-blur-[2px]">
          <div className="bg-white border border-ink-100 rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-start justify-between px-5 pt-5 pb-3">
              <div>
                <h2 className="font-display text-xl font-semibold text-ink leading-tight">Report a problem</h2>
                <p className="text-xs text-ink-400 mt-0.5">
                  What you were doing is enough. The page, the error and the steps get attached automatically.
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-ink-300 hover:text-ink transition-colors">
                <X size={16} />
              </button>
            </div>

            {sent ? (
              <div className="px-5 pb-6 pt-2 flex items-center gap-2 text-sm text-sage-dark">
                <Check size={15} /> Sent. Thank you.
              </div>
            ) : (
              <div className="px-5 pb-5 space-y-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1.5">
                    What happened
                  </label>
                  <textarea
                    ref={noteRef}
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    rows={4}
                    placeholder="I clicked Confirm on the Acme prospect and it just spun."
                    className="w-full text-sm bg-parchment border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-gold/40 text-ink placeholder:text-ink-300 transition-all resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1.5">
                    Your name
                  </label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="So we know who hit it"
                    className="w-full text-sm bg-parchment border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-gold/40 text-ink placeholder:text-ink-300 transition-all"
                  />
                </div>

                {recent.length > 0 && (
                  <div className="flex items-start gap-2 text-[11px] text-ink-400 bg-parchment border border-ink-100 rounded-lg px-3 py-2">
                    <AlertCircle size={12} className="text-gold mt-0.5 flex-shrink-0" />
                    <span>
                      {recent.length} recent error{recent.length === 1 ? '' : 's'} on this session will be attached.
                    </span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setOpen(false)}
                    className="text-sm font-medium text-ink-400 hover:text-ink px-4 py-2 rounded-lg hover:bg-parchment transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!note.trim()}
                    className="text-sm font-medium text-white bg-ink px-5 py-2 rounded-lg hover:bg-ink-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    Send report
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>,
    document.body,
  )
}
