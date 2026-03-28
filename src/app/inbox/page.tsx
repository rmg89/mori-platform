'use client'
import { useState } from 'react'
import { MOCK_ENGAGEMENTS } from '@/lib/mock-data'
import { Engagement, CommEntry, primaryContact } from '@/types'
import { formatDate, getInitials } from '@/lib/utils'
import { Sparkles, Send, Mail, MailOpen, Building, RefreshCw, ExternalLink, AlertTriangle, MessageSquare, PhoneCall, Tag, FileText, Globe } from 'lucide-react'
import Link from 'next/link'

// Inbox surfaces all engagements that have recent inbound comms needing response
// or recent activity — this is the CRM view, not a raw email inbox

const COMM_ICONS: Record<string, any> = {
  email_inbound: Mail, email_outbound: Mail, note: MessageSquare,
  stage_change: Tag, document_sent: FileText, call: PhoneCall, other_channel: Globe,
}

export default function InboxPage() {
  const engagements = MOCK_ENGAGEMENTS

  // Surface engagements with recent comms, sorted by last activity
  const threads = [...engagements]
    .filter(e => e.comms.length > 0)
    .sort((a, b) => a.last_activity_at > b.last_activity_at ? -1 : 1)

  const [selected, setSelected] = useState<Engagement>(threads[0])
  const [draftReply, setDraftReply] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiGenerated, setAiGenerated] = useState(false)

  const pc = selected ? primaryContact(selected) : null
  const sortedComms = selected ? [...selected.comms].sort((a, b) => a.date > b.date ? 1 : -1) : []
  const needsResponse = selected?.comms.some(c => c.needs_response)

  const handleAiDraft = async () => {
    if (!selected) return
    setAiLoading(true)
    setAiGenerated(false)
    try {
      const lastInbound = [...selected.comms].reverse().find(c => c.type === 'email_inbound')
      const res = await fetch('/api/ai/email-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thread_subject: lastInbound?.subject ?? selected.event_name ?? selected.organization,
          contact_name: pc ? `${pc.first_name} ${pc.last_name}` : selected.organization,
          contact_org: selected.organization,
          last_message: lastInbound?.body ?? '',
        }),
      })
      const data = await res.json()
      setDraftReply(data.reply || '')
      setAiGenerated(true)
    } catch {
      setDraftReply('Error generating reply. Please check your API key.')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="flex h-full animate-fade-in">
      {/* Thread list */}
      <div className="w-80 flex-shrink-0 border-r border-ink-100 flex flex-col bg-white">
        <div className="px-5 py-4 border-b border-ink-100">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-xl font-semibold">CRM</h1>
            <button className="p-1.5 rounded-lg hover:bg-parchment text-ink-400 transition-all">
              <RefreshCw size={14} />
            </button>
          </div>
          <p className="text-xs text-ink-400 mt-0.5">
            Communication timeline by engagement
            <span className="ml-1.5 px-1.5 py-0.5 bg-gold/15 text-gold rounded text-[10px] font-medium">Demo</span>
          </p>
        </div>

        <div className="flex-1 overflow-auto divide-y divide-ink-50">
          {threads.map(e => {
            const contact = primaryContact(e)
            const hasAlert = e.alerts.some(a => a.severity === 'high')
            const lastComm = [...e.comms].sort((a, b) => a.date > b.date ? -1 : 1)[0]
            const needsResp = e.comms.some(c => c.needs_response)
            const isSelected = selected?.id === e.id

            return (
              <button key={e.id} onClick={() => { setSelected(e); setDraftReply(''); setAiGenerated(false) }}
                className={`w-full text-left px-4 py-3.5 hover:bg-parchment transition-all ${isSelected ? 'bg-parchment border-l-2 border-gold' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${needsResp ? 'bg-ink-800 text-gold' : 'bg-ink-100 text-ink-400'}`}>
                    {contact ? getInitials(contact.first_name, contact.last_name) : e.organization[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-sm truncate ${needsResp ? 'text-ink font-semibold' : 'text-ink-500'}`}>
                        {e.organization}
                      </p>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {hasAlert && <AlertTriangle size={10} className="text-red-400" />}
                        {needsResp && <div className="w-2 h-2 rounded-full bg-gold" />}
                      </div>
                    </div>
                    <p className="text-xs text-ink-400 truncate mt-0.5">{lastComm?.subject || e.event_name}</p>
                    <p className="text-[10px] text-ink-300 mt-0.5">{formatDate(e.last_activity_at, 'MMM d')}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Detail pane */}
      {selected ? (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-ink-100 bg-white flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-ink">{selected.event_name || selected.organization}</h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="flex items-center gap-1 text-xs text-ink-400">
                  <Building size={11} /> {selected.organization}
                </span>
                {pc && (
                  <span className="flex items-center gap-1 text-xs text-ink-400">
                    <Mail size={11} /> {pc.email}
                  </span>
                )}
              </div>
              {selected.alerts.length > 0 && (
                <div className="flex gap-2 mt-2">
                  {selected.alerts.map((a, i) => (
                    <span key={i} className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-red-50 border border-red-100 text-red-500">
                      <AlertTriangle size={9} /> {a.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <Link href={`/pipeline/${selected.id}`}
              className="flex items-center gap-1.5 text-xs text-gold border border-gold/30 rounded-lg px-3 py-1.5 hover:bg-gold/10 transition-all flex-shrink-0">
              View Engagement <ExternalLink size={11} />
            </Link>
          </div>

          {/* Timeline */}
          <div className="flex-1 overflow-auto p-6 space-y-4">
            {sortedComms.map(entry => (
              <CommBubble key={entry.id} entry={entry} />
            ))}
          </div>

          {/* Reply area */}
          {needsResponse && (
            <div className="border-t border-ink-100 bg-white p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-ink">Reply</p>
                <button onClick={handleAiDraft} disabled={aiLoading}
                  className="flex items-center gap-2 px-3 py-1.5 bg-ink text-cream text-xs rounded-lg hover:bg-ink-700 transition-all disabled:opacity-60">
                  <Sparkles size={12} className={aiLoading ? 'animate-pulse' : ''} />
                  {aiLoading ? 'Drafting…' : aiGenerated ? 'Regenerate' : 'Draft with AI'}
                </button>
              </div>
              {aiGenerated && (
                <p className="mb-2 flex items-center gap-1.5 text-xs text-gold">
                  <Sparkles size={11} /> AI draft — review before sending
                </p>
              )}
              <textarea value={draftReply} onChange={e => setDraftReply(e.target.value)}
                placeholder="Write your reply..."
                className="w-full h-28 text-sm text-ink bg-parchment border border-ink-100 rounded-xl p-4 outline-none focus:border-gold/40 resize-none placeholder:text-ink-300 transition-all" />
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-ink-400">
                  {/* TODO: Wire to Microsoft Graph API sendMail */}
                  Sends via Microsoft 365
                </p>
                <button disabled={!draftReply.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-ink text-cream text-sm rounded-lg hover:bg-ink-700 transition-all disabled:opacity-40">
                  <Send size={14} /> Send Reply
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-ink-400">
          <div className="text-center">
            <MailOpen size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Select an engagement to view communications</p>
          </div>
        </div>
      )}
    </div>
  )
}

function CommBubble({ entry }: { entry: CommEntry }) {
  const isInbound = entry.type === 'email_inbound'
  const isOutbound = entry.type === 'email_outbound'
  const isSystem = entry.type === 'stage_change'
  const Icon = COMM_ICONS[entry.type] ?? MessageSquare

  if (isSystem) {
    return (
      <div className="flex items-center gap-3 py-1">
        <div className="flex-1 h-px bg-ink-100" />
        <span className="text-[10px] text-ink-400 flex items-center gap-1 flex-shrink-0">
          <Tag size={10} />{entry.subject}
        </span>
        <div className="flex-1 h-px bg-ink-100" />
      </div>
    )
  }

  return (
    <div className={`flex gap-3 ${isOutbound ? 'flex-row-reverse' : ''}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${isOutbound ? 'bg-gold text-ink-900' : 'bg-ink-800 text-gold'}`}>
        {isOutbound ? 'MT' : (entry.from_name?.[0] ?? '?')}
      </div>
      <div className={`flex-1 max-w-xl ${isOutbound ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs font-medium text-ink">{entry.from_name}</p>
          <p className="text-[10px] text-ink-300">{formatDate(entry.date, 'MMM d, h:mm a')}</p>
          {entry.channel && entry.channel !== 'email' && (
            <span className="text-[9px] bg-parchment text-ink-400 px-1.5 py-0.5 rounded">{entry.channel}</span>
          )}
        </div>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${isOutbound ? 'bg-ink text-cream rounded-tr-sm' : 'bg-white border border-ink-100 rounded-tl-sm text-ink'}`}>
          {entry.subject && <p className="font-medium text-xs mb-1 opacity-70">{entry.subject}</p>}
          <p className="whitespace-pre-wrap text-sm">{entry.body}</p>
        </div>
        {entry.needs_response && (
          <span className="mt-1.5 flex items-center gap-1 text-[10px] text-red-500 font-medium">
            <AlertTriangle size={9} /> Needs response
          </span>
        )}
      </div>
    </div>
  )
}
