'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { fetchContractTemplateById, updateContractTemplate, deleteContractTemplate } from '@/lib/contract-templates-client'
import type { ContractTemplate, ContractTemplateBlock } from '@/types'
import { ArrowLeft, Trash2, ChevronUp, ChevronDown, Plus, Download, Info } from 'lucide-react'

const BLOCK_TYPE_LABELS: Record<ContractTemplateBlock['type'], string> = {
  heading: 'Heading',
  paragraph: 'Paragraph',
  key_value: 'Key / Value line',
  bullet_list: 'Bullet list',
  line_list: 'Plain line list',
}

const MERGE_FIELDS: { tag: string; note: string }[] = [
  { tag: 'organization', note: 'Client organization name' },
  { tag: 'contact_name', note: 'Primary contact, first + last' },
  { tag: 'contact_title', note: '' },
  { tag: 'contact_email', note: '' },
  { tag: 'contact_phone', note: '' },
  { tag: 'event_name', note: '' },
  { tag: 'event_date', note: 'Formatted, e.g. Sep 15, 2026' },
  { tag: 'event_city', note: '' },
  { tag: 'event_location', note: '' },
  { tag: 'fee', note: 'Pre-formatted currency, e.g. $19,500 — do not add your own $' },
  { tag: 'travel_fee', note: 'Raw text (often "TBD") — add your own $ if you want one, it is not automatic' },
  { tag: 'total_program_fee', note: 'Pre-formatted currency' },
  { tag: 'deposit_due', note: 'Pre-formatted currency' },
  { tag: 'balance_due', note: 'Pre-formatted currency' },
  { tag: 'business_name', note: 'From Settings > Billing' },
  { tag: 'business_address', note: 'From Settings > Billing' },
  { tag: 'date', note: "Today's date" },
]

function newBlockOfType(type: ContractTemplateBlock['type']): ContractTemplateBlock {
  switch (type) {
    case 'heading': return { type: 'heading', text: 'New Section', rule: true }
    case 'paragraph': return { type: 'paragraph', text: '' }
    case 'key_value': return { type: 'key_value', text: 'LABEL: {{fee}}' }
    case 'bullet_list': return { type: 'bullet_list', items: [] }
    case 'line_list': return { type: 'line_list', items: [] }
  }
}

function BlockEditor({ block, onChange }: { block: ContractTemplateBlock; onChange: (b: ContractTemplateBlock) => void }) {
  if (block.type === 'heading') {
    return (
      <div className="space-y-2">
        <input value={block.text} onChange={ev => onChange({ ...block, text: ev.target.value })}
          placeholder="Section heading"
          className="w-full text-sm font-medium bg-parchment border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-gold/40 text-ink" />
        <label className="flex items-center gap-2 text-xs text-ink-400">
          <input type="checkbox" checked={block.rule} onChange={ev => onChange({ ...block, rule: ev.target.checked })} />
          Start new section (hairline divider above)
        </label>
      </div>
    )
  }
  if (block.type === 'paragraph') {
    return (
      <textarea value={block.text} onChange={ev => onChange({ ...block, text: ev.target.value })}
        placeholder="Paragraph text — use {{merge_fields}} for per-document values"
        rows={3}
        className="w-full text-sm bg-parchment border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-gold/40 text-ink resize-none" />
    )
  }
  if (block.type === 'key_value') {
    return (
      <div className="flex items-center gap-2">
        <input value={block.text} onChange={ev => onChange({ ...block, text: ev.target.value })}
          placeholder="LABEL: {{merge_field}}"
          className="flex-1 text-sm bg-parchment border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-gold/40 text-ink" />
        <select value={block.emphasis ?? 'strong'} onChange={ev => onChange({ ...block, emphasis: ev.target.value as 'strong' | 'muted' })}
          className="text-xs bg-parchment border border-ink-100 rounded-lg px-2 py-2 outline-none focus:border-gold/40 text-ink-500">
          <option value="strong">Strong (ink)</option>
          <option value="muted">Muted (gray)</option>
        </select>
      </div>
    )
  }
  // bullet_list / line_list — one item per line
  return (
    <textarea value={block.items.join('\n')}
      onChange={ev => onChange({ ...block, items: ev.target.value.split('\n') } as ContractTemplateBlock)}
      placeholder="One item per line"
      rows={4}
      className="w-full text-sm bg-parchment border border-ink-100 rounded-lg px-3 py-2 outline-none focus:border-gold/40 text-ink resize-none" />
  )
}

export default function ContractTemplateEditorPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [template, setTemplate] = useState<ContractTemplate | null>(null)
  const [name, setName] = useState('')
  const [blocks, setBlocks] = useState<ContractTemplateBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [addType, setAddType] = useState<ContractTemplateBlock['type']>('paragraph')
  const [previewing, setPreviewing] = useState(false)
  const [showMergeFields, setShowMergeFields] = useState(false)

  useEffect(() => {
    fetchContractTemplateById(id).then(t => {
      setTemplate(t)
      setName(t.name)
      setBlocks(t.blocks)
    }).catch(err => console.error('fetchContractTemplateById:', err))
      .finally(() => setLoading(false))
  }, [id])

  function updateBlock(i: number, updated: ContractTemplateBlock) {
    setBlocks(prev => prev.map((b, idx) => idx === i ? updated : b))
  }
  function removeBlock(i: number) {
    setBlocks(prev => prev.filter((_, idx) => idx !== i))
  }
  function moveBlock(i: number, dir: -1 | 1) {
    setBlocks(prev => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }
  function addBlock() {
    setBlocks(prev => [...prev, newBlockOfType(addType)])
  }

  async function handleSave() {
    setSaving(true)
    try {
      const updated = await updateContractTemplate(id, { name, blocks })
      setTemplate(updated)
    } finally {
      setSaving(false)
    }
  }

  async function handleMakeDefault() {
    const updated = await updateContractTemplate(id, { is_default: true })
    setTemplate(updated)
  }

  async function handleDelete() {
    try {
      await deleteContractTemplate(id)
      router.push('/contracts/templates')
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function handlePreview() {
    setPreviewing(true)
    try {
      const { generateContract } = await import('@/lib/documents')
      const { fetchBusinessProfile } = await import('@/lib/business-client')
      const business = await fetchBusinessProfile()
      const sampleClient: any = {
        id: 'preview',
        organization: 'Acme Example Co',
        event_name: 'Sample Keynote',
        event_date: new Date().toISOString().slice(0, 10),
        event_city: 'Austin, TX',
        event_location: 'Sample Convention Center',
        event_format: 'in_person',
        fee: 15000,
        deposit_amount: 7500,
        travel_fee: 'TBD',
        run_of_show: [],
        contacts: [{
          id: '1', first_name: 'Jane', last_name: 'Doe', title: 'Events Director',
          email: 'jane@example.com', phone: '555-123-4567',
          is_current_point_of_contact: true, role: 'primary', status: 'client', watching: false,
        }],
      }
      const blob = await generateContract(sampleClient, business, blocks)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `preview-${name.toLowerCase().replace(/\s+/g, '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setPreviewing(false)
    }
  }

  if (loading) return <div className="p-8 max-w-3xl mx-auto"><p className="text-sm text-ink-400">Loading…</p></div>
  if (!template) return <div className="p-8 max-w-3xl mx-auto"><p className="text-sm text-ink-400">Template not found.</p></div>

  return (
    <div className="p-8 max-w-3xl mx-auto animate-fade-in">
      <Link href="/contracts/templates" className="flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink transition-colors mb-4">
        <ArrowLeft size={12} /> Back to Templates
      </Link>

      <div className="flex items-start justify-between gap-3 mb-6">
        <input value={name} onChange={ev => setName(ev.target.value)}
          className="font-display text-2xl font-semibold text-ink bg-transparent border-b border-transparent hover:border-ink-100 focus:border-gold/40 outline-none flex-1" />
        {template.is_default && (
          <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gold/10 text-gold-dark mt-2">Default</span>
        )}
      </div>

      <div className="flex items-center gap-2 mb-6">
        <button onClick={handleSave} disabled={saving}
          className="text-xs font-medium text-white bg-ink hover:bg-ink-700 rounded-lg px-3 py-1.5 transition-all disabled:opacity-40">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={handlePreview} disabled={previewing}
          className="flex items-center gap-1.5 text-xs font-medium text-ink-400 hover:text-ink border border-ink-100 hover:border-ink-300 rounded-lg px-3 py-1.5 transition-all disabled:opacity-40">
          <Download size={11} /> {previewing ? 'Generating…' : 'Preview PDF'}
        </button>
        {!template.is_default && (
          <button onClick={handleMakeDefault}
            className="text-xs font-medium text-ink-400 hover:text-ink border border-ink-100 hover:border-ink-300 rounded-lg px-3 py-1.5 transition-all">
            Make Default
          </button>
        )}
        <button onClick={() => setShowMergeFields(v => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-ink-400 hover:text-ink border border-ink-100 hover:border-ink-300 rounded-lg px-3 py-1.5 transition-all ml-auto">
          <Info size={11} /> Merge fields
        </button>
        {!template.is_default && (
          <button onClick={handleDelete}
            className="text-ink-300 hover:text-red-400 border border-ink-100 hover:border-red-200 rounded-lg p-1.5 transition-all">
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {showMergeFields && (
        <div className="bg-parchment/60 border border-ink-100 rounded-xl p-4 mb-6">
          <p className="text-xs font-semibold text-ink-500 mb-2">Available in any block, as {'{{tag}}'}:</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            {MERGE_FIELDS.map(f => (
              <div key={f.tag} className="text-xs">
                <code className="text-gold-dark">{'{{' + f.tag + '}}'}</code>
                {f.note && <span className="text-ink-300"> — {f.note}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3 mb-4">
        {blocks.map((block, i) => (
          <div key={i} className="bg-white border border-ink-100 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-300">{BLOCK_TYPE_LABELS[block.type]}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => moveBlock(i, -1)} disabled={i === 0} className="text-ink-300 hover:text-ink-500 disabled:opacity-30 p-0.5"><ChevronUp size={13} /></button>
                <button onClick={() => moveBlock(i, 1)} disabled={i === blocks.length - 1} className="text-ink-300 hover:text-ink-500 disabled:opacity-30 p-0.5"><ChevronDown size={13} /></button>
                <button onClick={() => removeBlock(i)} className="text-ink-300 hover:text-red-400 p-0.5 ml-1"><Trash2 size={12} /></button>
              </div>
            </div>
            <BlockEditor block={block} onChange={b => updateBlock(i, b)} />
          </div>
        ))}
        {blocks.length === 0 && (
          <p className="text-sm text-ink-300 italic px-1">No blocks yet — add one below.</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <select value={addType} onChange={ev => setAddType(ev.target.value as ContractTemplateBlock['type'])}
          className="text-xs bg-white border border-ink-100 rounded-lg px-2.5 py-2 outline-none focus:border-gold/40 text-ink-500">
          {Object.entries(BLOCK_TYPE_LABELS).map(([type, label]) => (
            <option key={type} value={type}>{label}</option>
          ))}
        </select>
        <button onClick={addBlock}
          className="flex items-center gap-1.5 text-xs text-ink-300 hover:text-ink-500 border border-dashed border-ink-200 hover:border-gold/40 rounded-lg px-3 py-2 transition-all">
          <Plus size={11} /> Add block
        </button>
      </div>
    </div>
  )
}
