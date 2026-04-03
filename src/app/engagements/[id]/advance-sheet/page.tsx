'use client'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { useStore } from '@/lib/store'
import { Engagement, primaryContact } from '@/types'
import { formatDate } from '@/lib/utils'
import { ArrowLeft, Download, FileText, ExternalLink } from 'lucide-react'
import Link from 'next/link'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MEDIA_TYPES = ['podcast', 'interview', 'panel', 'livestream']

function eventTypeLabel(type: string) {
  const map: Record<string, string> = {
    speaking: 'Speaking Engagement', podcast: 'Podcast',
    interview: 'Interview', panel: 'Panel', livestream: 'Livestream',
  }
  return map[type] || 'Engagement'
}

// ─── Layout primitives ────────────────────────────────────────────────────────

function Divider() {
  return <div className="border-t border-ink-100 my-6" />
}

function BlockLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-300 mb-0.5">
      {children}
    </p>
  )
}

function BlockValue({ children, bold, link }: { children?: React.ReactNode; bold?: boolean; link?: string }) {
  if (!children) return null
  const cls = `text-sm leading-snug ${bold ? 'font-semibold text-ink' : 'text-ink-700'}`
  if (link) return (
    <a href={link} target="_blank" rel="noopener noreferrer"
      className={`${cls} text-gold hover:text-gold-dark inline-flex items-center gap-1`}>
      {children} <ExternalLink size={10} />
    </a>
  )
  return <p className={cls}>{children}</p>
}

function Field({ label, value, bold, link }: { label: string; value?: string | null; bold?: boolean; link?: string }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5">
      <BlockLabel>{label}</BlockLabel>
      <BlockValue bold={bold} link={link}>{value}</BlockValue>
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="h-px flex-1 bg-gold/25" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-gold">{children}</span>
      <div className="h-px flex-1 bg-gold/25" />
    </div>
  )
}

function TwoCol({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-8 gap-y-4">{children}</div>
}

// ─── Section components ───────────────────────────────────────────────────────

function EventHeader({ e }: { e: Engagement }) {
  const eventType = (e as any).event_type || 'speaking'
  const isInPerson = e.event_format === 'in_person'
  const isHybrid = e.event_format === 'hybrid'
  const hasPhysical = isInPerson || isHybrid
  const isVirtual = !hasPhysical

  const formatStr = hasPhysical
    ? `In-Person${e.event_city ? ` — ${e.event_city}` : ''}`
    : 'Virtual'

  return (
    <div className="space-y-4">
      <TwoCol>
        <Field label="Event" value={e.event_name || e.organization} bold />
        <Field label="Date / Time"
          value={[formatDate(e.event_date), e.event_time].filter(Boolean).join(' | ')}
          bold />
      </TwoCol>
      <Field label="Format" value={`${eventTypeLabel(eventType)} — ${formatStr}`} bold />

      {isVirtual && e.join_link && (
        <div className="bg-gold/6 border border-gold/20 rounded-xl px-4 py-3 space-y-2">
          <div className="flex flex-col gap-0.5">
            <BlockLabel>Join Link</BlockLabel>
            <a href={e.join_link} target="_blank" rel="noopener noreferrer"
              className="text-sm font-semibold text-gold hover:text-gold-dark inline-flex items-center gap-1">
              {e.join_link} <ExternalLink size={10} />
            </a>
          </div>
          {e.dial_in_backup && <Field label="Backup Dial-In" value={e.dial_in_backup} />}
          {e.green_room_time && <Field label="Green Room Opens" value={e.green_room_time} />}
          {e.go_live_time && <Field label="Go Live" value={e.go_live_time} bold />}
        </div>
      )}

      {hasPhysical && e.green_room_time && (
        <Field label="Green Room / Load-In" value={e.green_room_time} />
      )}
    </div>
  )
}

function PrimaryContactSection({ e }: { e: Engagement }) {
  const contact = primaryContact(e)
  if (!contact) return null
  const fullName = `${contact.first_name} ${contact.last_name}`
  const nameTitle = contact.title ? `${fullName} | ${contact.title}` : fullName
  return (
    <div className="space-y-3">
      <SectionHeader>Primary Contact</SectionHeader>
      <TwoCol>
        <Field label="Name / Title" value={nameTitle} bold />
        <div className="space-y-2">
          {contact.phone && <Field label="Cell" value={contact.phone} />}
          {contact.email && <Field label="Email" value={contact.email} />}
        </div>
      </TwoCol>
    </div>
  )
}

function EventDetailsSection({ e }: { e: Engagement }) {
  const eventType = (e as any).event_type || 'speaking'
  const isMedia = MEDIA_TYPES.includes(eventType)
  return (
    <div className="space-y-4">
      <SectionHeader>Event Details</SectionHeader>
      {e.purpose && <Field label="Purpose" value={e.purpose} />}
      {(e.audience_description || e.audience_size) && (
        <Field label="Audience"
          value={[e.audience_description, e.audience_size ? `~${e.audience_size.toLocaleString()} attendees` : null]
            .filter(Boolean).join(' · ')} />
      )}
      {e.session_length && (
        <Field
          label={isMedia ? 'Her Duration' : 'Duration (her speaking time only)'}
          value={`${e.session_length} minutes`}
          bold
        />
      )}
    </div>
  )
}

function VenueSection({ e }: { e: Engagement }) {
  const isInPerson = e.event_format === 'in_person'
  const isHybrid = e.event_format === 'hybrid'
  if (!isInPerson && !isHybrid) return null
  if (!e.event_location && !e.arrival_time && !e.venue_special_instructions) return null
  return (
    <div className="space-y-3">
      <Divider />
      <SectionHeader>Venue</SectionHeader>
      {e.event_location && (
        <div className="flex flex-col gap-0.5">
          <BlockLabel>Venue</BlockLabel>
          {e.venue_maps_link ? (
            <a href={e.venue_maps_link} target="_blank" rel="noopener noreferrer"
              className="text-sm font-semibold text-gold hover:text-gold-dark inline-flex items-center gap-1">
              {e.event_location} <ExternalLink size={10} />
            </a>
          ) : (
            <p className="text-sm font-semibold text-ink">{e.event_location}</p>
          )}
        </div>
      )}
      {e.arrival_time && <Field label="Arrival Time" value={e.arrival_time} bold />}
      {e.venue_special_instructions && (
        <Field label="Special Instructions" value={e.venue_special_instructions} />
      )}
    </div>
  )
}

function TravelSection({ e }: { e: Engagement }) {
  const hasTravel = e.flight_details || e.hotel_name || e.ground_transport || e.drive_time
  if (!hasTravel) return null
  const isFlying = !!e.flight_details
  return (
    <div className="space-y-4">
      <Divider />
      <SectionHeader>Travel Details</SectionHeader>
      {isFlying ? (
        <div className="space-y-5">
          {e.flight_details && (
            <div className="space-y-1">
              <BlockLabel>Flight</BlockLabel>
              <p className="text-sm font-semibold text-ink">{e.flight_details}</p>
              {e.flight_confirmation && (
                <a href={e.flight_confirmation} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-gold hover:text-gold-dark inline-flex items-center gap-1">
                  View confirmation <ExternalLink size={9} />
                </a>
              )}
            </div>
          )}
          {e.hotel_name && (
            <div className="space-y-1">
              <BlockLabel>Hotel</BlockLabel>
              <p className="text-sm font-semibold text-ink">{e.hotel_name}</p>
              <div className="flex items-center gap-3 text-xs text-ink-400">
                {e.hotel_checkin && <span>Check-in: {e.hotel_checkin}</span>}
                {e.hotel_confirmation && <span>Conf: {e.hotel_confirmation}</span>}
              </div>
              {e.hotel_maps_link && (
                <a href={e.hotel_maps_link} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-gold hover:text-gold-dark inline-flex items-center gap-1">
                  View address <ExternalLink size={9} />
                </a>
              )}
            </div>
          )}
          {e.ground_transport && <Field label="Ground Transport" value={e.ground_transport} />}
        </div>
      ) : (
        <div className="space-y-3">
          {e.drive_time && (
            <div className="space-y-1">
              <BlockLabel>Drive Time</BlockLabel>
              <p className="text-sm font-semibold text-ink">{e.drive_time}</p>
              {e.drive_route_link && (
                <a href={e.drive_route_link} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-gold hover:text-gold-dark inline-flex items-center gap-1">
                  View route <ExternalLink size={9} />
                </a>
              )}
            </div>
          )}
          {e.parking_details && <Field label="Parking" value={e.parking_details} />}
        </div>
      )}
    </div>
  )
}

function RunOfShowSection({ e }: { e: Engagement }) {
  const rows = (e as any).run_of_show as { time: string; what: string; notes?: string }[] | undefined
  if (!rows || rows.length === 0) return null
  return (
    <div className="space-y-3">
      <Divider />
      <SectionHeader>Schedule / Run of Show</SectionHeader>
      <div className="rounded-xl border border-ink-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-parchment border-b border-ink-100">
              <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-ink-300 w-28">Time</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-ink-300">What&apos;s Happening</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-ink-300 w-44">Her Role / Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={`border-b border-ink-50 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-parchment/30'}`}>
                <td className="px-4 py-2.5 font-medium text-ink whitespace-nowrap">{row.time}</td>
                <td className="px-4 py-2.5 text-ink-700">{row.what}</td>
                <td className="px-4 py-2.5 text-ink-400 text-xs">{row.notes ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PrepNotesSection({ e }: { e: Engagement }) {
  const hasPrep = e.topic || e.moderator_info || e.panelist_info || e.vip_info || e.dress_code || e.post_event_notes || e.notes
  if (!hasPrep) return null
  return (
    <div className="space-y-4">
      <Divider />
      <SectionHeader>Prep Notes</SectionHeader>
      {e.topic && <Field label="Topics / Questions" value={e.topic} />}
      {e.moderator_info && <Field label="Moderator" value={e.moderator_info} />}
      {e.panelist_info && <Field label="Co-Panelists" value={e.panelist_info} />}
      {e.vip_info && <Field label="VIPs" value={e.vip_info} />}
      {e.dress_code && <Field label="Dress Code / Vibe" value={e.dress_code} />}
      {e.post_event_notes && <Field label="Post-Event" value={e.post_event_notes} />}
      {e.notes && <Field label="Additional Notes" value={e.notes} />}
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
        <Link href={`/engagements/${id}`}
          className="flex items-center gap-2 text-sm text-ink-400 hover:text-ink transition-all">
          <ArrowLeft size={14} /> Back to {e.organization}
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText size={15} className="text-gold" />
            <span className="text-xs text-gold uppercase tracking-widest font-semibold">Briefing Document</span>
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

      {/* Document body */}
      <div className="bg-white border border-ink-100 rounded-2xl p-8">
        <EventHeader e={e} />
        <Divider />
        <PrimaryContactSection e={e} />
        <Divider />
        <EventDetailsSection e={e} />
        <VenueSection e={e} />
        <TravelSection e={e} />
        <RunOfShowSection e={e} />
        <PrepNotesSection e={e} />
      </div>

    </div>
  )
}