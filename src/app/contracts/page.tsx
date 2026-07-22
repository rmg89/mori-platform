'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import { fetchContracts, setContractStatus, snapshotToClient } from '@/lib/contracts-client'
import type { Contract, ContractOrigin, ContractStatus } from '@/types'
import { formatDate, formatCurrency } from '@/lib/utils'
import { Download, Search } from 'lucide-react'
import ContractEditModal from '@/components/ContractEditModal'

const PAGE_SIZE = 30

const STATUS_TABS: { id: ContractStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'finalized', label: 'Finalized' },
  { id: 'sent', label: 'Sent' },
  { id: 'signed', label: 'Signed' },
]

// draft → finalized → sent → signed
const NEXT_STATUS: Record<ContractStatus, ContractStatus | null> = {
  draft: 'finalized',
  finalized: 'sent',
  sent: 'signed',
  signed: null,
}
const NEXT_STATUS_LABEL: Record<ContractStatus, string> = {
  draft: 'Finalize',
  finalized: 'Mark Sent',
  sent: 'Mark Signed',
  signed: '',
}

function StatusBadge({ status }: { status: ContractStatus }) {
  const cls = status === 'signed' ? 'bg-sage/10 text-sage'
    : status === 'sent' ? 'bg-gold/10 text-gold-dark'
    : status === 'finalized' ? 'bg-amber-50 text-amber-700'
    : 'bg-parchment text-ink-300'
  const label = status === 'signed' ? 'Signed' : status === 'sent' ? 'Sent' : status === 'finalized' ? 'Finalized' : 'Draft'
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cls}`}>{label}</span>
}

function OriginBadge({ origin }: { origin: ContractOrigin }) {
  const cls = origin === 'drafted' ? 'bg-gold/10 text-gold-dark' : 'bg-sage/10 text-sage'
  return <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${cls}`}>{origin === 'drafted' ? 'We draft' : 'From client'}</span>
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

export default function ContractsPage() {
  const { engagements } = useStore()
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<Contract[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [editingContract, setEditingContract] = useState<Contract | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const timeout = setTimeout(() => {
      fetchContracts({
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: search.trim() || undefined,
        offset: 0,
        limit: PAGE_SIZE,
      }).then(({ rows: newRows, count: total }) => {
        if (cancelled) return
        setRows(newRows)
        setCount(total)
      }).catch(err => console.error('fetchContracts:', err))
        .finally(() => { if (!cancelled) setLoading(false) })
    }, search ? 250 : 0)
    return () => { cancelled = true; clearTimeout(timeout) }
  }, [statusFilter, search])

  async function loadMore() {
    setLoadingMore(true)
    try {
      const { rows: more } = await fetchContracts({
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: search.trim() || undefined,
        offset: rows.length,
        limit: PAGE_SIZE,
      })
      setRows(prev => [...prev, ...more])
    } finally {
      setLoadingMore(false)
    }
  }

  async function handleAdvanceStatus(contract: Contract) {
    const status = NEXT_STATUS[contract.status]
    if (!status) return
    setUpdatingId(contract.id)
    try {
      await setContractStatus(contract, status)
      const now = new Date().toISOString()
      setRows(prev => prev.map(r => r.id === contract.id ? {
        ...r, status,
        finalized_at: status === 'finalized' ? now : r.finalized_at,
        sent_at: status === 'sent' ? now : r.sent_at,
        signed_at: status === 'signed' ? now : r.signed_at,
      } : r))
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleDownload(contract: Contract) {
    setDownloadingId(contract.id)
    try {
      const { generateContract } = await import('@/lib/documents')
      const { fetchBusinessProfile } = await import('@/lib/business-client')
      const client = snapshotToClient(contract)
      const business = await fetchBusinessProfile()
      const blob = await generateContract(client, business)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${contract.contract_number.toLowerCase()}-${contract.organization.toLowerCase().replace(/\s+/g, '-')}.pdf`
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
        <h1 className="font-display text-3xl font-semibold text-ink">Contracts</h1>
        <p className="text-ink-400 text-sm mt-1">{count} total</p>
        <div className="accent-line mt-3 w-24" />
      </div>

      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <FilterTabs tabs={STATUS_TABS} value={statusFilter} onChange={setStatusFilter} />
        <div className="relative w-full sm:w-64">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search organization or contract #"
            className="w-full text-sm bg-white border border-ink-100 rounded-lg pl-8 pr-3 py-1.5 outline-none focus:border-gold/40 text-ink placeholder:text-ink-300 transition-all"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink-400">No contracts yet.</p>
      ) : (
        <div className="bg-white border border-ink-100 rounded-2xl overflow-hidden">
          <div className="divide-y divide-ink-100">
            {rows.map(contract => {
              const href = engagementHref(contract.engagement_id)
              return (
                <div key={contract.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-24 flex-shrink-0">
                    <span className="font-mono text-sm text-ink-700">{contract.contract_number}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {href ? (
                        <Link href={href} className="text-sm font-medium text-ink hover:text-gold-dark transition-colors truncate">
                          {contract.organization}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium text-ink truncate">{contract.organization}</span>
                      )}
                      <OriginBadge origin={contract.origin} />
                    </div>
                    <span className="text-xs text-ink-300">
                      {contract.label} · Created {formatDate(contract.created_at)}
                      {contract.snapshot.event_date ? ` · Event ${formatDate(contract.snapshot.event_date)}` : ''}
                    </span>
                  </div>
                  <div className="w-24 flex-shrink-0 text-right">
                    <span className="text-sm font-semibold text-ink">{contract.amount != null ? formatCurrency(contract.amount) : '—'}</span>
                  </div>
                  <div className="w-20 flex-shrink-0 flex justify-center">
                    {contract.origin === 'drafted' ? (
                      <StatusBadge status={contract.status} />
                    ) : (
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${contract.signed_file_url ? 'bg-sage/10 text-sage' : 'bg-parchment text-ink-300'}`}>
                        {contract.signed_file_url ? 'On File' : 'Awaiting'}
                      </span>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {contract.origin === 'drafted' ? (
                      <>
                        {contract.status !== 'signed' && (
                          <button
                            onClick={() => setEditingContract(contract)}
                            className="text-xs font-medium text-ink-400 hover:text-ink border border-ink-100 hover:border-ink-300 rounded-lg px-2.5 py-1.5 transition-all"
                          >
                            Edit
                          </button>
                        )}
                        {contract.status !== 'signed' && (
                          <button
                            onClick={() => handleAdvanceStatus(contract)}
                            disabled={updatingId === contract.id}
                            className="text-xs font-medium text-ink-400 hover:text-ink border border-ink-100 hover:border-ink-300 rounded-lg px-2.5 py-1.5 transition-all disabled:opacity-40"
                          >
                            {NEXT_STATUS_LABEL[contract.status]}
                          </button>
                        )}
                        <button
                          onClick={() => handleDownload(contract)}
                          disabled={downloadingId === contract.id}
                          className="text-ink-400 hover:text-ink border border-ink-100 hover:border-ink-300 rounded-lg p-1.5 transition-all disabled:opacity-40"
                          title="Download"
                        >
                          <Download size={13} />
                        </button>
                      </>
                    ) : contract.signed_file_url ? (
                      <a href={contract.signed_file_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-medium text-gold hover:underline border border-ink-100 hover:border-gold/30 rounded-lg px-2.5 py-1.5 transition-all">
                        View file
                      </a>
                    ) : (
                      <span className="text-xs text-ink-200 italic px-2.5 py-1.5">Upload from the engagement page</span>
                    )}
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

      {editingContract && (
        <ContractEditModal
          contract={editingContract}
          onClose={() => setEditingContract(null)}
          onSaved={updated => setRows(prev => prev.map(r => r.id === updated.id ? updated : r))}
        />
      )}
    </div>
  )
}
