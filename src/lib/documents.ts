// Document generation using jsPDF
// Templates are data-merge only — no AI, deterministic output

import { Engagement, BusinessProfile, ContractTemplateBlock, primaryContact } from '@/types'
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

// ─── Contract ─────────────────────────────────────────────────────────────────
// Matches the firm's real "Agreement: Speaking Engagement" template, letterhead
// and terms verbatim — this is a document a client actually signs, not a
// stylistic mock-up, so section wording follows the supplied boilerplate.
//
// One font, one size, throughout (CONTRACT_FONT/CONTRACT_SIZE below) — headers,
// labels, and emphasis are distinguished only by bold weight and, where it
// helps scanning, all caps. The one exception is the fallback text wordmark in
// the header, which stands in for a graphic logo when no signature image is
// configured, not for document content.

const CONTRACT_L = 50, CONTRACT_R = 562, CONTRACT_W = CONTRACT_R - CONTRACT_L
const CONTRACT_PAGE_H = 740
const CONTRACT_FONT = 'helvetica'
const CONTRACT_SIZE = 10
const CONTRACT_LINE_H = 13

// Centered logo (falls back to a text wordmark), DATE line, and the title —
// same plain, monochrome treatment as the invoice header (addInvoiceHeader):
// no accent color anywhere in the document, just ink and gray.
function addContractHeader(doc: any, signature: SignatureImage | null, dateStr: string) {
  doc.setFont(CONTRACT_FONT, 'normal')
  doc.setFontSize(CONTRACT_SIZE)
  doc.setTextColor(15, 14, 12)
  doc.text(dateStr, CONTRACT_L, 40)

  if (signature) {
    const maxW = 160, maxH = 46
    const scale = Math.min(maxH / signature.height, maxW / signature.width, 1)
    const w = signature.width * scale, h = signature.height * scale
    doc.addImage(signature.dataUrl, 'PNG', (612 - w) / 2, 44, w, h)
  } else {
    // Stands in for a graphic logo — not document content, so exempt from
    // the body's font/size rule the same way an <img> alt text would be.
    doc.setFont(CONTRACT_FONT, 'bold')
    doc.setFontSize(15)
    doc.text('MT GLOBAL STRATEGIES', 306, 68, { align: 'center' })
  }

  // Light hairline, then the bold uppercase title, then a stronger rule
  // closing the header — identical two-rule structure to addInvoiceHeader.
  doc.setDrawColor(205, 202, 196)
  doc.setLineWidth(0.5)
  doc.line(CONTRACT_L, 100, CONTRACT_R, 100)

  doc.setFont(CONTRACT_FONT, 'bold')
  doc.setFontSize(CONTRACT_SIZE)
  doc.setTextColor(80, 78, 72)
  doc.text('AGREEMENT: SPEAKING ENGAGEMENT', CONTRACT_L, 118)

  doc.setDrawColor(15, 14, 12)
  doc.setLineWidth(0.6)
  doc.line(CONTRACT_L, 126, CONTRACT_R, 126)

  doc.setDrawColor(15, 14, 12)
  doc.setLineWidth(0.5)
  doc.setFont(CONTRACT_FONT, 'normal')
  doc.setFontSize(CONTRACT_SIZE)
  doc.setTextColor(15, 14, 12)
}

// One bordered two-column row of the Program Details table (label | wrapped value lines).
// Quiet hairline borders + a pale shaded label cell, matching the invoice's
// table-header treatment. Label is bold caps, value is plain — same font and
// size as everything else, distinguished only by weight/case. Both columns
// wrap independently and the row grows to fit whichever is taller — some
// labels ("Event / Hotel Venue / Virtual Platform:") are long enough at this
// size to need more than one line.
function addProgramRow(doc: any, y: number, label: string, valueLines: string[], labelW = 175): number {
  const content = valueLines.length ? valueLines : ['—']
  doc.setFont(CONTRACT_FONT, 'bold')
  doc.setFontSize(CONTRACT_SIZE)
  const labelLines: string[] = doc.splitTextToSize(label.toUpperCase(), labelW - 16)
  const rowH = Math.max(Math.max(labelLines.length, content.length) * CONTRACT_LINE_H + 12, 28)
  doc.setFillColor(248, 246, 242)
  doc.rect(CONTRACT_L, y, labelW, rowH, 'F')
  doc.setDrawColor(205, 202, 196)
  doc.setLineWidth(0.5)
  doc.rect(CONTRACT_L, y, CONTRACT_W, rowH)
  doc.line(CONTRACT_L + labelW, y, CONTRACT_L + labelW, y + rowH)
  doc.setTextColor(80, 78, 72)
  doc.text(labelLines, CONTRACT_L + 8, y + 16)
  doc.setFont(CONTRACT_FONT, 'normal')
  doc.setTextColor(15, 14, 12)
  doc.text(content, CONTRACT_L + labelW + 8, y + 16)
  return y + rowH
}

// Hairline rule that opens a new major section — the invoice's segmented,
// breathable feel rather than one dense block of legal text.
function addSectionRule(doc: any, y: number): number {
  doc.setDrawColor(205, 202, 196)
  doc.setLineWidth(0.4)
  doc.line(CONTRACT_L, y, CONTRACT_R, y)
  return y + 18
}

// Hanging-indent bullet: the bullet sits at x, wrapped continuation lines
// align under the text (not flush back to the bullet) — matches how a
// professionally typeset bullet list wraps.
function addBullet(doc: any, text: string, x: number, y: number, width: number, lineH = CONTRACT_LINE_H): number {
  const bulletW = 12
  const lines = doc.splitTextToSize(text, width - bulletW)
  doc.text('•', x, y)
  for (let i = 0; i < lines.length; i++) {
    doc.text(lines[i], x + bulletW, y + i * lineH)
  }
  return y + lines.length * lineH
}

// Fills {{tag}} placeholders in template content from the merge-field data
// for this render, then sanitizes the result — covers both author-typed
// unicode and merge-field-injected unicode in one pass.
function substituteMergeFields(text: string, data: Record<string, string>): string {
  return s(text.replace(/\{\{(\w+)\}\}/g, (_match, key) => data[key] ?? ''))
}

export async function generateContract(client: Client, business: BusinessProfile, blocks: ContractTemplateBlock[]): Promise<Blob> {
  const doc = createDoc()
  const signature = await loadSignatureImage()
  const c = pc(client) as any
  const anyClient = client as any

  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  addContractHeader(doc, signature, dateStr)

  let y = 145
  const checkPage = (needed = 40) => {
    if (y + needed > CONTRACT_PAGE_H) { doc.addPage(); y = 50 }
  }

  const businessAddress = (business.address || '2425 L Street NW, #409 Washington, DC 20037').replace(/\n+/g, ', ')
  const clientAddress = s(c?.address)

  doc.setFont(CONTRACT_FONT, 'normal')
  doc.setFontSize(CONTRACT_SIZE)
  doc.setTextColor(40, 38, 34)
  const intro = `This agreement is between MT GLOBAL STRATEGIES (the "Speaker"), located at ${businessAddress}, and ${s(client.organization)} (the "Client")${clientAddress ? `, with offices at ${clientAddress}` : ''}.`
  let introLines = doc.splitTextToSize(intro, CONTRACT_W)
  doc.text(introLines, CONTRACT_L, y)
  y += introLines.length * CONTRACT_LINE_H + 14

  const progIntro = 'Program Details: Client wishes to retain the services of "Speaker" for the purpose and terms below:'
  introLines = doc.splitTextToSize(progIntro, CONTRACT_W)
  doc.text(introLines, CONTRACT_L, y)
  y += introLines.length * CONTRACT_LINE_H + 12

  // ── Program Details table ──────────────────────────────────────────────────
  const isVirtual = client.event_format === 'virtual'
  const contactLines = c
    ? [`${s(c.first_name)} ${s(c.last_name)}`, c.title ? s(c.title) : null, c.email ? s(c.email) : null, c.phone ? s(c.phone) : null].filter(Boolean) as string[]
    : []
  const rosLines = (anyClient.run_of_show as Record<string, unknown>[] | undefined)?.length
    ? anyClient.run_of_show.map((r: Record<string, unknown>) => {
        const n = normalizeRosForPdf(r)
        return [n.date, n.time, n.what].filter(Boolean).join(' — ')
      })
    : []
  const scopeItems: string[] = (anyClient.project_scope ?? []).filter((x: string) => x && x.trim())

  checkPage(30)
  y = addProgramRow(doc, y, 'Speaker:', ['Mori Taheripour'])
  checkPage(30)
  y = addProgramRow(doc, y, 'Event Details:', [
    `Client: ${s(client.organization)}`,
    `Estimated Attendees: ${anyClient.audience_size ?? '—'}`,
    `Attendee Location: ${s(anyClient.attendee_location) || s(client.event_city) || '—'}`,
  ])
  checkPage(30)
  y = addProgramRow(doc, y, 'Date & Time:', [
    `Date: ${formatDate(client.event_date)}`,
    `Time: ${s(client.event_time) || '—'}`,
  ])
  checkPage(30)
  y = addProgramRow(doc, y, 'Event / Hotel Venue / Virtual Platform:', [
    `Location: ${s(client.event_location) || (isVirtual ? 'Virtual' : '—')}`,
    `Tech Platform: ${s(anyClient.tech_platform) || '—'}`,
  ])
  checkPage(30)
  y = addProgramRow(doc, y, 'Primary Contact(s):', contactLines)
  checkPage(30)
  y = addProgramRow(doc, y, 'Run of Show:', rosLines)
  y += 16

  // ── Project Scope Includes ───────────────────────────────────────────────────
  checkPage(30)
  doc.setFont(CONTRACT_FONT, 'bold')
  doc.setFontSize(CONTRACT_SIZE)
  doc.setTextColor(15, 14, 12)
  doc.text('PROJECT SCOPE INCLUDES:', CONTRACT_L, y)
  y += 16
  doc.setFont(CONTRACT_FONT, 'normal')
  doc.setTextColor(40, 38, 34)
  for (const item of (scopeItems.length ? scopeItems : [''])) {
    const lineCount = doc.splitTextToSize(s(item), CONTRACT_W - 20).length
    checkPage(lineCount * CONTRACT_LINE_H + 4)
    y = addBullet(doc, s(item), CONTRACT_L + 8, y, CONTRACT_W - 8)
    y += 4
  }
  y += 8

  // ── Template body: Compensation and Billing through Cancellation Policy ──────
  // Everything below is editable template content (see /contracts/templates),
  // not hardcoded — the structural sections above and Authorization below stay
  // fixed since they're data-shaped, not prose.
  const travelFee = s(anyClient.travel_fee) || 'TBD'
  const travelFeeNum = parseFloat(travelFee.replace(/[^0-9.]/g, ''))
  const hasNumericTravel = !isNaN(travelFeeNum) && /\d/.test(travelFee)
  const totalProgramFee = (client.fee ?? 0) + (hasNumericTravel ? travelFeeNum : 0)
  const depositAmt = client.deposit_amount ?? Math.round(totalProgramFee * 0.5)
  const balanceAmt = totalProgramFee - depositAmt

  const mergeData: Record<string, string> = {
    organization: s(client.organization),
    contact_name: [c?.first_name, c?.last_name].filter(Boolean).map((x: string) => s(x)).join(' '),
    contact_title: s(c?.title),
    contact_email: s(c?.email),
    contact_phone: s(c?.phone),
    event_name: s(client.event_name),
    event_date: formatDate(client.event_date),
    event_city: s(client.event_city),
    event_location: s(client.event_location),
    fee: formatCurrency(client.fee),
    travel_fee: travelFee,
    total_program_fee: formatCurrency(totalProgramFee),
    deposit_due: formatCurrency(depositAmt),
    balance_due: formatCurrency(balanceAmt),
    business_name: s(business.name) || 'MT GLOBAL STRATEGIES',
    business_address: s(business.address),
    date: dateStr,
  }

  for (const block of blocks) {
    if (block.type === 'heading') {
      checkPage(block.rule ? 80 : 30)
      if (block.rule) y = addSectionRule(doc, y)
      doc.setFont(CONTRACT_FONT, 'bold')
      doc.setFontSize(CONTRACT_SIZE)
      doc.setTextColor(15, 14, 12)
      doc.text(substituteMergeFields(block.text, mergeData).toUpperCase(), CONTRACT_L, y)
      y += 16
    } else if (block.type === 'paragraph') {
      const text = substituteMergeFields(block.text, mergeData)
      const lines = doc.splitTextToSize(text, CONTRACT_W)
      checkPage(lines.length * CONTRACT_LINE_H + 12)
      doc.setFont(CONTRACT_FONT, 'normal')
      doc.setTextColor(40, 38, 34)
      doc.text(lines, CONTRACT_L, y)
      y += lines.length * CONTRACT_LINE_H + 12
    } else if (block.type === 'key_value') {
      checkPage(20)
      doc.setFont(CONTRACT_FONT, 'bold')
      doc.setTextColor(...(block.emphasis === 'muted' ? [80, 78, 72] as const : [15, 14, 12] as const))
      doc.text(substituteMergeFields(block.text, mergeData), CONTRACT_L, y)
      y += 20
    } else if (block.type === 'bullet_list') {
      doc.setFont(CONTRACT_FONT, 'normal')
      doc.setTextColor(40, 38, 34)
      for (const item of block.items) {
        const text = substituteMergeFields(item, mergeData)
        const lineCount = doc.splitTextToSize(text, CONTRACT_W - 20).length
        checkPage(lineCount * CONTRACT_LINE_H + 6)
        y = addBullet(doc, text, CONTRACT_L + 8, y, CONTRACT_W - 8)
        y += 6
      }
    } else if (block.type === 'line_list') {
      doc.setFont(CONTRACT_FONT, 'normal')
      doc.setTextColor(40, 38, 34)
      for (const item of block.items) {
        const text = substituteMergeFields(item, mergeData)
        const lines = doc.splitTextToSize(text, CONTRACT_W)
        checkPage(lines.length * CONTRACT_LINE_H + 4)
        doc.text(lines, CONTRACT_L, y)
        y += lines.length * CONTRACT_LINE_H + 4
      }
    }
  }
  y += 10

  // ── Authorization ─────────────────────────────────────────────────────────────
  checkPage(140)
  y = addSectionRule(doc, y)
  doc.setFont(CONTRACT_FONT, 'bold')
  doc.setFontSize(CONTRACT_SIZE)
  doc.setTextColor(15, 14, 12)
  doc.text('AUTHORIZATION', CONTRACT_L, y)
  y += 16
  doc.setFont(CONTRACT_FONT, 'normal')
  doc.setTextColor(40, 38, 34)
  doc.text('All parties agree with the terms set forth in this document.', CONTRACT_L, y)
  y += 26

  doc.setFont(CONTRACT_FONT, 'bold')
  doc.setTextColor(15, 14, 12)
  doc.text('ACCEPTED ON BEHALF OF (CLIENT) BY:', CONTRACT_L, y)
  y += 24
  doc.setDrawColor(15, 14, 12)
  doc.setLineWidth(0.5)
  doc.line(CONTRACT_L, y, CONTRACT_L + 300, y)
  y += 12
  doc.setTextColor(100, 97, 90)
  doc.text('NAME & TITLE', CONTRACT_L, y)
  y += 22
  doc.line(CONTRACT_L, y, CONTRACT_L + 300, y)
  y += 12
  doc.text('COMPANY', CONTRACT_L, y)
  doc.text('DATE', CONTRACT_L + 340, y)
  y += 36

  doc.setFont(CONTRACT_FONT, 'bold')
  doc.setTextColor(15, 14, 12)
  checkPage(90)
  doc.text('ACCEPTED ON BEHALF OF MT GLOBAL STRATEGIES BY:', CONTRACT_L, y)
  y += 24
  doc.setDrawColor(15, 14, 12)
  doc.line(CONTRACT_L, y, CONTRACT_L + 300, y)
  y += 12
  doc.setTextColor(100, 97, 90)
  doc.text('NAME & TITLE', CONTRACT_L, y)
  y += 22
  doc.text('DATE', CONTRACT_L, y)

  // Page numbers
  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setFont(CONTRACT_FONT, 'normal')
    doc.setFontSize(CONTRACT_SIZE)
    doc.setTextColor(160, 157, 150)
    doc.text(`PAGE ${p} OF ${pageCount}`, CONTRACT_R, 775, { align: 'right' })
  }

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