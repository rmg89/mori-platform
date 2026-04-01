'use client'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { MOCK_ENGAGEMENTS } from '@/lib/mock-data'
import { ENGAGEMENT_FLAGS, MEDIA_FLAGS, EngagementFlag, MediaFlag, Engagement, primaryContact } from '@/types'
import { formatDate, formatCurrency, getInitials } from '@/lib/utils'
import {
  ArrowLeft, Calendar, MapPin, Users, AlertTriangle, CheckCircle2, Circle,
  Download, FileText, ChevronDown, ChevronUp, Mic, Video, Radio, Newspaper,
  Phone, Mail, Building, Clock, Wifi, Hotel, Plane, Monitor
} from 'lucide-react'
import Link from 'next/link'

// ─── Event type helpers ───────────────────────────────────────────────────────

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

// ─── Advance Sheet inline view ────────────────────────────────────────────────

function AdvanceSheetSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className="h-px flex-1 bg-gold/30" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-gold">{title}</span>
        <div className="h-px flex-1 bg-gold/30" />
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function SheetField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-300">{label}</span>
      <span className="text-sm text-ink leading-snug">{value}</span>
    </div>
  )
}

function SheetRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-4">{children}</div>
}

function CheckItem({ text, done = false }: { key?: number; text: string; done?: boolean }) {
  return (
    <div className={`flex items-start gap-2 text-sm ${done ? 'text-ink-300 line-through' : 'text-ink'}`}>
      <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${done ? 'bg-sage/20 border-sage/30' : 'border-ink-200'}`}>
        {done && <CheckCircle2 size={10} className="text-sage" />}
      </div>
      {text}
    </div>
  )
}

function AdvanceSheetPanel({ e }: { e: Engagement }) {
  const eventType = (e as any).event_type || 'speaking'
  const isMedia = MEDIA_TYPES.includes(eventType)
  const isInPerson = e.event_format === 'in_person'
  const isHybrid = e.event_format === 'hybrid'
  const hasPhysical = isInPerson || isHybrid
  const contact = primaryContact(e)

  // Checklists per type
  const checklistItems: string[] = (() => {
    if (eventType === 'podcast') return [
      'Confirm recording platform and dial-in link',
      'Test audio quality — quiet recording environment confirmed',
      'Review prep questions or discussion guide',
      'Confirm episode title and expected release timeline',
      'Bio and headshot sent to producer',
    ]
    if (eventType === 'interview') return [
      'Confirm format — written, phone, or video',
      'Review questions or topic brief from journalist',
      'Confirm publication outlet and expected publish date',
      'Confirm any embargo or approval-before-publish terms',
      'Bio and headshot sent to editor',
    ]
    if (eventType === 'panel') return [
      'Confirm full panelist lineup and moderator name',
      'Review moderator prep questions',
      'Confirm platform or venue details',
      'Confirm run-of-show and speaking order',
      'Bio and headshot sent to organizer',
    ]
    if (eventType === 'livestream') return [
      'Confirm platform and join/stream link',
      'Confirm run-of-show — conversation vs live Q&A timing',
      'Test audio and video on platform in advance',
      'Confirm promotional posts and RSVP count with host',
      'Bio and headshot sent to host',
    ]
    if (hasPhysical) return [
      'Confirm arrival time and green room or holding area',
      'Confirm AV setup — test clicker, slides, and confidence monitor',
      'Confirm final headcount with organizer',
      'Confirm recording and photography permissions',
      'Confirm run-of-show and time on stage',
      'Bio and headshot confirmed with organizer',
      'Confirm intro speaker name and pronunciation',
    ]
    return [
      'Confirm video platform and dial-in link',
      'Test audio, video, and screen share in advance',
      'Confirm final attendee count with organizer',
      'Confirm run-of-show and session timing',
      'Bio and headshot confirmed with organizer',
    ]
  })()

  const doneFlagIds = [...(e.engagement_flags || []), ...((e as any).media_flags || [])]
  const bioSent = doneFlagIds.includes('bio_sent')
  const clientDeliverablesSent = doneFlagIds.includes('client_deliverables_sent')

  return (
    <div className="space-y-6 py-2">

      {/* Overview */}
      <AdvanceSheetSection title={isMedia ? 'Appearance Overview' : 'Event Overview'}>
        <SheetRow>
          <SheetField label={isMedia ? 'Show / Outlet' : 'Event Name'} value={e.event_name || e.organization} />
          <SheetField label="Date" value={formatDate(e.event_date)} />
        </SheetRow>
        <SheetRow>
          <SheetField label="Organization" value={e.organization} />
          <SheetField label="Type" value={eventTypeLabel(eventType)} />
        </SheetRow>
        {hasPhysical && (
          <SheetRow>
            <SheetField label="Venue" value={e.event_location} />
            <SheetField label="City" value={e.event_city} />
          </SheetRow>
        )}
        {!hasPhysical && e.event_city && (
          <SheetField label="Location / Timezone" value={e.event_city} />
        )}
        <SheetRow>
          {e.audience_size && (
            <SheetField
              label={isMedia ? 'Est. Audience / Listeners' : 'Audience Size'}
              value={e.audience_size.toLocaleString()}
            />
          )}
          {e.session_length && (
            <SheetField label="Duration" value={`${e.session_length} minutes`} />
          )}
        </SheetRow>
      </AdvanceSheetSection>

      {/* Topic */}
      {(e.topic || e.notes) && (
        <AdvanceSheetSection title={isMedia ? 'Topic & Content' : 'Presentation'}>
          {e.topic && <SheetField label={isMedia ? 'Discussion Topic / Angle' : 'Topic / Title'} value={e.topic} />}
          {e.notes && <SheetField label={isMedia ? 'Context & Notes' : 'Speaker Notes'} value={e.notes} />}
        </AdvanceSheetSection>
      )}

      {/* Contact */}
      {contact && (
        <AdvanceSheetSection title={hasPhysical ? 'On-Site Contact' : 'Primary Contact'}>
          <SheetRow>
            <SheetField label="Name" value={`${contact.first_name} ${contact.last_name}`} />
            <SheetField label="Title" value={contact.title} />
          </SheetRow>
          <SheetRow>
            <SheetField label="Email" value={contact.email} />
            {contact.phone && <SheetField label="Phone" value={contact.phone} />}
          </SheetRow>
        </AdvanceSheetSection>
      )}

      {/* Logistics — only what's relevant */}
      {(hasPhysical || isMedia) && (e.av_needs || e.travel_covered !== undefined || e.hotel_covered !== undefined || e.special_requirements || (!hasPhysical && isMedia)) && (
        <AdvanceSheetSection title="Logistics">
          {hasPhysical && !isMedia && e.av_needs && (
            <SheetField label="AV Requirements" value={e.av_needs} />
          )}
          {!hasPhysical && isMedia && (
            <SheetField label="Platform / Recording Format" value="Confirm with organizer — link to be provided" />
          )}
          {hasPhysical && e.travel_covered !== undefined && (
            <SheetRow>
              <SheetField
                label="Travel"
                value={e.travel_covered ? 'Covered by Client — client will arrange' : 'Self-arranged by Speaker'}
              />
              {e.hotel_covered !== undefined && (
                <SheetField
                  label="Hotel"
                  value={e.hotel_covered ? 'Covered by Client — client will arrange' : 'Self-arranged by Speaker'}
                />
              )}
            </SheetRow>
          )}
          {e.special_requirements && (
            <SheetField label="Special Requirements" value={e.special_requirements} />
          )}
        </AdvanceSheetSection>
      )}

      {/* Checklist */}
      <AdvanceSheetSection title="Pre-Event Checklist">
        <div className="space-y-2">
          {checklistItems.map((item, i) => {
            const done = (item.toLowerCase().includes('bio') && bioSent) ||
                         (item.toLowerCase().includes('logistics') && clientDeliverablesSent)
            return <CheckItem key={i} text={item} done={done} />
          })}
        </div>
      </AdvanceSheetSection>

    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EngagementDetailPage() {
  const { id } = useParams()
  const [sheetOpen, setSheetOpen] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const e = MOCK_ENGAGEMENTS.find(e => e.id === id)
  if (!e) return <div className="p-8 text-ink-400">Engagement not found</div>
  const eventType = (e as any).event_type || 'speaking'
  const isMedia = MEDIA_TYPES.includes(eventType)
  const contact = primaryContact(e)
  const flags = isMedia ? MEDIA_FLAGS : ENGAGEMENT_FLAGS

  async function handleDownloadAdvanceSheet() {
    setDownloading(true)
    try {
      const { generateAdvanceSheet } = await import('@/lib/documents')
      const blob = generateAdvanceSheet(e!)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `advance-sheet-${e!.organization.toLowerCase().replace(/\s+/g, '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

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
            <div key={i} className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium ${alert.severity === 'high' ? 'text-red-500 bg-red-50 border-red-100' : 'text-gold bg-gold/8 border-gold/20'}`}>
              <AlertTriangle size={14} />{alert.label}
            </div>
          ))}
        </div>
      )}

      {/* Checklist flags */}
      <div className="bg-white border border-ink-100 rounded-xl p-5 mb-6">
        <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Progress</p>
        <div className="grid grid-cols-2 gap-3">
          {flags.map(flag => {
            const allFlags = [...(e.engagement_flags || []), ...((e as any).media_flags || [])]
            const done = allFlags.includes(flag.id as any)
            return (
              <div key={flag.id} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium ${done ? 'bg-sage/8 border-sage/20 text-sage' : 'bg-parchment border-ink-100 text-ink-400'}`}>
                {done ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                {flag.label}
              </div>
            )
          })}
        </div>
      </div>

      {/* Event details + contacts */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-ink-100 rounded-xl p-5">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Event Details</p>
          <div className="space-y-3">
            {e.event_date && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar size={14} className="text-ink-300" />{formatDate(e.event_date)}
              </div>
            )}
            {e.event_city && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin size={14} className="text-ink-300" />{e.event_city}
              </div>
            )}
            {e.session_length && (
              <div className="flex items-center gap-2 text-sm">
                <Clock size={14} className="text-ink-300" />{e.session_length} minutes
              </div>
            )}
            {e.audience_size && (
              <div className="flex items-center gap-2 text-sm">
                <Users size={14} className="text-ink-300" />{e.audience_size.toLocaleString()} {isMedia ? 'audience' : 'attendees'}
              </div>
            )}
            {e.event_format === 'virtual' && (
              <div className="flex items-center gap-2 text-sm">
                <Wifi size={14} className="text-ink-300" />Virtual
              </div>
            )}
            {e.topic && <div className="text-sm text-ink-600 mt-2 pt-2 border-t border-ink-50">{e.topic}</div>}
            {e.fee && (
              <div className="text-sm text-ink-500 mt-2 pt-2 border-t border-ink-50">
                Fee: <span className="font-medium text-ink">{formatCurrency(e.fee)}</span>
              </div>
            )}
            {e.travel_covered !== undefined && (
              <div className="flex items-center gap-2 text-xs text-ink-400 pt-1">
                <Plane size={11} />{e.travel_covered ? 'Travel covered' : 'Self-travel'}
                {e.hotel_covered !== undefined && (
                  <><span className="mx-1">·</span><Hotel size={11} />{e.hotel_covered ? 'Hotel covered' : 'Self-hotel'}</>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-ink-100 rounded-xl p-5">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Contacts</p>
          <div className="space-y-3">
            {e.contacts.map(c => (
              <div key={c.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-ink-800 flex items-center justify-center text-xs font-bold text-gold flex-shrink-0">
                  {getInitials(c.first_name, c.last_name)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{c.first_name} {c.last_name}</p>
                  <p className="text-xs text-ink-400">{c.title}</p>
                  <p className="text-xs text-ink-300 truncate">{c.email}</p>
                </div>
                {c.is_current_point_of_contact && (
                  <span className="ml-auto text-[10px] text-gold bg-gold/10 px-2 py-0.5 rounded-full border border-gold/20 flex-shrink-0">POC</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Advance Sheet ── */}
      <div className="bg-white border border-ink-100 rounded-xl mb-6 overflow-hidden">
        {/* Header row */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <button
            onClick={() => setSheetOpen((o: boolean) => !o)}
            className="flex items-center gap-2 text-sm font-semibold text-ink hover:text-gold transition-colors"
          >
            <FileText size={15} className="text-gold" />
            {isMedia ? 'Appearance Brief' : 'Advance Sheet'}
            {sheetOpen ? <ChevronUp size={14} className="text-ink-300 ml-1" /> : <ChevronDown size={14} className="text-ink-300 ml-1" />}
          </button>
          <button
            onClick={handleDownloadAdvanceSheet}
            disabled={downloading}
            className="flex items-center gap-1.5 text-xs font-medium text-ink-400 hover:text-ink border border-ink-100 hover:border-ink-300 rounded-lg px-3 py-1.5 transition-all disabled:opacity-50"
          >
            <Download size={12} />
            {downloading ? 'Generating…' : 'Download PDF'}
          </button>
        </div>

        {/* Sheet body */}
        {sheetOpen && (
          <div className="px-6 py-5">
            <AdvanceSheetPanel e={e} />
          </div>
        )}
      </div>

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
    </div>
  )
}