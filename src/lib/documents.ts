// Document generation using jsPDF
// Templates are data-merge only — no AI, deterministic output

import { Engagement, BusinessProfile, primaryContact } from '@/types'
type Client = Engagement

function pc(client: Client) {
  return primaryContact(client)
}
import { formatDate, formatCurrency } from './utils'

// Sanitize unicode characters that Helvetica can't render
function s(text: string | undefined | null): string {
  if (!text) return ''
  return String(text)
    .replace(/→|➔|⟶/g, '->')
    .replace(/←/g, '<-')
    .replace(/–/g, '-')
    .replace(/—/g, '--')
    .replace(/’|‘/g, "'")
    .replace(/“|”/g, '"')
    .replace(/…/g, '...')
    .replace(/[^\x00-\xFF]/g, '?') // replace any remaining non-latin-1
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function formatRosDatePdf(d: string): string {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// Normalize a run_of_show row from whatever Claude wrote to {date, time, end_time, what, notes}
function normalizeRosForPdf(r: Record<string, unknown>) {
  const rawTime = (r.time ?? r.start_time ?? '') as string
  const isIsoDate = ISO_DATE_RE.test(rawTime)
  const rawDate = (r.date ?? (isIsoDate ? rawTime : undefined)) as string | undefined
  return {
    date: rawDate ? (ISO_DATE_RE.test(rawDate) ? formatRosDatePdf(rawDate) : rawDate) : '',
    time: (isIsoDate ? '' : rawTime) as string,
    end_time: (r.end_time ?? '') as string,
    what: s((r.what ?? r.session ?? r.title ?? r.description ?? '') as string),
    notes: s((r.notes ?? r.role ?? '') as string),
  }
}

// ─── Shared PDF setup ─────────────────────────────────────────────────────────

function createDoc() {
  // jsPDF is loaded client-side only
  const { jsPDF } = require('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  return doc
}

// Logo image to use in place of the typed name in the invoice header.
// Drop the file at public/signature.png (any source format — it's re-encoded to
// PNG via canvas so JPG/WebP/etc. all work) — falls back to a plain text
// wordmark if absent.
type SignatureImage = { dataUrl: string; width: number; height: number }

async function loadSignatureImage(): Promise<SignatureImage | null> {
  try {
    const res = await fetch('/signature.png')
    if (!res.ok) return null
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = reject
        el.src = objectUrl
      })
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.drawImage(img, 0, 0)
      return { dataUrl: canvas.toDataURL('image/png'), width: img.naturalWidth, height: img.naturalHeight }
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  } catch {
    return null
  }
}

// ─── Invoice header — quiet, monochrome brand treatment ────────────────────────
// Separate from the contract header so each can evolve independently.
// Content starts at y = 116 after this call. Business address/phone/fax now
// live in the From/Billed-To two-column section below, not the header.

function addInvoiceHeader(doc: any, title: string, signature: SignatureImage | null) {
  const LOGO_TOP = 14, LOGO_MAX_H = 44, LOGO_MAX_W = 170

  if (signature) {
    const scale = Math.min(LOGO_MAX_H / signature.height, LOGO_MAX_W / signature.width, 1)
    const w = signature.width * scale, h = signature.height * scale
    doc.addImage(signature.dataUrl, 'PNG', 50, LOGO_TOP, w, h)
  } else {
    doc.setFont('times', 'normal')
    doc.setFontSize(21)
    doc.setTextColor(15, 14, 12)
    doc.text('Mori Taheripour', 50, LOGO_TOP + LOGO_MAX_H / 2 + 7)
  }

  // Hairline rule
  doc.setDrawColor(205, 202, 196)
  doc.setLineWidth(0.5)
  doc.line(50, 70, 562, 70)

  // Document title — modest, ink
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12.5)
  doc.setTextColor(80, 78, 72)
  doc.text(title.toUpperCase(), 50, 88)

  // Single stronger rule to close the header
  doc.setDrawColor(15, 14, 12)
  doc.setLineWidth(0.6)
  doc.line(50, 96, 562, 96)

  // Reset all state so callers start clean
  doc.setDrawColor(15, 14, 12)
  doc.setLineWidth(0.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(15, 14, 12)
}

// ─── From / Billed To — two-column letterhead + client block ──────────────────
// Left: the business's own letterhead info. Right: who the invoice is billed
// to. Returns the y position to continue from.

// Draws each wrapped line individually at an exact lineHeight apart, rather
// than handing jsPDF an array (which spaces multi-line text using its own
// internal line-height factor — ~1.15x font size — causing lines within one
// call to sit closer together than the gap to the next field).
function addWrappedLine(doc: any, text: string, x: number, y: number, maxWidth: number, lineHeight = 13): number {
  const lines = doc.splitTextToSize(text, maxWidth)
  for (const line of lines) {
    doc.text(line, x, y)
    y += lineHeight
  }
  return y
}

function addFromBilledTo(doc: any, y: number, L: number, R: number, business: BusinessProfile, client: Client): number {
  const rightX = L + (R - L) / 2 + 6
  const colWidth = rightX - L - 12

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(140, 137, 130)
  doc.text('FROM', L, y)
  doc.text('BILLED TO', rightX, y)

  let yLeft = y + 13
  doc.setFontSize(10)
  doc.setTextColor(15, 14, 12)
  yLeft = addWrappedLine(doc, business.name, L, yLeft, colWidth)
  doc.setTextColor(110, 107, 100)
  if (business.address) yLeft = addWrappedLine(doc, business.address, L, yLeft, colWidth)
  if (business.phone) yLeft = addWrappedLine(doc, business.phone, L, yLeft, colWidth)
  if (business.fax) yLeft = addWrappedLine(doc, `Fax: ${business.fax}`, L, yLeft, colWidth)

  const c = pc(client) as any
  const fullName = [c?.first_name, c?.last_name].filter(Boolean).join(' ') || '—'
  let yRight = y + 13
  doc.setFontSize(10)
  doc.setTextColor(15, 14, 12)
  yRight = addWrappedLine(doc, fullName, rightX, yRight, R - rightX)
  doc.setTextColor(110, 107, 100)
  if (c?.title) yRight = addWrappedLine(doc, c.title, rightX, yRight, R - rightX)
  yRight = addWrappedLine(doc, client.organization || '—', rightX, yRight, R - rightX)
  if (c?.address) yRight = addWrappedLine(doc, c.address, rightX, yRight, R - rightX)
  if (c?.phone) yRight = addWrappedLine(doc, c.phone, rightX, yRight, R - rightX)
  if (c?.email) yRight = addWrappedLine(doc, c.email, rightX, yRight, R - rightX)

  doc.setTextColor(15, 14, 12)
  return Math.max(yLeft, yRight) + 22
}

// Shaded DESCRIPTION/AMOUNT table header — vertically centers the caps text
// in the box and returns a y with generous clearance before the first line item.
function addLineItemsTableHeader(doc: any, y: number, L: number, R: number, W: number): number {
  const boxH = 24
  doc.setFillColor(248, 246, 242)
  doc.rect(L, y, W, boxH, 'F')
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(130, 127, 120)
  const textY = y + boxH / 2 + 2.6
  doc.text('DESCRIPTION', L + 8, textY)
  doc.text('AMOUNT', R - 8, textY, { align: 'right' })
  return y + boxH + 18
}

// ─── Contract / legacy header (used by generateContract) ──────────────────────

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
  doc.setDrawColor(210, 208, 202)
  doc.setLineWidth(0.3)
  doc.line(50, 748, 562, 748)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(165, 162, 155)
  doc.text('moritaheripour.com  ·  admin@moritaheripour.com', 50, 761)
  doc.text(`Page ${pageNum}`, 562, 761, { align: 'right' })
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

function buildBriefingDoc(client: Client) {
  const doc = createDoc()
  const c = pc(client)
  const eventType = (client as any).event_type || 'speaking'
  const hasPhysical = client.event_format === 'in_person' || client.event_format === 'hybrid'
  const isVirtual = !hasPhysical

  const L = 50, W = 512
  let y = 50
  const PAGE_H = 760

  const checkPage = (needed = 40) => {
    if (y + needed > PAGE_H) { doc.addPage(); y = 50 }
  }

  const rule = () => {
    checkPage(20)
    doc.setDrawColor(200, 198, 194)
    doc.setLineWidth(0.4)
    doc.line(L, y, L + W, y)
    y += 16
  }

  // Bold label at fixed column, normal value wrapping beside it
  const LABEL_W = 88
  const field = (label: string, value: string | undefined | null) => {
    if (!value) return
    const lines = doc.splitTextToSize(s(value), W - LABEL_W)
    checkPage(lines.length * 14 + 4)
    doc.setFontSize(10.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 14, 12)
    doc.text(label, L, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(40, 38, 34)
    doc.text(lines, L + LABEL_W, y)
    y += Math.max(lines.length, 1) * 14 + 2
  }

  // ── HEADER ──────────────────────────────────────────────────────────────────
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 14, 12)
  doc.text('Mori Taheripour', L, y)
  y += 18
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('Briefing Document', L, y)
  y += 14
  rule()

  // ── WHAT ────────────────────────────────────────────────────────────────────
  const typeLabels: Record<string, string> = {
    speaking: '', podcast: 'Podcast', interview: 'Interview', panel: 'Panel', livestream: 'Livestream',
  }
  const typeLabel = typeLabels[eventType] || ''
  const eventName = client.event_name || client.organization
  field('What:', typeLabel ? `${eventName} — ${typeLabel}` : eventName)
  if (client.topic) field('Topic:', client.topic)
  if ((client as any).purpose) {
    const purposeLines = doc.splitTextToSize(s((client as any).purpose), W)
    checkPage(purposeLines.length * 13 + 4)
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 58, 54)
    doc.text(purposeLines, L, y)
    y += purposeLines.length * 13 + 4
  }

  // ── WHEN ────────────────────────────────────────────────────────────────────
  const dateTime = [formatDate(client.event_date), client.event_time].filter(Boolean).join(' | ')
  field('When:', dateTime)
  if (client.session_length) field('Duration:', `${client.session_length} minutes`)

  // ── WHERE ───────────────────────────────────────────────────────────────────
  const whereStr = hasPhysical
    ? [client.event_location, client.event_city].filter(Boolean).join(', ')
    : 'Virtual'
  field('Where:', whereStr || '—')
  if (isVirtual && (client as any).join_link) field('Join Link:', s((client as any).join_link))
  if (isVirtual && (client as any).dial_in_backup) field('Dial-in:', s((client as any).dial_in_backup))
  if ((client as any).arrival_time) field('Arrival:', s((client as any).arrival_time))
  if ((client as any).venue_special_instructions) field('Note:', s((client as any).venue_special_instructions))

  // ── OTHER DETAILS ──────────────────────────────────────────────────────────
  const audienceParts = [
    (client as any).audience_description,
    client.audience_size ? `~${client.audience_size.toLocaleString()} attendees` : null,
  ].filter(Boolean)
  if (audienceParts.length) field('Audience:', audienceParts.join(' · '))

  if (c) {
    const contactStr = [
      `${c.first_name} ${c.last_name}`,
      c.title, c.phone, c.email,
    ].filter(Boolean).join(' | ')
    field('Contact:', contactStr)
  }

  if ((client as any).moderator_info) field('Moderator:', s((client as any).moderator_info))
  if ((client as any).panelist_info) field('Co-Panelists:', s((client as any).panelist_info))
  if ((client as any).vip_info) field('VIPs:', s((client as any).vip_info))
  if ((client as any).dress_code) field('Dress Code:', s((client as any).dress_code))

  // ── TRAVEL ──────────────────────────────────────────────────────────────────
  const hasTravel = (client as any).flight_details || (client as any).hotel_name || (client as any).drive_time
  if (hasTravel) {
    y += 4; rule()
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 14, 12)
    doc.text('Travel', L, y); y += 14

    if ((client as any).flight_details) {
      const flightStr = s((client as any).flight_details) +
        ((client as any).flight_confirmation ? ` — Conf: ${s((client as any).flight_confirmation)}` : '')
      field('Flight:', flightStr)
    }
    if ((client as any).hotel_name) {
      const hotelStr = [
        s((client as any).hotel_name),
        (client as any).hotel_checkin ? `Check-in: ${s((client as any).hotel_checkin)}` : null,
        (client as any).hotel_confirmation ? `Conf: ${s((client as any).hotel_confirmation)}` : null,
      ].filter(Boolean).join(' | ')
      field('Hotel:', hotelStr)
    }
    if ((client as any).ground_transport) field('Transport:', s((client as any).ground_transport))
    if ((client as any).drive_time) field('Drive Time:', s((client as any).drive_time))
    if ((client as any).parking_details) field('Parking:', s((client as any).parking_details))
  }

  // ── RUN OF SHOW ──────────────────────────────────────────────────────────────
  const rosRaw = (client as any).run_of_show as Record<string, unknown>[] | undefined
  if (rosRaw && rosRaw.length > 0) {
    const ros = rosRaw.map(normalizeRosForPdf)
    y += 4; rule()
    checkPage(60)
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 14, 12)
    doc.text('Run of Show', L, y); y += 16

    doc.setFillColor(245, 244, 242)
    doc.rect(L, y - 5, W, 18, 'F')
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 78, 72)
    doc.text('TIME', L + 4, y + 6)
    doc.text('ACTIVITY', L + 150, y + 6)
    doc.text('NOTES', L + 365, y + 6)
    y += 20

    doc.setFontSize(9.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(15, 14, 12)
    const lineH = 13
    const maxNoteLines = 4
    for (let ri = 0; ri < ros.length; ri++) {
      const r = ros[ri]
      const timeRange = [r.time, r.end_time].filter(Boolean).join(' – ')
      const timeLabel = [r.date, timeRange].filter(Boolean).join('\n')
      const timeLines: string[] = timeLabel ? doc.splitTextToSize(timeLabel, 130) : []
      const whatLines: string[] = r.what ? doc.splitTextToSize(r.what, 195) : []
      const allNoteLines: string[] = r.notes ? doc.splitTextToSize(r.notes, 130) : []
      const noteLines = allNoteLines.slice(0, maxNoteLines)
      if (allNoteLines.length > maxNoteLines) noteLines[maxNoteLines - 1] += '...'
      const rowH = Math.max(timeLines.length, whatLines.length, noteLines.length, 1) * lineH + 10
      checkPage(rowH + 4)

      if (ri % 2 === 0) {
        doc.setFillColor(251, 250, 248)
        doc.rect(L, y - 3, W, rowH, 'F')
      }

      doc.setFont('helvetica', 'bold')
      if (timeLines.length) doc.text(timeLines, L + 4, y)
      doc.setFont('helvetica', 'normal')
      if (whatLines.length) doc.text(whatLines, L + 150, y)
      if (noteLines.length) {
        doc.setTextColor(80, 78, 72)
        doc.text(noteLines, L + 365, y)
        doc.setTextColor(15, 14, 12)
      }

      doc.setDrawColor(225, 223, 218); doc.setLineWidth(0.2)
      doc.line(L, y + rowH - 3, L + W, y + rowH - 3)
      y += rowH
    }
  }

  // ── NOTES ──────────────────────────────────────────────────────────────────
  const hasNotes = client.notes || (client as any).post_event_notes
  if (hasNotes) {
    y += 4; rule()
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 14, 12)
    doc.text('Notes', L, y); y += 14
    if (client.notes) {
      const lines = doc.splitTextToSize(s(client.notes), W)
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 38, 34)
      doc.text(lines, L, y); y += lines.length * 13 + 6
    }
    if ((client as any).post_event_notes) field('Post-Event:', s((client as any).post_event_notes))
  }

  // ── KEY DOCUMENTS ──────────────────────────────────────────────────────────
  const incoming: { label: string; link?: string; url?: string; file_url?: string; pinned_to_briefing?: boolean }[] =
    (client as any).incoming_materials ?? []
  const keyDocs = incoming.filter(m => m.pinned_to_briefing !== false && (m.link || m.file_url || (m as any).url))

  if (keyDocs.length > 0) {
    y += 4; rule()
    checkPage(50)
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 14, 12)
    doc.text('Key Documents', L, y); y += 14

    doc.setFontSize(9.5)
    for (const doc_ of keyDocs) {
      const fileHref = doc_.file_url || ''
      const linkHref = doc_.link || (doc_ as any).url || ''
      const linkCount = (fileHref ? 1 : 0) + (linkHref ? 1 : 0)
      checkPage(14 + linkCount * 14 + 6)

      doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 14, 12)
      doc.text(s(doc_.label), L, y)
      let subY = y + 13

      // Use doc.link() + doc.text() separately — textWithLink causes font encoding issues
      const addClickableLink = (label: string, url: string) => {
        doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 100, 180)
        doc.text(label, L, subY)
        doc.link(L, subY - 9, doc.getTextWidth(label), 11, { url })
        doc.setTextColor(15, 14, 12)
        subY += 13
      }

      if (fileHref) addClickableLink('View uploaded file', fileHref)
      if (linkHref) addClickableLink('Open link', linkHref)

      y = subY + 4
    }
  }

  // ── FOOTER ────────────────────────────────────────────────────────────────
  doc.setFontSize(8)
  doc.setTextColor(150, 148, 144)
  doc.text('Page 1', L + W, 760, { align: 'right' })

  return doc
}

export function generateBriefingDoc(client: Client): Blob {
  return buildBriefingDoc(client).output('blob') as Blob
}

export function generateBriefingDocBytes(client: Client): Buffer {
  const ab = buildBriefingDoc(client).output('arraybuffer') as ArrayBuffer
  return Buffer.from(ab)
}

// ─── Invoice ──────────────────────────────────────────────────────────────────

export async function generateInvoice(client: Client, invoiceNumber: string, business: BusinessProfile): Promise<Blob> {
  const doc = createDoc()
  const signature = await loadSignatureImage()
  addInvoiceHeader(doc, 'Invoice', signature)

  let y = 116
  const L = 50, R = 562, W = 512

  // ── Meta row ──────────────────────────────────────────────────────────────
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(140, 137, 130)
  doc.text('INVOICE NUMBER', L, y)
  doc.text('INVOICE DATE', 230, y)
  y += 12
  doc.setFontSize(10)
  doc.setTextColor(15, 14, 12)
  doc.text(invoiceNumber, L, y)
  doc.text(formatDate(new Date().toISOString()), 230, y)
  y += 24

  // ── From / Billed To ──────────────────────────────────────────────────────
  doc.setDrawColor(210, 208, 202)
  doc.setLineWidth(0.4)
  doc.line(L, y, R, y)
  y += 14

  y = addFromBilledTo(doc, y, L, R, business, client)

  // ── Line items ────────────────────────────────────────────────────────────
  doc.setDrawColor(210, 208, 202)
  doc.setLineWidth(0.4)
  doc.line(L, y, R, y)
  y += 14

  y = addLineItemsTableHeader(doc, y, L, R, W)

  // Speaking fee line
  const eventLabel = client.event_name || client.topic || 'Speaking Engagement'
  doc.setFontSize(10)
  doc.setTextColor(15, 14, 12)
  doc.text('Keynote / Speaking Fee', L + 8, y)
  doc.text(formatCurrency(client.fee), R - 8, y, { align: 'right' })
  y += 14

  doc.setFontSize(10)
  doc.setTextColor(110, 107, 100)
  const subDesc = s(`${eventLabel}  ·  ${formatDate(client.event_date)}${client.event_city ? '  ·  ' + client.event_city : ''}  ·  ${client.organization}`)
  y = addWrappedLine(doc, subDesc, L + 8, y, 400) + 12

  // Travel line (if applicable)
  if (client.travel_covered) {
    doc.setFontSize(10)
    doc.setTextColor(15, 14, 12)
    doc.text('Travel & Accommodation', L + 8, y)
    doc.text('—', R - 8, y, { align: 'right' })
    y += 13
    doc.setFontSize(10)
    doc.setTextColor(110, 107, 100)
    doc.text('Per agreement — covered by client', L + 8, y)
    y += 18
  }

  // ── Total ─────────────────────────────────────────────────────────────────
  y += 6
  doc.setDrawColor(15, 14, 12)
  doc.setLineWidth(0.8)
  doc.line(370, y, R, y)
  y += 15

  doc.setFontSize(7.5)
  doc.setTextColor(140, 137, 130)
  doc.text('TOTAL DUE', 378, y)

  doc.setFontSize(10)
  doc.setTextColor(15, 14, 12)
  doc.text(formatCurrency(client.fee), R - 8, y, { align: 'right' })
  y += 30

  // ── Payment instructions ──────────────────────────────────────────────────
  doc.setDrawColor(210, 208, 202)
  doc.setLineWidth(0.3)
  doc.line(L, y, R, y)
  y += 15

  doc.setFontSize(7.5)
  doc.setTextColor(140, 137, 130)
  doc.text('BILLING INFORMATION', L, y)
  y += 14

  const payRows: [string, string][] = [
    ['Wire / ACH', 'Wells Fargo Bank  ·  Acct Name: MT Global Strategies\nAcct #: 6352499294  ·  Routing #: 121000248'],
    ['Check', 'Payable to MT Global Strategies'],
  ]
  doc.setFont('helvetica', 'normal')
  for (const [label, value] of payRows) {
    doc.setFontSize(10)
    doc.setTextColor(40, 38, 34)
    doc.text(label, L, y)
    doc.setTextColor(100, 97, 90)
    y = addWrappedLine(doc, s(value), L + 110, y, 370) + 3
  }

  return doc.output('blob')
}

// ─── Deposit Invoice ───────────────────────────────────────────────────────────

export async function generateDepositInvoice(client: Client, invoiceNumber: string, business: BusinessProfile): Promise<Blob> {
  const doc = createDoc()
  const signature = await loadSignatureImage()
  addInvoiceHeader(doc, 'Deposit Invoice', signature)

  let y = 116
  const L = 50, R = 562, W = 512

  // ── Meta row ──────────────────────────────────────────────────────────────
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(140, 137, 130)
  doc.text('INVOICE NUMBER', L, y)
  doc.text('INVOICE DATE', 230, y)
  y += 12
  doc.setFontSize(10)
  doc.setTextColor(15, 14, 12)
  doc.text(invoiceNumber, L, y)
  doc.text(formatDate(new Date().toISOString()), 230, y)
  y += 24

  // ── From / Billed To ──────────────────────────────────────────────────────
  doc.setDrawColor(210, 208, 202)
  doc.setLineWidth(0.4)
  doc.line(L, y, R, y)
  y += 14

  y = addFromBilledTo(doc, y, L, R, business, client)

  // ── Line items ────────────────────────────────────────────────────────────
  doc.setDrawColor(210, 208, 202)
  doc.setLineWidth(0.4)
  doc.line(L, y, R, y)
  y += 14

  y = addLineItemsTableHeader(doc, y, L, R, W)

  const depositAmount = client.deposit_amount ?? 0
  const eventLabel = client.event_name || client.topic || 'Speaking Engagement'

  doc.setFontSize(10)
  doc.setTextColor(15, 14, 12)
  doc.text('Deposit — Speaking Fee', L + 8, y)
  doc.text(formatCurrency(depositAmount), R - 8, y, { align: 'right' })
  y += 14

  doc.setFontSize(10)
  doc.setTextColor(110, 107, 100)
  const subDesc = s(`${eventLabel}  ·  ${formatDate(client.event_date)}${client.event_city ? '  ·  ' + client.event_city : ''}  ·  ${client.organization}`)
  y = addWrappedLine(doc, subDesc, L + 8, y, 400) + 12

  // ── Fee summary breakdown ─────────────────────────────────────────────────
  y += 8

  // Total fee (context row — grayed)
  if (client.fee) {
    doc.setFontSize(10)
    doc.setTextColor(140, 137, 130)
    doc.text('Total Speaking Fee', 375, y)
    doc.setTextColor(110, 107, 100)
    doc.text(formatCurrency(client.fee), R - 8, y, { align: 'right' })
    y += 14
  }

  // Rule then the primary deposit row
  doc.setDrawColor(15, 14, 12)
  doc.setLineWidth(0.8)
  doc.line(370, y, R, y)
  y += 14

  doc.setFontSize(7.5)
  doc.setTextColor(140, 137, 130)
  doc.text('DEPOSIT DUE (THIS INVOICE)', 375, y)
  doc.setFontSize(10)
  doc.setTextColor(15, 14, 12)
  doc.text(formatCurrency(depositAmount), R - 8, y, { align: 'right' })
  y += 18

  // Balance row
  if (client.fee && client.fee > depositAmount) {
    doc.setFontSize(10)
    doc.setTextColor(140, 137, 130)
    doc.text('Balance Due After Event', 375, y)
    doc.setTextColor(110, 107, 100)
    doc.text(formatCurrency(client.fee - depositAmount), R - 8, y, { align: 'right' })
    y += 14
  }
  y += 16

  // Confirming language
  doc.setFontSize(10)
  doc.setTextColor(130, 127, 120)
  const confirmText = s('This deposit confirms your engagement and is applied toward the total speaking fee. The remaining balance will be invoiced separately following the event.')
  y = addWrappedLine(doc, confirmText, L, y, W, 12) + 22

  // ── Payment instructions ──────────────────────────────────────────────────
  doc.setDrawColor(210, 208, 202)
  doc.setLineWidth(0.3)
  doc.line(L, y, R, y)
  y += 15

  doc.setFontSize(7.5)
  doc.setTextColor(140, 137, 130)
  doc.text('BILLING INFORMATION', L, y)
  y += 14

  const payRows: [string, string][] = [
    ['Wire / ACH', 'Wells Fargo Bank  ·  Acct Name: MT Global Strategies\nAcct #: 6352499294  ·  Routing #: 121000248'],
    ['Check', 'Payable to MT Global Strategies'],
  ]
  for (const [label, value] of payRows) {
    doc.setFontSize(10)
    doc.setTextColor(40, 38, 34)
    doc.text(label, L, y)
    doc.setTextColor(100, 97, 90)
    y = addWrappedLine(doc, s(value), L + 110, y, 370) + 3
  }

  return doc.output('blob')
}