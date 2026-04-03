// Document generation using jsPDF
// Templates are data-merge only — no AI, deterministic output
// TODO: Replace with more robust templating (e.g., docx → PDF) once templates are finalized

import { Engagement, primaryContact } from '@/types'
type Client = Engagement

function pc(client: Client) {
  return primaryContact(client)
}
import { formatDate, formatCurrency } from './utils'

// ─── Shared PDF setup ─────────────────────────────────────────────────────────

function createDoc() {
  // jsPDF is loaded client-side only
  const { jsPDF } = require('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  return doc
}

function addHeader(doc: any, title: string) {
  doc.setFillColor(15, 14, 12)
  doc.rect(0, 0, 612, 80, 'F')
  doc.setTextColor(201, 168, 76)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('MORI TAHERIPOUR', 50, 35)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  doc.text('Wharton School · Author · Keynote Speaker · Negotiation Expert', 50, 52)
  doc.setTextColor(201, 168, 76)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(title.toUpperCase(), 50, 70)
  doc.setTextColor(15, 14, 12)
  doc.setFont('helvetica', 'normal')
}

function addFooter(doc: any, pageNum: number) {
  doc.setFontSize(8)
  doc.setTextColor(150, 148, 144)
  doc.text('moritaheripour.com  |  Confidential', 50, 760)
  doc.text(`Page ${pageNum}`, 562, 760, { align: 'right' })
}

function addField(doc: any, label: string, value: string, x: number, y: number) {
  doc.setFontSize(8)
  doc.setTextColor(100, 97, 90)
  doc.setFont('helvetica', 'bold')
  doc.text(label.toUpperCase(), x, y)
  doc.setFontSize(10)
  doc.setTextColor(15, 14, 12)
  doc.setFont('helvetica', 'normal')
  doc.text(value || '—', x, y + 14)
}

// ─── Contract ─────────────────────────────────────────────────────────────────

export function generateContract(client: Client): Blob {
  const doc = createDoc()
  addHeader(doc, 'Speaking Agreement')

  let y = 110
  const L = 50, R = 330

  // Agreement intro
  doc.setFontSize(10)
  doc.setTextColor(60, 58, 54)
  const intro = `This Speaking Agreement ("Agreement") is entered into between Mori Taheripour ("Speaker") and ${client.organization} ("Client"), for the speaking engagement described below.`
  const lines = doc.splitTextToSize(intro, 512)
  doc.text(lines, 50, y)
  y += lines.length * 14 + 20

  // Divider
  doc.setDrawColor(201, 168, 76)
  doc.setLineWidth(0.5)
  doc.line(50, y, 562, y)
  y += 20

  // Event details
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 14, 12)
  doc.text('EVENT DETAILS', 50, y)
  y += 20

  addField(doc, 'Client Organization', client.organization, L, y)
  addField(doc, 'Primary Contact', `${pc(client)?.first_name || "—"} ${pc(client)?.last_name || "—"}`, R, y)
  y += 40

  addField(doc, 'Event Name', client.event_name || '—', L, y)
  addField(doc, 'Event Date', formatDate(client.event_date), R, y)
  y += 40

  addField(doc, 'Venue / Location', `${client.event_location || '—'}, ${client.event_city || ''}`, L, y)
  addField(doc, 'Format', client.event_format?.replace('_', '-').toUpperCase() || '—', R, y)
  y += 40

  addField(doc, 'Topic / Presentation Title', client.topic || '—', L, y)
  addField(doc, 'Session Length', client.session_length ? `${client.session_length} minutes` : '—', R, y)
  y += 40

  addField(doc, 'Audience Size (est.)', client.audience_size?.toString() || '—', L, y)
  addField(doc, 'AV Requirements', client.av_needs || 'Standard', R, y)
  y += 50

  // Compensation
  doc.setDrawColor(201, 168, 76)
  doc.line(50, y, 562, y)
  y += 20
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('COMPENSATION & EXPENSES', 50, y)
  y += 20

  addField(doc, 'Speaking Fee', formatCurrency(client.fee), L, y)
  addField(doc, 'Travel', client.travel_covered ? 'Covered by Client' : 'Covered by Speaker', R, y)
  y += 40
  addField(doc, 'Hotel Accommodation', client.hotel_covered ? 'Covered by Client' : 'Covered by Speaker', L, y)
  y += 50

  // Terms
  doc.setDrawColor(201, 168, 76)
  doc.line(50, y, 562, y)
  y += 20
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('TERMS & CONDITIONS', 50, y)
  y += 16

  const terms = [
    '1. PAYMENT: Full speaking fee is due within 30 days of invoice issuance, unless otherwise agreed in writing.',
    '2. CANCELLATION: Cancellation by Client within 60 days of event date will result in forfeiture of 50% of the speaking fee. Cancellation within 30 days will result in forfeiture of 100% of the fee.',
    '3. RECORDING: Client may not record, broadcast, or distribute Speaker\'s presentation without prior written consent.',
    '4. PROMOTION: Client may use Speaker\'s name, likeness, and approved bio for event promotion. All materials must be approved by Speaker\'s team prior to publication.',
    '5. GOVERNING LAW: This agreement shall be governed by the laws of the Commonwealth of Pennsylvania.',
  ]

  doc.setFontSize(9)
  doc.setTextColor(60, 58, 54)
  doc.setFont('helvetica', 'normal')
  for (const term of terms) {
    const tlines = doc.splitTextToSize(term, 512)
    doc.text(tlines, 50, y)
    y += tlines.length * 13 + 6
  }

  y += 30
  // Signature lines
  doc.setDrawColor(15, 14, 12)
  doc.setLineWidth(0.5)
  doc.line(50, y, 240, y)
  doc.line(330, y, 520, y)
  y += 14
  doc.setFontSize(9)
  doc.setTextColor(100, 97, 90)
  doc.text('Mori Taheripour, Speaker', 50, y)
  doc.text(`${pc(client)?.first_name || "—"} ${pc(client)?.last_name || "—"}, ${client.organization}`, 330, y)
  y += 14
  doc.text('Date: ___________________', 50, y)
  doc.text('Date: ___________________', 330, y)

  addFooter(doc, 1)
  return doc.output('blob')
}

// ─── Briefing Document ────────────────────────────────────────────────────────────

export function generateBriefingDoc(client: Client): Blob {
  const doc = createDoc()

  const eventType = (client as any).event_type || 'speaking'
  const isMedia = ['podcast', 'interview', 'panel', 'livestream'].includes(eventType)
  const isInPerson = client.event_format === 'in_person'
  const isHybrid = client.event_format === 'hybrid'
  const hasPhysical = isInPerson || isHybrid
  const isVirtual = !hasPhysical
  const c = pc(client)

  const typeLabels: Record<string, string> = {
    speaking: 'Speaking Engagement', podcast: 'Podcast',
    interview: 'Interview', panel: 'Panel', livestream: 'Livestream',
  }
  const typeLabel = typeLabels[eventType] || 'Engagement'
  const formatStr = hasPhysical
    ? `In-Person${client.event_city ? ` — ${client.event_city}` : ''}`
    : 'Virtual'

  addHeader(doc, 'Briefing Document')

  let y = 100
  const L = 50, R = 330

  // Helper: divider rule
  const rule = () => {
    doc.setDrawColor(220, 218, 212)
    doc.setLineWidth(0.4)
    doc.line(50, y, 562, y)
    y += 18
  }

  // Helper: small label + value pair
  const pf = (label: string, value: string | undefined | null, x: number, bold = false) => {
    if (!value) return
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(140, 138, 132)
    doc.text(label.toUpperCase(), x, y)
    doc.setFontSize(10)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setTextColor(15, 14, 12)
    doc.text(value, x, y + 13)
  }

  // Helper: full-width label + value (wrapping)
  const pfWide = (label: string, value: string | undefined | null) => {
    if (!value) return
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(140, 138, 132)
    doc.text(label.toUpperCase(), 50, y)
    y += 13
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(15, 14, 12)
    const lines = doc.splitTextToSize(value, 512)
    doc.text(lines, 50, y)
    y += lines.length * 13 + 6
  }

  // ── EVENT / DATE / FORMAT ──────────────────────────────────────────────────
  const eventName = client.event_name || client.organization
  const dateTime = [formatDate(client.event_date), client.event_time].filter(Boolean).join(' | ')
  pf('Event', eventName, L, true)
  pf('Date / Time', dateTime, R, true)
  y += 30

  pf('Format', `${typeLabel} — ${formatStr}`, L, true)
  y += 28

  // ── JOIN LINK block — virtual only ─────────────────────────────────────────
  if (isVirtual && (client as any).join_link) {
    doc.setFillColor(254, 249, 235)
    doc.setDrawColor(201, 168, 76)
    doc.setLineWidth(0.5)
    doc.rect(50, y - 4, 512, 54, 'FD')
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(140, 100, 20)
    doc.text('JOIN LINK', 58, y + 8)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(150, 110, 20)
    doc.text((client as any).join_link || '', 58, y + 20)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 78, 72)
    if ((client as any).dial_in_backup) doc.text(`Backup dial-in: ${(client as any).dial_in_backup}`, 58, y + 32)
    if ((client as any).green_room_time) doc.text(`Green room opens: ${(client as any).green_room_time}`, 58, y + 32 + ((client as any).dial_in_backup ? 12 : 0))
    if ((client as any).go_live_time) {
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(15, 14, 12)
      doc.text(`Go live: ${(client as any).go_live_time}`, 300, y + 32)
    }
    y += 64
  }

  rule()

  // ── PRIMARY CONTACT ────────────────────────────────────────────────────────
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(201, 168, 76)
  doc.text('PRIMARY CONTACT', 50, y)
  y += 14

  if (c) {
    const nameTitle = c.title ? `${c.first_name} ${c.last_name}  |  ${c.title}` : `${c.first_name} ${c.last_name}`
    doc.setFontSize(10.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 14, 12)
    doc.text(nameTitle, 50, y)
    y += 14
    doc.setFontSize(9.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60, 58, 54)
    if (c.phone) { doc.text(c.phone, 50, y); y += 13 }
    if (c.email) { doc.text(c.email, 50, y); y += 13 }
  }
  y += 6

  rule()

  // ── PURPOSE / AUDIENCE / DURATION ─────────────────────────────────────────
  if ((client as any).purpose) pfWide('Purpose', (client as any).purpose)

  const audienceParts = [
    (client as any).audience_description,
    client.audience_size ? `~${client.audience_size.toLocaleString()} attendees` : null,
  ].filter(Boolean)
  if (audienceParts.length > 0) pfWide('Audience', audienceParts.join(' · '))

  if (client.session_length) {
    pfWide('Duration (her speaking time only)', `${client.session_length} minutes`)
  }

  if ((client as any).purpose || (client as any).audience_description || client.session_length) {
    y += 4
    rule()
  }

  // ── VENUE — in-person / hybrid only ───────────────────────────────────────
  if (hasPhysical && (client.event_location || (client as any).arrival_time)) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(201, 168, 76)
    doc.text('VENUE', 50, y)
    y += 14

    if (client.event_location) {
      doc.setFontSize(10.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(15, 14, 12)
      doc.text(client.event_location, 50, y)
      y += 14
    }
    if ((client as any).arrival_time) {
      pf('Arrival Time', (client as any).arrival_time, L, true)
      y += 28
    }
    if ((client as any).venue_special_instructions) {
      pfWide('Special Instructions', (client as any).venue_special_instructions)
    }
    y += 4
    rule()
  }

  // ── TRAVEL DETAILS ────────────────────────────────────────────────────────
  const hasTravel = (client as any).flight_details || (client as any).hotel_name || (client as any).drive_time
  if (hasTravel) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(201, 168, 76)
    doc.text('TRAVEL DETAILS', 50, y)
    y += 14

    if ((client as any).flight_details) {
      doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(140, 138, 132)
      doc.text('FLIGHT', 50, y); y += 13
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 14, 12)
      doc.text((client as any).flight_details, 50, y); y += 14
    }

    if ((client as any).hotel_name) {
      doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(140, 138, 132)
      doc.text('HOTEL', 50, y); y += 13
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 14, 12)
      doc.text((client as any).hotel_name, 50, y); y += 14
      const hotelMeta = [
        (client as any).hotel_checkin ? `Check-in: ${(client as any).hotel_checkin}` : null,
        (client as any).hotel_confirmation ? `Conf: ${(client as any).hotel_confirmation}` : null,
      ].filter(Boolean).join('   ')
      if (hotelMeta) {
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 97, 90)
        doc.text(hotelMeta, 50, y); y += 14
      }
    }

    if ((client as any).ground_transport) {
      pfWide('Ground Transport', (client as any).ground_transport)
    }

    if ((client as any).drive_time) {
      doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(140, 138, 132)
      doc.text('DRIVE TIME', 50, y); y += 13
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 14, 12)
      doc.text((client as any).drive_time, 50, y); y += 14
    }

    if ((client as any).parking_details) pfWide('Parking', (client as any).parking_details)

    y += 4
    rule()
  }

  // ── SCHEDULE / RUN OF SHOW ────────────────────────────────────────────────
  const ros = (client as any).run_of_show as { time: string; what: string; notes?: string }[] | undefined
  if (ros && ros.length > 0) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(201, 168, 76)
    doc.text('SCHEDULE / RUN OF SHOW', 50, y)
    y += 14

    // Table header
    doc.setFillColor(247, 246, 243)
    doc.rect(50, y - 6, 512, 18, 'F')
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(140, 138, 132)
    doc.text('TIME', 54, y + 5)
    doc.text("WHAT'S HAPPENING", 160, y + 5)
    doc.text('HER ROLE / NOTES', 400, y + 5)
    y += 18

    doc.setFontSize(9.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(15, 14, 12)
    for (const row of ros) {
      doc.setFont('helvetica', 'bold')
      doc.text(row.time, 54, y)
      doc.setFont('helvetica', 'normal')
      const whatLines = doc.splitTextToSize(row.what, 220)
      doc.text(whatLines, 160, y)
      if (row.notes) {
        doc.setTextColor(100, 97, 90)
        const noteLines = doc.splitTextToSize(row.notes, 145)
        doc.text(noteLines, 400, y)
        doc.setTextColor(15, 14, 12)
      }
      doc.setDrawColor(230, 228, 224); doc.setLineWidth(0.3)
      const rowH = Math.max(whatLines.length, 1) * 13 + 6
      doc.line(50, y + rowH - 2, 562, y + rowH - 2)
      y += rowH
    }
    y += 8
    rule()
  }

  // ── PREP NOTES ────────────────────────────────────────────────────────────
  const hasPrep = client.topic || (client as any).moderator_info || (client as any).panelist_info ||
    (client as any).vip_info || (client as any).dress_code || (client as any).post_event_notes || client.notes

  if (hasPrep) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(201, 168, 76)
    doc.text('PREP NOTES', 50, y)
    y += 14

    if (client.topic) pfWide('Topics / Questions', client.topic)
    if ((client as any).moderator_info) pfWide('Moderator / Co-Panelists', (client as any).moderator_info)
    if ((client as any).panelist_info) pfWide('Co-Panelists', (client as any).panelist_info)
    if ((client as any).vip_info) pfWide('VIPs', (client as any).vip_info)
    if ((client as any).dress_code) pfWide('Dress Code / Vibe', (client as any).dress_code)
    if ((client as any).post_event_notes) pfWide('Post-Event', (client as any).post_event_notes)
    if (client.notes) pfWide('Additional Notes', client.notes)
  }

  addFooter(doc, 1)
  return doc.output('blob')
}

// ─── Invoice ──────────────────────────────────────────────────────────────────

export function generateInvoice(client: Client, invoiceNumber: string): Blob {
  const doc = createDoc()
  addHeader(doc, 'Invoice')

  let y = 110

  // Invoice meta
  doc.setFontSize(10)
  doc.setTextColor(15, 14, 12)
  addField(doc, 'Invoice Number', invoiceNumber, 50, y)
  addField(doc, 'Invoice Date', formatDate(new Date().toISOString()), 200, y)
  addField(doc, 'Due Date', formatDate(new Date(Date.now() + 30 * 86400000).toISOString()), 370, y)
  y += 50

  // Billed to
  doc.setDrawColor(201, 168, 76)
  doc.setLineWidth(0.5)
  doc.line(50, y, 562, y)
  y += 16
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('BILLED TO', 50, y)
  y += 16
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 58, 54)
  doc.text(`${pc(client)?.first_name || "—"} ${pc(client)?.last_name || "—"}`, 50, y); y += 14
  if (pc(client)?.title || "—") { doc.text(pc(client)?.title || "—", 50, y); y += 14 }
  doc.text(client.organization, 50, y); y += 14
  doc.text(pc(client)?.email || "—", 50, y); y += 30

  // Line items
  doc.setDrawColor(201, 168, 76)
  doc.line(50, y, 562, y)
  y += 16

  // Table header
  doc.setFillColor(247, 246, 243)
  doc.rect(50, y - 6, 512, 22, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 97, 90)
  doc.text('DESCRIPTION', 60, y + 8)
  doc.text('AMOUNT', 530, y + 8, { align: 'right' })
  y += 30

  // Line item: speaking fee
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(15, 14, 12)
  const desc = `Keynote / Speaking Fee — ${client.event_name || client.topic || 'Speaking Engagement'}\n${formatDate(client.event_date)} · ${client.event_city || ''} · ${client.organization}`
  const descLines = doc.splitTextToSize(desc, 380)
  doc.text(descLines, 60, y)
  doc.text(formatCurrency(client.fee), 530, y, { align: 'right' })
  y += descLines.length * 14 + 10

  // Travel if applicable
  if (client.travel_covered) {
    doc.text('Travel & Accommodation (per agreement — covered by Client)', 60, y)
    doc.text('—', 530, y, { align: 'right' })
    y += 20
  }

  // Total
  y += 10
  doc.setDrawColor(201, 168, 76)
  doc.line(400, y, 562, y)
  y += 14
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('TOTAL DUE', 400, y)
  doc.text(formatCurrency(client.fee), 530, y, { align: 'right' })
  y += 40

  // Payment instructions
  doc.setDrawColor(200, 198, 194)
  doc.line(50, y, 562, y)
  y += 16
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('PAYMENT INSTRUCTIONS', 50, y)
  y += 14
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 58, 54)
  const payLines = [
    'Wire Transfer / ACH: [TODO: Add bank details]',
    'Check payable to: Mori Taheripour',
    'Please include invoice number in payment reference.',
    'Questions: team@moritaheripour.com',
  ]
  for (const l of payLines) { doc.text(l, 50, y); y += 14 }
  y += 20
  doc.setFontSize(9)
  doc.setTextColor(100, 97, 90)
  doc.text('Thank you for the opportunity to work together.', 50, y)

  addFooter(doc, 1)
  return doc.output('blob')
}