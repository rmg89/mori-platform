'use client'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MOCK_ENGAGEMENTS } from '@/lib/mock-data'
import { BUCKETS, primaryContact, CommEntry, ContactRole } from '@/types'
import { formatCurrency, formatDate, getInitials } from '@/lib/utils'
import {
  ArrowLeft, FileText, Receipt, ClipboardList, ChevronDown, Check,
  Mail, Phone, Building, Calendar, Users, Clock, DollarSign, Mic,
  Download, Edit3, AlertTriangle, MessageSquare, PhoneCall, Tag,
  ArrowRight, Plus, Globe
} from 'lucide-react'
import Link from 'next/link'

const ROLE_LABELS: Record<ContactRole, string> = {
  primary: 'Primary', bureau: 'Bureau/Agent', legal: 'Legal',
  logistics: 'Logistics', av: 'AV', assistant: 'Assistant', other: 'Other',
}
const ROLE_COLORS: Record<ContactRole, string> = {
  primary: '#C9A84C', bureau: '#7A9E87', legal: '#9A7A2E',
  logistics: '#4A4740', av: '#7D7A72', assistant: '#B0ADA6', other: '#D4D2CD',
}
const COMM_ICONS: Record<string, any> = {
  email_inbound: Mail, email_outbound: Mail, note: MessageSquare,
  stage_change: Tag, document_sent: FileText, call: PhoneCall, other_channel: Globe,
}
const ALERT_COLORS: Record<string, string> = {
  high: 'text-red-500 bg-red-50 border-red-200',
  medium: 'text-gold bg-gold/8 border-gold/20',
  low: 'text-ink-400 bg-parchment border-ink-100',
}

export default function EngagementDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const engagement = MOCK_ENGAGEMENTS.find(e => e.id === id)
  const [activeTab, setActiveTab] = useState<'timeline' | 'contacts' | 'documents' | 'notes'>('timeline')
  const [stepOpen, setStepOpen] = useState(false)
  const [generatingDoc, setGeneratingDoc] = useState<string | null>(null)
  const [docGenerated, setDocGenerated] = useState<Record<string, boolean>>({})

  if (!engagement) return (
    <div className="p-8">
      <p className="text-ink-400">Engagement not found.</p>
      <Link href="/pipeline" className="text-gold text-sm mt-2 inline-block">← Back</Link>
    </div>
  )

  const pc = primaryContact(engagement)
  const bucket = BUCKETS.find(b => b.id === engagement.bucket)!
  const stepLabel = bucket.steps.find(s => s.id === engagement.step)?.label ?? engagement.step
  const sortedComms = [...engagement.comms].sort((a, b) => b.date > a.date ? 1 : -1)

  const handleGenerateDoc = async (type: string) => {
    setGeneratingDoc(type)
    await new Promise(r => setTimeout(r, 1200))
    setDocGenerated(prev => ({ ...prev, [type]: true }))
    setGeneratingDoc(null)
  }

  const docItems = [
    { key: 'contract', label: 'Speaking Agreement', icon: FileText, generated: engagement.contract_generated || docGenerated['contract'], statusLabel: engagement.contract_signed ? 'Signed' : engagement.contract_generated ? 'Awaiting signature' : null, positive: engagement.contract_signed },
    { key: 'advance_sheet', label: 'Advance Sheet', icon: ClipboardList, generated: engagement.advance_sheet_generated || docGenerated['advance_sheet'], statusLabel: null, positive: null },
    { key: 'invoice', label: 'Invoice', icon: Receipt, generated: engagement.invoice_generated || docGenerated['invoice'], statusLabel: engagement.invoice_paid ? 'Paid' : engagement.invoice_generated ? 'Awaiting payment' : null, positive: engagement.invoice_paid },
  ]

  return (
    <div className="min-h-full bg-cream">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-cream/95 backdrop-blur border-b border-ink-100 px-8 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/pipeline')} className="p-2 rounded-lg hover:bg-parchment transition-all text-ink-400 hover:text-ink">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <h1 className="font-display text-xl font-semibold">{engagement.event_name || engagement.topic || engagement.organization}</h1>
          <p className="text-xs text-ink-400">{engagement.organization}{pc ? ` · ${pc.first_name} ${pc.last_name}` : ''}</p>
        </div>

        {/* Alerts */}
        {engagement.alerts.length > 0 && (
          <div className="flex gap-2">
            {engagement.alerts.slice(0, 2).map((a, i) => (
              <span key={i} className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md border ${ALERT_COLORS[a.severity]}`}>
                <AlertTriangle size={9} />{a.label}
              </span>
            ))}
          </div>
        )}

        {/* Step selector */}
        <div className="relative">
          <button
            onClick={() => setStepOpen(!stepOpen)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all"
            style={{ borderColor: bucket.color + '60', backgroundColor: bucket.color + '15', color: bucket.color }}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: bucket.color }} />
            {stepLabel}
            <ChevronDown size={14} />
          </button>
          {stepOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-ink-100 rounded-xl shadow-xl z-20 w-56 py-1">
              {BUCKETS.map(b => (
                <div key={b.id}>
                  <p className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-ink-300">{b.label}</p>
                  {b.steps.map(s => (
                    <button key={s.id} onClick={() => setStepOpen(false)}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-parchment transition-all text-left">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: b.color }} />
                      <span className="flex-1">{s.label}</span>
                      {s.id === engagement.step && <Check size={12} className="text-gold" />}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        <button className="flex items-center gap-2 px-3 py-2 rounded-lg border border-ink-200 text-sm text-ink-500 hover:bg-parchment transition-all">
          <Edit3 size={14} /> Edit
        </button>
      </div>

      <div className="p-8 max-w-6xl mx-auto">
        <div className="grid grid-cols-3 gap-6">
          {/* Left sidebar */}
          <div className="col-span-1 space-y-4">
            {/* Event card */}
            <div className="bg-white border border-ink-100 rounded-xl p-5">
              {engagement.topic && (
                <div className="mb-4 pb-4 border-b border-ink-50">
                  <p className="text-[10px] text-ink-400 uppercase tracking-widest mb-1">Topic</p>
                  <p className="font-display text-base font-medium text-ink leading-snug">{engagement.topic}</p>
                </div>
              )}
              <div className="space-y-3">
                {engagement.event_date && <InfoRow icon={Calendar} label="Date" value={formatDate(engagement.event_date)} />}
                {engagement.event_city && <InfoRow icon={Building} label="Location" value={`${engagement.event_location ? engagement.event_location + ', ' : ''}${engagement.event_city}`} />}
                {engagement.session_length && <InfoRow icon={Clock} label="Session" value={`${engagement.session_length} min`} />}
                {engagement.audience_size && <InfoRow icon={Users} label="Audience" value={`~${engagement.audience_size.toLocaleString()}`} />}
                {engagement.fee && <InfoRow icon={DollarSign} label="Fee" value={formatCurrency(engagement.fee)} highlight />}
                {engagement.event_format && <InfoRow icon={Mic} label="Format" value={engagement.event_format.replace('_', '-')} />}
                {engagement.booker_name && <InfoRow icon={Users} label="Via" value={engagement.booker_name} />}
              </div>
            </div>

            {/* Contacts */}
            <div className="bg-white border border-ink-100 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-base font-semibold">Contacts</h3>
                <button className="p-1 rounded hover:bg-parchment text-ink-400 transition-all"><Plus size={13} /></button>
              </div>
              <div className="space-y-3">
                {engagement.contacts.map(contact => (
                  <div key={contact.id} className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-ink-800 flex items-center justify-center text-[10px] font-bold text-gold flex-shrink-0">
                      {getInitials(contact.first_name, contact.last_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold text-ink truncate">{contact.first_name} {contact.last_name}</p>
                        {contact.is_current_point_of_contact && (
                          <span className="text-[9px] bg-gold/15 text-gold-dark px-1.5 py-0.5 rounded font-semibold">POC</span>
                        )}
                      </div>
                      <p className="text-[10px] text-ink-400 truncate">{contact.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: ROLE_COLORS[contact.role] + '20', color: ROLE_COLORS[contact.role] }}>
                          {ROLE_LABELS[contact.role]}
                        </span>
                      </div>
                      {contact.notes && <p className="text-[10px] text-ink-300 mt-0.5 italic">{contact.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AV */}
            {engagement.av_needs && (
              <div className="bg-white border border-ink-100 rounded-xl p-5">
                <h3 className="font-display text-base font-semibold mb-2">AV & Logistics</h3>
                <p className="text-xs text-ink-600 leading-relaxed">{engagement.av_needs}</p>
                {(engagement.travel_covered !== undefined || engagement.hotel_covered !== undefined) && (
                  <div className="flex gap-2 mt-3">
                    <StatusPill label="Travel" covered={!!engagement.travel_covered} />
                    <StatusPill label="Hotel" covered={!!engagement.hotel_covered} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: tabs */}
          <div className="col-span-2">
            <div className="bg-white border border-ink-100 rounded-xl overflow-hidden">
              <div className="flex border-b border-ink-100">
                {(['timeline', 'contacts', 'documents', 'notes'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`flex-1 px-4 py-3 text-sm font-medium capitalize transition-all ${activeTab === tab ? 'bg-parchment text-ink border-b-2 border-gold' : 'text-ink-400 hover:text-ink hover:bg-parchment/50'}`}>
                    {tab === 'contacts' ? `Contacts (${engagement.contacts.length})` : tab}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {/* Timeline tab */}
                {activeTab === 'timeline' && (
                  <div className="animate-fade-in">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display text-lg font-semibold">Communication Timeline</h3>
                      <button className="flex items-center gap-1.5 text-xs text-ink-500 border border-ink-200 px-3 py-1.5 rounded-lg hover:bg-parchment transition-all">
                        <Plus size={12} /> Log Entry
                      </button>
                    </div>
                    <div className="space-y-3">
                      {sortedComms.map(entry => (
                        <CommEntryRow key={entry.id} entry={entry} contacts={engagement.contacts} />
                      ))}
                    </div>
                    <div className="mt-4 p-3 bg-parchment rounded-lg text-xs text-ink-400">
                      <span className="font-medium text-ink-500">Email auto-tagging:</span> Once Microsoft Graph API is connected, emails to/from known contacts auto-appear here. Unknown contacts prompt a one-click tagging flow.
                    </div>
                  </div>
                )}

                {/* Contacts tab */}
                {activeTab === 'contacts' && (
                  <div className="animate-fade-in space-y-3">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display text-lg font-semibold">All Contacts</h3>
                      <button className="flex items-center gap-1.5 text-xs bg-ink text-cream px-3 py-1.5 rounded-lg hover:bg-ink-700 transition-all">
                        <Plus size={12} /> Add Contact
                      </button>
                    </div>
                    {engagement.contacts.map(contact => (
                      <div key={contact.id} className="flex items-start gap-4 p-4 border border-ink-100 rounded-xl hover:border-ink-200 transition-all">
                        <div className="w-10 h-10 rounded-full bg-ink-800 flex items-center justify-center text-sm font-bold text-gold flex-shrink-0">
                          {getInitials(contact.first_name, contact.last_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-ink">{contact.first_name} {contact.last_name}</p>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                              style={{ backgroundColor: ROLE_COLORS[contact.role] + '20', color: ROLE_COLORS[contact.role] }}>
                              {ROLE_LABELS[contact.role]}
                            </span>
                            {contact.is_current_point_of_contact && (
                              <span className="text-[10px] bg-gold/15 text-gold-dark px-2 py-0.5 rounded-full font-semibold">Current POC</span>
                            )}
                          </div>
                          {contact.title && <p className="text-xs text-ink-400 mt-0.5">{contact.title}</p>}
                          <div className="flex items-center gap-4 mt-2">
                            <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-xs text-gold hover:underline">
                              <Mail size={11} />{contact.email}
                            </a>
                            {contact.phone && (
                              <span className="flex items-center gap-1 text-xs text-ink-400">
                                <Phone size={11} />{contact.phone}
                              </span>
                            )}
                          </div>
                          {contact.notes && <p className="text-xs text-ink-400 mt-1.5 italic">{contact.notes}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Documents tab */}
                {activeTab === 'documents' && (
                  <div className="animate-fade-in space-y-3">
                    <p className="text-sm text-ink-400 mb-4">Generated from this record — no re-entry required.</p>
                    {docItems.map(({ key, label, icon: Icon, generated, statusLabel, positive }) => (
                      <div key={key} className="flex items-center gap-4 p-4 border border-ink-100 rounded-xl hover:border-ink-200 transition-all">
                        <div className="w-10 h-10 rounded-lg bg-parchment flex items-center justify-center text-ink-400 flex-shrink-0">
                          <Icon size={18} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-ink">{label}</p>
                          {generated && statusLabel && (
                            <p className={`text-xs mt-0.5 ${positive ? 'text-sage' : 'text-gold'}`}>{statusLabel}</p>
                          )}
                          {!generated && <p className="text-xs text-ink-400 mt-0.5">Not yet generated</p>}
                        </div>
                        {generated ? (
                          <button className="flex items-center gap-2 px-3 py-1.5 text-xs text-ink-500 border border-ink-200 rounded-lg hover:bg-parchment transition-all">
                            <Download size={12} /> Download
                          </button>
                        ) : (
                          <button onClick={() => handleGenerateDoc(key)} disabled={generatingDoc === key}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-ink text-cream rounded-lg hover:bg-ink-700 transition-all disabled:opacity-60">
                            {generatingDoc === key ? <span className="animate-pulse">Generating…</span> : 'Generate'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Notes tab */}
                {activeTab === 'notes' && (
                  <div className="animate-fade-in">
                    <h3 className="font-display text-lg font-semibold mb-3">Internal Notes</h3>
                    <textarea
                      defaultValue={engagement.notes || ''}
                      placeholder="Add internal notes..."
                      className="w-full h-48 text-sm text-ink-600 bg-parchment border border-ink-100 rounded-xl p-4 outline-none focus:border-gold/40 resize-none placeholder:text-ink-300 transition-all"
                    />
                    <button className="mt-2 px-4 py-2 bg-ink text-cream text-sm rounded-lg hover:bg-ink-700 transition-all">Save</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CommEntryRow({ entry, contacts }: { entry: CommEntry, contacts: any[] }) {
  const Icon = COMM_ICONS[entry.type] ?? MessageSquare
  const contact = contacts.find(c => c.id === entry.contact_id)
  const isInbound = entry.type === 'email_inbound'
  const isOutbound = entry.type === 'email_outbound'
  const isSystem = entry.type === 'stage_change'

  return (
    <div className={`flex gap-3 ${isSystem ? 'opacity-60' : ''}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isInbound ? 'bg-sage/15 text-sage-dark' : isOutbound ? 'bg-gold/15 text-gold-dark' : 'bg-parchment text-ink-400'}`}>
        <Icon size={12} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-ink">{entry.subject || entry.type.replace('_', ' ')}</p>
            {(contact || entry.from_name) && (
              <p className="text-[10px] text-ink-400 mt-0.5">
                {isInbound ? `From: ${entry.from_name}` : isOutbound ? `To: ${entry.to_name}` : entry.staff_name || ''}
                {entry.channel && entry.channel !== 'email' && ` · via ${entry.channel}`}
              </p>
            )}
          </div>
          <p className="text-[10px] text-ink-300 flex-shrink-0">{formatDate(entry.date, 'MMM d')}</p>
        </div>
        {entry.body && (
          <p className="text-xs text-ink-500 mt-1 leading-relaxed line-clamp-2">{entry.body}</p>
        )}
        {entry.needs_response && (
          <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-red-500 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full font-medium">
            <AlertTriangle size={8} /> Needs response
          </span>
        )}
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value, highlight = false }: { icon: any, label: string, value: string, highlight?: boolean }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={13} className="text-ink-300 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-[10px] text-ink-400 uppercase tracking-wider">{label}</p>
        <p className={`text-sm mt-0.5 ${highlight ? 'font-semibold text-gold' : 'text-ink-600'}`}>{value}</p>
      </div>
    </div>
  )
}

function StatusPill({ label, covered }: { label: string, covered: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${covered ? 'bg-sage/15 text-sage-dark' : 'bg-ink-50 text-ink-400'}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${covered ? 'bg-sage' : 'bg-ink-300'}`} />
      {label}: {covered ? 'Covered' : 'Self'}
    </div>
  )
}
