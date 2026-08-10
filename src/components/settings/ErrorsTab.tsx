'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, MessageSquareWarning, ChevronRight, Check, RotateCcw, RefreshCw, Loader2,
} from 'lucide-react'
import { fetchErrorReports, setErrorResolved } from '@/lib/errors-client'
import type { ErrorReport } from '@/types'

interface Group {
  fingerprint: string
  latest: ErrorReport
  count: number
  reporters: string[]
  firstSeen: string
  lastSeen: string
  reports: ErrorReport[]
}

function groupReports(reports: ErrorReport[]): Group[] {
  const map = new Map<string, ErrorReport[]>()
  for (const r of reports) {
    const existing = map.get(r.fingerprint)
    if (existing) existing.push(r)
    else map.set(r.fingerprint, [r])
  }

  return Array.from(map.entries())
    .map(([fingerprint, rows]): Group => {
      // The API already returns newest-first, so rows[0] is the latest.
      const times = rows.map(r => r.created_at).sort()
      const labels = rows.map(r => r.user_label).filter((l): l is string => Boolean(l))
      return {
        fingerprint,
        latest: rows[0],
        count: rows.length,
        reporters: Array.from(new Set(labels)),
        firstSeen: times[0],
        lastSeen: times[times.length - 1],
        reports: rows,
      }
    })
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
}

const KIND_LABEL: Record<string, string> = {
  render: 'Page crash',
  promise: 'Unhandled error',
  window: 'Script error',
  api: 'Failed request',
  server: 'Server error',
  user_report: 'User report',
}

function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1">{label}</div>
      <div className="text-xs text-ink-600">{children}</div>
    </div>
  )
}

function GroupRow({ group, onTriage }: { group: Group; onTriage: (g: Group, resolved: boolean) => void }) {
  const [open, setOpen] = useState(false)
  const { latest } = group
  const isUserReport = latest.kind === 'user_report'
  const resolved = Boolean(latest.resolved_at)

  return (
    <div className="border border-ink-100 rounded-xl bg-white overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-parchment/60 transition-colors"
      >
        <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUserReport ? 'bg-gold/15' : 'bg-red-50'
        }`}>
          {isUserReport
            ? <MessageSquareWarning size={12} className="text-gold-dark" />
            : <AlertTriangle size={12} className="text-red-500" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-ink-400">
              {KIND_LABEL[latest.kind] ?? latest.kind}
            </span>
            {group.count > 1 && (
              <span className="text-[10px] font-bold text-ink-500 bg-ink-50 rounded-full px-1.5">
                ×{group.count}
              </span>
            )}
            {resolved && (
              <span className="text-[10px] font-medium text-sage-dark bg-sage/10 rounded-full px-1.5">resolved</span>
            )}
          </div>

          <div className="text-sm text-ink font-medium truncate">
            {isUserReport ? latest.user_note : latest.message}
          </div>

          <div className="text-[11px] text-ink-400 mt-0.5 truncate">
            {latest.route ?? '—'}
            {' · '}{relative(group.lastSeen)}
            {group.reporters.length > 0 && ` · ${group.reporters.join(', ')}`}
          </div>
        </div>

        <ChevronRight
          size={14}
          className={`mt-1.5 flex-shrink-0 text-ink-300 transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-ink-100 bg-parchment/40 space-y-3">
          {isUserReport && latest.user_note && (
            <Field label="What they wrote">
              <p className="whitespace-pre-wrap">{latest.user_note}</p>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Message">{latest.message}</Field>
            <Field label="Page">{latest.url ?? latest.route ?? '—'}</Field>
            {latest.action && <Field label="Action">{latest.action}</Field>}
            {latest.http_status != null && <Field label="Status">{latest.http_status}</Field>}
            <Field label="First seen">{new Date(group.firstSeen).toLocaleString()}</Field>
            <Field label="Last seen">{new Date(group.lastSeen).toLocaleString()}</Field>
            {latest.session_id && (
              <Field label="Session">
                <span className="font-mono text-[10px]">{latest.session_id.slice(0, 8)}</span>
              </Field>
            )}
            {latest.user_agent && (
              <Field label="Browser">
                <span className="text-[10px] break-all">{latest.user_agent}</span>
              </Field>
            )}
          </div>

          {latest.breadcrumbs && latest.breadcrumbs.length > 0 && (
            <Field label="Steps before">
              <ol className="space-y-0.5">
                {latest.breadcrumbs.slice(-10).map((b, i) => (
                  <li key={i} className="text-[11px] text-ink-500">
                    <span className="text-ink-300 font-mono mr-1.5">
                      {new Date(b.at).toLocaleTimeString()}
                    </span>
                    {b.label}
                  </li>
                ))}
              </ol>
            </Field>
          )}

          {latest.stack && (
            <Field label="Stack">
              <pre className="text-[10px] font-mono text-ink-500 bg-white border border-ink-100 rounded-lg p-2.5 overflow-x-auto max-h-52">
                {latest.stack}
              </pre>
            </Field>
          )}

          {latest.context && Object.keys(latest.context).length > 0 && (
            <Field label="Context">
              <pre className="text-[10px] font-mono text-ink-500 bg-white border border-ink-100 rounded-lg p-2.5 overflow-x-auto max-h-52">
                {JSON.stringify(latest.context, null, 2)}
              </pre>
            </Field>
          )}

          <div className="flex justify-end pt-1">
            <button
              onClick={() => onTriage(group, !resolved)}
              className="flex items-center gap-1.5 text-xs font-medium text-ink-400 hover:text-ink border border-ink-100 bg-white px-3 py-1.5 rounded-lg transition-all"
            >
              {resolved ? <><RotateCcw size={12} /> Reopen</> : <><Check size={12} /> Mark resolved</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ErrorsTab() {
  const [reports, setReports] = useState<ErrorReport[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showResolved, setShowResolved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setReports(await fetchErrorReports(showResolved))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [showResolved])

  useEffect(() => { void load() }, [load])

  const groups = useMemo(() => groupReports(reports), [reports])
  const openCount = groups.filter(g => !g.latest.resolved_at).length

  async function handleTriage(group: Group, resolved: boolean) {
    try {
      await setErrorResolved({ fingerprint: group.fingerprint }, resolved)
      await load()
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink leading-tight">Errors</h2>
          <p className="text-xs text-ink-400 mt-0.5">
            Everything that failed for anyone using the platform, captured automatically. Grouped by cause.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-ink-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={e => setShowResolved(e.target.checked)}
              className="accent-gold"
            />
            Include resolved
          </label>
          <button
            onClick={() => void load()}
            className="flex items-center gap-1.5 text-xs font-medium text-ink-400 hover:text-ink border border-ink-100 bg-white px-3 py-1.5 rounded-lg transition-all"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {loadError && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-ink-400 py-8 justify-center">
          <Loader2 size={14} className="animate-spin" /> Loading
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-ink-100 rounded-xl">
          <Check size={20} className="text-sage-dark mx-auto mb-2" />
          <p className="text-sm text-ink-400">
            {showResolved ? 'Nothing recorded.' : 'No open errors.'}
          </p>
        </div>
      ) : (
        <>
          <div className="text-[11px] text-ink-400">
            {groups.length} group{groups.length === 1 ? '' : 's'}
            {!showResolved && ` · ${openCount} open`}
            {' · '}{reports.length} report{reports.length === 1 ? '' : 's'}
          </div>
          <div className="space-y-2">
            {groups.map(g => <GroupRow key={g.fingerprint} group={g} onTriage={handleTriage} />)}
          </div>
        </>
      )}
    </div>
  )
}
