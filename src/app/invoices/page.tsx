'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import { fetchInvoices, setInvoiceStatus, snapshotToClient } from '@/lib/invoices-client'
import type { Invoice, InvoiceStatus, InvoiceKind } from '@/types'
import { formatDate, formatCurrency } from '@/lib/utils'
import { Download } from 'lucide-react'
import InvoiceEditModal from '@/components/InvoiceEditModal'

const PAGE_SIZE = 30

const STATUS_TABS: { id: InvoiceStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'finalized', label: 'Finalized' },
  { id: 'sent', label: 'Sent' },
  { id: 'paid', label: 'Paid' },
]

const TYPE_TABS: { id: InvoiceKind | 'all'; label: string }[] = [
  { id: 'all', label: 'All types' },
  { id: 'invoice', label: 'Invoice' },
  { id: 'deposit', label: 'Deposit' },
]

// draft → finalized → sent → paid
const NEXT_STATUS: Record<InvoiceStatus, InvoiceStatus | null> = {
  draft: 'finalized',
  finalized: 'sent',
  sent: 'paid',
  paid: null,
}
const NEXT_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: 'Finalize',
  finalized: 'Mark Sent',
  sent: 'Mark Paid',
  paid: '',
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const cls = status === 'paid' ? 'bg-sage/10 text-sage'
    : status === 'sent' ? 'bg-gold/10 text-gold-dark'
    : status === 'finalized' ? 'bg-amber-50 text-amber-700'
    : 'bg-parchment text-ink-300'
  const label = status === 'paid' ? 'Paid' : status === 'sent' ? 'Sent' : status === 'finalized' ? 'Finalized' : 'Draft'
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cls}`}>{label}</span>
}

function FilterTabs<T extends string>({ tabs, value, onChange }: {
  tabs: { id: T; label: string }[]; value: T; onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => onChange(tab.id)}
          className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
            value === tab.id ? 'bg-ink text-cream border-ink' : 'border-ink-100 text-ink-400 hover:border-ink-300'
          }`}>
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export default function InvoicesPage() {
  const { engagements } = useStore()
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<InvoiceKind | 'all'>('all')
  const [rows, setRows] = useState<Invoice[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchInvoices({
      status: statusFilter === 'all' ? undefined : statusFilter,
      type: typeFilter === 'all' ? undefined : typeFilter,
      offset: 0,
      limit: PAGE_SIZE,
    }).then(({ rows: newRows, count: total }) => {
      if (cancelled) return
      setRows(newRows)
      setCount(total)
    }).catch(err => console.error('fetchInvoices:', err))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [statusFilter, typeFilter])

  async function loadMore() {
    setLoadingMore(true)
    try {
      const { rows: more } = await fetchInvoices({
        status: statusFilter === 'all' ? undefined : statusFilter,
        type: typeFilter === 'all' ? undefined : typeFilter,
        offset: rows.length,
        limit: PAGE_SIZE,
      })
      setRows(prev => [...prev, ...more])
    } finally {
      setLoadingMore(false)
    }
  }

  async function handleAdvanceStatus(inv: Invoice) {
    const status = NEXT_STATUS[inv.status]
    if (!status) return
    setUpdatingId(inv.id)
    try {
      await setInvoiceStatus(inv, status)
      const now = new Date().toISOString()
      setRows(prev => prev.map(r => r.id === inv.id ? {
        ...r, status,
        finalized_at: status === 'finalized' ? now : r.finalized_at,
        sent_at: status === 'sent' ? now : r.sent_at,
        paid_at: status === 'paid' ? now : r.paid_at,
      } : r))
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleDownload(inv: Invoice) {
    setDownloadingId(inv.id)
    try {
      const { generateInvoice, generateDepositInvoice } = await import('@/lib/documents')
      const { fetchBusinessProfile } = await import('@/lib/business-client')
      const client = snapshotToClient(inv)
      const business = await fetchBusinessProfile()
      const blob = inv.type === 'deposit'
        ? await generateDepositInvoice(client, inv.invoice_number, business)
        : await generateInvoice(client, inv.invoice_number, business)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${inv.invoice_number.toLowerCase()}-${inv.organization.toLowerCase().replace(/\s+/g, '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloadingId(null)
    }
  }

  function engagementHref(engagementId?: string): string | null {
    if (!engagementId) return null
    const eng = engagements.find(e => e.id === engagementId)
    if (!eng) return `/engagements/${engagementId}`
    return eng.section === 'wrap-up' ? `/wrap-up/${engagementId}` : `/engagements/${engagementId}`
  }

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-ink">Invoices</h1>
        <p className="text-ink-400 text-sm mt-1">{count} total</p>
        <div className="accent-line mt-3 w-24" />
      </div>

      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <FilterTabs tabs={STATUS_TABS} value={statusFilter} onChange={setStatusFilter} />
        <FilterTabs tabs={TYPE_TABS} value={typeFilter} onChange={setTypeFilter} />
      </div>

      {loading ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink-400">No invoices yet.</p>
      ) : (
        <div className="bg-white border border-ink-100 rounded-2xl overflow-hidden">
          <div className="divide-y divide-ink-100">
            {rows.map(inv => {
              const href = engagementHref(inv.engagement_id)
              return (
                <div key={inv.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-24 flex-shrink-0">
                    <span className="font-mono text-sm text-ink-700">{inv.invoice_number}</span>
                  </div>
                  <div className="w-16 flex-shrink-0">
                    <span className="text-[10px] uppercase tracking-widest text-ink-300 font-semibold">
                      {inv.type === 'deposit' ? 'Deposit' : 'Invoice'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    {href ? (
                      <Link href={href} className="text-sm font-medium text-ink hover:text-gold-dark transition-colors truncate block">
                        {inv.organization}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium text-ink truncate block">{inv.organization}</span>
                    )}
                    <span className="text-xs text-ink-300">
                      Issued {formatDate(inv.created_at)}{inv.due_at ? ` · Due ${formatDate(inv.due_at)}` : ''}
                    </span>
                  </div>
                  <div className="w-24 flex-shrink-0 text-right">
                    <span className="text-sm font-semibold text-ink">{formatCurrency(inv.amount)}</span>
                  </div>
                  <div className="w-20 flex-shrink-0 flex justify-center">
                    <StatusBadge status={inv.status} />
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {inv.status !== 'paid' && (
                      <button
                        onClick={() => setEditingInvoice(inv)}
                        className="text-xs font-medium text-ink-400 hover:text-ink border border-ink-100 hover:border-ink-300 rounded-lg px-2.5 py-1.5 transition-all"
                      >
                        Edit
                      </button>
                    )}
                    {inv.status !== 'paid' && (
                      <button
                        onClick={() => handleAdvanceStatus(inv)}
                        disabled={updatingId === inv.id}
                        className="text-xs font-medium text-ink-400 hover:text-ink border border-ink-100 hover:border-ink-300 rounded-lg px-2.5 py-1.5 transition-all disabled:opacity-40"
                      >
                        {NEXT_STATUS_LABEL[inv.status]}
                      </button>
                    )}
                    <button
                      onClick={() => handleDownload(inv)}
                      disabled={downloadingId === inv.id}
                      className="text-ink-400 hover:text-ink border border-ink-100 hover:border-ink-300 rounded-lg p-1.5 transition-all disabled:opacity-40"
                      title="Download"
                    >
                      <Download size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!loading && rows.length < count && (
        <div className="mt-4 flex justify-center">
          <button onClick={loadMore} disabled={loadingMore}
            className="text-xs font-medium text-ink-400 hover:text-ink border border-ink-100 hover:border-ink-300 rounded-lg px-4 py-2 transition-all disabled:opacity-40">
            {loadingMore ? 'Loading…' : `Load more (${count - rows.length} remaining)`}
          </button>
        </div>
      )}

      {editingInvoice && (
        <InvoiceEditModal
          invoice={editingInvoice}
          onClose={() => setEditingInvoice(null)}
          onSaved={updated => setRows(prev => prev.map(r => r.id === updated.id ? updated : r))}
        />
      )}
    </div>
  )
}
