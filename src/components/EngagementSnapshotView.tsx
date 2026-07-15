'use client'
import Link from 'next/link'
import { Engagement, OutgoingMaterial, IncomingMaterial, BriefingNote } from '@/types'
import { formatDate, formatCurrency, getInitials } from '@/lib/utils'
import { ArrowLeft, History, CheckCircle2, Circle } from 'lucide-react'
import StageHistoryNav from './StageHistoryNav'

function str(snap: Record<string, unknown>, key: string): string | undefined {
  const v = snap[key]
  return typeof v === 'string' && v ? v : undefined
}
function num(snap: Record<string, unknown>, key: string): number | undefined {
  const v = snap[key]
  return typeof v === 'number' ? v : undefined
}
function bool(snap: Record<string, unknown>, key: string): boolean {
  return snap[key] === true
}
function list<T>(snap: Record<string, unknown>, key: string): T[] {
  const v = snap[key]
  return Array.isArray(v) ? (v as T[]) : []
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-300 w-28 flex-shrink-0 mt-0.5">{label}</span>
      <span className="text-sm text-ink flex-1">{value}</span>
    </div>
  )
}

// Read-only reconstruction of the Engagements-stage page, sourced from the frozen
// engagement_snapshot captured when this record left the Engagements stage
// (moveToWrapUp in src/lib/store.tsx) — not live fields, which keep changing
// after the record moves on. Contacts come from the live record since they're
// not stage-specific data (never reset between stages).
export default function EngagementSnapshotView({ engagement: e }: { engagement: Engagement }) {
  const snap = e.engagement_snapshot ?? {}
  const outgoingMaterials = list<OutgoingMaterial>(snap, 'outgoing_materials')
  const incomingMaterials = list<IncomingMaterial>(snap, 'incoming_materials')
  const briefingNotes = list<BriefingNote>(snap, 'briefing_notes')
  const runOfShow = list<{ time: string; what: string; notes?: string }>(snap, 'run_of_show')

  const contractRequired = bool(snap, 'contract_required')
  const contractSentAt = str(snap, 'contract_sent_at')
  const contractSignedAt = str(snap, 'contract_signed_at')
  const briefingComplete = bool(snap, 'briefing_complete')
  const purpose = str(snap, 'purpose')
  const audienceDescription = str(snap, 'audience_description')
  const joinLink = str(snap, 'join_link')
  const arrivalTime = str(snap, 'arrival_time')
  const venueMapsLink = str(snap, 'venue_maps_link')
  const flightDetails = str(snap, 'flight_details')
  const hotelName = str(snap, 'hotel_name')
  const depositAmount = num(snap, 'deposit_amount')
  const depositInvoiceSentAt = str(snap, 'deposit_invoice_sent_at')
  const depositReceivedAt = str(snap, 'deposit_received_at')

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fade-in">
      <Link href="/engagements" className="flex items-center gap-2 text-sm text-ink-400 hover:text-ink mb-6 transition-all">
        <ArrowLeft size={14} /> Back to Engagements
      </Link>

      <StageHistoryNav engagement={e} current="engagements" />

      <div className="mb-6">
        <h1 className="font-display text-3xl font-semibold text-ink">{e.event_name || e.organization}</h1>
        <p className="text-ink-400 text-sm mt-1">{e.organization}{e.booker_name ? ` · via ${e.booker_name}` : ''}</p>
        <div className="accent-line mt-3 w-24" />
      </div>

      <div className="flex items-center gap-2 mb-6 px-4 py-3 rounded-xl border bg-parchment/60 border-ink-100 text-ink-400 text-xs">
        <History size={13} className="flex-shrink-0" />
        Read-only snapshot of the Engagements stage, frozen when this record moved on — for reference only.
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-ink-100 rounded-xl p-5">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Contract & Briefing</p>
          <div className="space-y-2">
            <Row label="Contract Required" value={contractRequired ? 'Yes' : undefined} />
            <Row label="Contract Sent" value={contractSentAt ? formatDate(contractSentAt) : undefined} />
            <Row label="Contract Signed" value={contractSignedAt ? formatDate(contractSignedAt) : undefined} />
            <Row label="Briefing Complete" value={briefingComplete ? 'Yes' : undefined} />
          </div>
        </div>
        <div className="bg-white border border-ink-100 rounded-xl p-5">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Deposit</p>
          <div className="space-y-2">
            <Row label="Amount" value={depositAmount ? formatCurrency(depositAmount) : undefined} />
            <Row label="Invoice Sent" value={depositInvoiceSentAt ? formatDate(depositInvoiceSentAt) : undefined} />
            <Row label="Received" value={depositReceivedAt ? formatDate(depositReceivedAt) : undefined} />
          </div>
        </div>
      </div>

      {(outgoingMaterials.length > 0 || incomingMaterials.length > 0) && (
        <div className="grid grid-cols-2 gap-6 mb-6">
          {outgoingMaterials.length > 0 && (
            <div className="bg-white border border-ink-100 rounded-xl p-5">
              <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Outgoing Materials</p>
              <div className="space-y-2">
                {outgoingMaterials.map(m => (
                  <div key={m.id} className="flex items-center gap-2 text-sm">
                    {m.done ? <CheckCircle2 size={13} className="text-sage flex-shrink-0" /> : <Circle size={13} className="text-ink-200 flex-shrink-0" />}
                    <span className={m.done ? 'text-ink' : 'text-ink-400'}>{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {incomingMaterials.length > 0 && (
            <div className="bg-white border border-ink-100 rounded-xl p-5">
              <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Incoming Materials</p>
              <div className="space-y-2">
                {incomingMaterials.map(m => (
                  <div key={m.id} className="flex items-center gap-2 text-sm">
                    {m.received ? <CheckCircle2 size={13} className="text-sage flex-shrink-0" /> : <Circle size={13} className="text-ink-200 flex-shrink-0" />}
                    <span className={m.received ? 'text-ink' : 'text-ink-400'}>{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {(purpose || audienceDescription || joinLink || arrivalTime || venueMapsLink || flightDetails || hotelName) && (
        <div className="bg-white border border-ink-100 rounded-xl p-5 mb-6">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Logistics</p>
          <div className="space-y-2">
            <Row label="Purpose" value={purpose} />
            <Row label="Audience" value={audienceDescription} />
            <Row label="Join Link" value={joinLink} />
            <Row label="Arrival Time" value={arrivalTime} />
            <Row label="Venue Map" value={venueMapsLink} />
            <Row label="Flight Details" value={flightDetails} />
            <Row label="Hotel" value={hotelName} />
          </div>
        </div>
      )}

      {runOfShow.length > 0 && (
        <div className="bg-white border border-ink-100 rounded-xl p-5 mb-6">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-3">Run of Show</p>
          <div className="space-y-2">
            {runOfShow.map((r, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="text-ink-400 w-20 flex-shrink-0">{r.time}</span>
                <div>
                  <p className="text-ink">{r.what}</p>
                  {r.notes && <p className="text-xs text-ink-300 mt-0.5">{r.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {briefingNotes.length > 0 && (
        <div className="bg-white border border-ink-100 rounded-xl p-5 mb-6">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-3">Briefing Notes</p>
          <div className="space-y-3">
            {briefingNotes.map(n => (
              <div key={n.id} className="flex items-start gap-2 text-sm">
                {n.resolved ? <CheckCircle2 size={13} className="text-sage flex-shrink-0 mt-0.5" /> : <Circle size={13} className="text-ink-200 flex-shrink-0 mt-0.5" />}
                <div>
                  <p className={n.resolved ? 'text-ink-400 line-through' : 'text-ink'}>{n.body}</p>
                  <p className="text-[10px] text-ink-300 mt-0.5">{formatDate(n.created_at, 'MMM d, h:mm a')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {e.contacts.length > 0 && (
        <div className="bg-white border border-ink-100 rounded-xl p-5">
          <p className="text-xs text-ink-400 uppercase tracking-widest font-medium mb-4">Contacts</p>
          <div className="space-y-3">
            {e.contacts.map(c => (
              <div key={c.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-ink-800 flex items-center justify-center text-xs font-bold text-gold flex-shrink-0">
                  {getInitials(c.first_name, c.last_name)}
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">{c.first_name} {c.last_name}</p>
                  <p className="text-xs text-ink-400">{c.title}{c.title && c.role ? ' · ' : ''}{c.role}</p>
                  <p className="text-xs text-ink-300">{c.email}</p>
                </div>
                {c.is_current_point_of_contact && (
                  <span className="ml-auto text-[10px] text-gold bg-gold/10 px-2 py-0.5 rounded-full border border-gold/20 flex-shrink-0">POC</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
