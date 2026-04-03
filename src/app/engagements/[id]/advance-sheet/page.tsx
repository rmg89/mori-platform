'use client'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { useStore } from '@/lib/store'
import { ENGAGEMENT_FLAGS, MEDIA_FLAGS, Engagement, primaryContact } from '@/types'
import { formatDate } from '@/lib/utils'
import {
  ArrowLeft, Download, FileText, CheckCircle2, Circle,
  Mic, Video, Radio, Newspaper, Users
} from 'lucide-react'
import Link from 'next/link'

// ─── Event type helpers ───────────────────────────────────────────────────────

const MEDIA_TYPES = ['podcast', 'interview', 'panel', 'livestream']

function eventTypeLabel(type: string) {
  const map: Record<string, string> = {
    speaking: 'Speaking Engagement', podcast: 'Podcast', interview: 'Interview',
    panel: 'Panel', livestream: 'Livestream',
  }
  return map[type] || 'Engagement'
}

// ─── Sheet components ─────────────────────────────────────────────────────────

function BriefingDocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
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
  return <div className="grid grid-cols-2 gap-6">{children}</div>
}

function CheckItem({ text, done = false }: { text: string; done?: boolean }) {
  return (
    <div className={`flex items-start gap-3 text-sm ${done ? 'text-ink-300 line-through' : 'text-ink'}`}>
      <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border ${done ? 'bg-sage/20 border-sage/30' : 'border-ink-200'}`}>
        {done && <CheckCircle2 size={11} className="text-sage" />}
      </div>
      {text}
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

function BriefingDocPanel({ e }: { e: Engagement }) {
  const eventType = (e as any).event_type || 'speaking'
  const isMedia = MEDIA_TYPES.includes(eventType)
  const isInPerson = e.event_format === 'in_person'
  const isHybrid = e.event_format === 'hybrid'
  const hasPhysical = isInPerson || isHybrid
  const contact = primaryContact(e)

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
    <div className="space-y-8">

      <BriefingDocSection title={isMedia ? 'Appearance Overview' : 'Event Overview'}>
        <SheetRow>
          <SheetField label={isMedia ? 'Show / Outlet' : 'Event Name'} value={e.event_name || e.organization} />
          <SheetField label="Date" value={formatDate(e.event_date)} />
          <SheetField label="Time" value={(e as any).event_time} />
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
      </BriefingDocSection>

      {(e.topic || e.notes) && (
        <BriefingDocSection title={isMedia ? 'Topic & Content' : 'Presentation'}>
          {e.topic && <SheetField label={isMedia ? 'Discussion Topic / Angle' : 'Topic / Title'} value={e.topic} />}
          {e.notes && <SheetField label={isMedia ? 'Context & Notes' : 'Speaker Notes'} value={e.notes} />}
        </BriefingDocSection>
      )}

      {contact && (
        <BriefingDocSection title={hasPhysical ? 'On-Site Contact' : 'Primary Contact'}>
          <SheetRow>
            <SheetField label="Name" value={`${contact.first_name} ${contact.last_name}`} />
            <SheetField label="Title" value={contact.title} />
          </SheetRow>
          <SheetRow>
            <SheetField label="Email" value={contact.email} />
            {contact.phone && <SheetField label="Phone" value={contact.phone} />}
          </SheetRow>
        </BriefingDocSection>
      )}

      {(hasPhysical || isMedia) && (e.av_needs || e.travel_covered !== undefined || e.special_requirements) && (
        <BriefingDocSection title="Logistics">
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
        </BriefingDocSection>
      )}

      <BriefingDocSection title="Pre-Event Checklist">
        <div className="space-y-3">
          {checklistItems.map((item, i) => {
            const done = (item.toLowerCase().includes('bio') && bioSent) ||
                         (item.toLowerCase().includes('logistics') && clientDeliverablesSent)
            return <CheckItem key={i} text={item} done={done} />
          })}
        </div>
      </BriefingDocSection>

    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BriefingDocPage() {
  const { id } = useParams()
  const { engagements: allEngagements } = useStore()
  const [downloading, setDownloading] = useState(false)
  const e = allEngagements.find(e => e.id === id)
  if (!e) return <div className="p-8 text-ink-400">Engagement not found</div>

  const eventType = (e as any).event_type || 'speaking'
  const isMedia = MEDIA_TYPES.includes(eventType)

  async function handleDownload() {
    setDownloading(true)
    try {
      const { generateBriefingDoc } = await import('@/lib/documents')
      const blob = generateBriefingDoc(e!)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `briefing-${e!.organization.toLowerCase().replace(/\s+/g, '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto animate-fade-in">

      {/* Back nav */}
      <div className="flex items-center gap-3 mb-8">
        <Link href={`/engagements/${id}`} className="flex items-center gap-2 text-sm text-ink-400 hover:text-ink transition-all">
          <ArrowLeft size={14} /> Back to {e.organization}
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText size={15} className="text-gold" />
            <span className="text-xs text-gold uppercase tracking-widest font-semibold">
              {isMedia ? 'Briefing Document' : 'Briefing Document'}
            </span>
          </div>
          <h1 className="font-display text-3xl font-semibold text-ink">{e.event_name || e.organization}</h1>
          <p className="text-ink-400 text-sm mt-1">{e.organization} · {formatDate(e.event_date)}</p>
          <div className="accent-line mt-3 w-24" />
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-ink-100 hover:border-ink-300 rounded-xl text-sm font-medium text-ink-400 hover:text-ink transition-all disabled:opacity-50 flex-shrink-0"
        >
          <Download size={14} />
          {downloading ? 'Generating…' : 'Download PDF'}
        </button>
      </div>

      {/* Sheet content */}
      <div className="bg-white border border-ink-100 rounded-2xl p-8">
        <BriefingDocPanel e={e} />
      </div>

    </div>
  )
}