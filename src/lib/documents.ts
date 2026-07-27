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
// A plain, letter-like document — closer to a Word letter than a branded
// template. One font, one body size throughout; headings are the same size,
// just bold and sentence case. No rules, borders, or shading anywhere. Empty
// fields are omitted entirely rather than printed as "—"/"TBD" placeholders,
// so a half-filled contract still reads clean. The only decoration kept is the
// centered logo lockup at the very top (the graphic wordmark).

const CONTRACT_L = 50, CONTRACT_R = 562, CONTRACT_W = CONTRACT_R - CONTRACT_L
const CONTRACT_PAGE_H = 740
const CONTRACT_FONT = 'helvetica'
const CONTRACT_SIZE = 11
const CONTRACT_LINE_H = 15

// Centered logo lockup (signature image, or the MT / GLOBAL STRATEGIES text
// wordmark as its graphic stand-in), a plain date line, and a plain bold
// sentence-case title sitting close to the body. No rules.
function addContractHeader(doc: any, signature: SignatureImage | null, dateStr: string) {
  doc.setFont(CONTRACT_FONT, 'normal')
  doc.setFontSize(CONTRACT_SIZE)
  doc.setTextColor(80, 78, 72)
  doc.text(dateStr, CONTRACT_L, 46)

  if (signature) {
    const maxW = 160, maxH = 44
    const scale = Math.min(maxH / signature.height, maxW / signature.width, 1)
    const w = signature.width * scale, h = signature.height * scale
    doc.addImage(signature.dataUrl, 'PNG', (612 - w) / 2, 36, w, h)
  } else {
    // The graphic wordmark stand-in — kept as-is (the one bit of branding).
    doc.setFont(CONTRACT_FONT, 'bold')
    doc.setFontSize(15)
    doc.setTextColor(15, 14, 12)
    doc.text('MT GLOBAL STRATEGIES', 306, 62, { align: 'center' })
  }

  doc.setFont(CONTRACT_FONT, 'bold')
  doc.setFontSize(CONTRACT_SIZE)
  doc.setTextColor(15, 14, 12)
  doc.text('Speaking agreement', CONTRACT_L, 98)

  doc.setFont(CONTRACT_FONT, 'normal')
  doc.setFontSize(CONTRACT_SIZE)
  doc.setTextColor(15, 14, 12)
}

// Hanging-indent bullet: the bullet sits at x, wrapped continuation lines
// align under the text (not flush back to the bullet).
function addBullet(doc: any, text: string, x: number, y: number, width: number, lineH = CONTRACT_LINE_H): number {
  const bulletW = 14
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

// Which {{fields}} a piece of template text references.
function referencedFields(text: string): string[] {
  const out: string[] = []
  text.replace(/\{\{(\w+)\}\}/g, (_m, key) => { out.push(key); return '' })
  return out
}

export async function generateContract(client: Client, business: BusinessProfile, blocks: ContractTemplateBlock[]): Promise<Blob> {
  const doc = createDoc()
  const signature = await loadSignatureImage()
  const c = pc(client) as any
  const anyClient = client as any

  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  addContractHeader(doc, signature, dateStr)

  let y = 120
  const checkPage = (needed = 40) => {
    if (y + needed > CONTRACT_PAGE_H) { doc.addPage(); y = 50 }
  }

  const businessAddress = (business.address || '2425 L Street NW, #409 Washington, DC 20037').replace(/\n+/g, ', ')
  const clientAddress = s(c?.address)

  doc.setFont(CONTRACT_FONT, 'normal')
  doc.setFontSize(CONTRACT_SIZE)
  doc.setTextColor(40, 38, 34)
  const intro = `This agreement is between MT Global Strategies (the "Speaker"), located at ${businessAddress}, and ${s(client.organization)} (the "Client")${clientAddress ? `, with offices at ${clientAddress}` : ''}.`
  const introLines = doc.splitTextToSize(intro, CONTRACT_W)
  doc.text(introLines, CONTRACT_L, y)
  y += introLines.length * CONTRACT_LINE_H + 16

  // ── Program details — flat bold-label / value lines, empties omitted ─────────
  const isVirtual = client.event_format === 'virtual'
  const contactValue = c
    ? [`${s(c.first_name)} ${s(c.last_name)}`.trim(), s(c.title), s(c.email), s(c.phone)].filter(Boolean).join(', ')
    : ''
  const rosLines: string[] = (anyClient.run_of_show as Record<string, unknown>[] | undefined)?.length
    ? anyClient.run_of_show.map((r: Record<string, unknown>) => {
        const n = normalizeRosForPdf(r)
        return s([n.date, n.time, n.what].filter(Boolean).join(' - '))
      }).filter((l: string) => l.trim())
    : []
  const scopeItems: string[] = (anyClient.project_scope ?? []).filter((x: string) => x && x.trim())

  // One "Label: value" line, label bold + value normal, value wrapping under
  // itself. Omitted entirely when the value is empty.
  const labeledLine = (label: string, value: string) => {
    if (!value) return
    doc.setFont(CONTRACT_FONT, 'bold')
    doc.setFontSize(CONTRACT_SIZE)
    const labelText = `${label} `
    const labelW = doc.getTextWidth(labelText)
    const valueLines: string[] = doc.splitTextToSize(value, CONTRACT_W - labelW)
    checkPage(valueLines.length * CONTRACT_LINE_H + 2)
    doc.setTextColor(15, 14, 12)
    doc.text(labelText, CONTRACT_L, y)
    doc.setFont(CONTRACT_FONT, 'normal')
    doc.setTextColor(40, 38, 34)
    valueLines.forEach((ln, i) => doc.text(ln, CONTRACT_L + labelW, y + i * CONTRACT_LINE_H))
    y += valueLines.length * CONTRACT_LINE_H + 2
  }

  labeledLine('Speaker:', 'Mori Taheripour')
  labeledLine('Client:', s(client.organization))
  labeledLine('Estimated attendees:', anyClient.audience_size ? String(anyClient.audience_size) : '')
  labeledLine('Attendee location:', s(anyClient.attendee_location) || s(client.event_city))
  labeledLine('Date:', client.event_date ? formatDate(client.event_date) : '')
  labeledLine('Time:', s(client.event_time))
  labeledLine('Location:', s(client.event_location) || (isVirtual ? 'Virtual' : ''))
  labeledLine('Tech platform:', s(anyClient.tech_platform))
  labeledLine('Primary contact:', contactValue)
  if (rosLines.length) {
    checkPage(CONTRACT_LINE_H * (rosLines.length + 1))
    doc.setFont(CONTRACT_FONT, 'bold')
    doc.setTextColor(15, 14, 12)
    doc.text('Run of show:', CONTRACT_L, y)
    y += CONTRACT_LINE_H
    doc.setFont(CONTRACT_FONT, 'normal')
    doc.setTextColor(40, 38, 34)
    for (const line of rosLines) {
      const wrapped: string[] = doc.splitTextToSize(line, CONTRACT_W - 14)
      checkPage(wrapped.length * CONTRACT_LINE_H)
      wrapped.forEach((ln, i) => doc.text(ln, CONTRACT_L + 14, y + i * CONTRACT_LINE_H))
      y += wrapped.length * CONTRACT_LINE_H
    }
    y += 2
  }
  y += 10

  // ── Project scope — omitted entirely when there are no items ─────────────────
  if (scopeItems.length) {
    checkPage(30)
    doc.setFont(CONTRACT_FONT, 'bold')
    doc.setFontSize(CONTRACT_SIZE)
    doc.setTextColor(15, 14, 12)
    doc.text('Project scope includes:', CONTRACT_L, y)
    y += CONTRACT_LINE_H + 2
    doc.setFont(CONTRACT_FONT, 'normal')
    doc.setTextColor(40, 38, 34)
    for (const item of scopeItems) {
      const lineCount = doc.splitTextToSize(s(item), CONTRACT_W - 20).length
      checkPage(lineCount * CONTRACT_LINE_H + 4)
      y = addBullet(doc, s(item), CONTRACT_L, y, CONTRACT_W)
      y += 4
    }
    y += 12
  }

  // ── Template body: editable content (see /contracts/templates) ───────────────
  // Money fields resolve to '' when unset (not "—"), and any block/item that
  // references an empty field is omitted — so a fee-less contract simply drops
  // its fee lines instead of printing "-- (USD)".
  const feeSet = !!client.fee
  const travelRaw = s(anyClient.travel_fee)
  const travelEmpty = !travelRaw || /^tbd$/i.test(travelRaw.trim())
  const travelFeeNum = parseFloat(travelRaw.replace(/[^0-9.]/g, ''))
  const hasNumericTravel = !isNaN(travelFeeNum) && /\d/.test(travelRaw)
  const totalProgramFee = (client.fee ?? 0) + (hasNumericTravel ? travelFeeNum : 0)
  // Travel fee is free text. If it's just a number (with optional $, commas,
  // decimals), format it as currency so it matches the other fee lines; leave
  // any prose ("billed at cost", "up to $3,000 + expenses") exactly as typed.
  const travelClean = travelRaw.replace(/[$,\s]/g, '')
  const travelIsPureNumber = !travelEmpty && travelClean !== '' && !isNaN(Number(travelClean))
  const depositAmt = client.deposit_amount ?? Math.round(totalProgramFee * 0.5)
  const balanceAmt = totalProgramFee - depositAmt

  const mergeData: Record<string, string> = {
    organization: s(client.organization),
    contact_name: [c?.first_name, c?.last_name].filter(Boolean).map((x: string) => s(x)).join(' '),
    contact_title: s(c?.title),
    contact_email: s(c?.email),
    contact_phone: s(c?.phone),
    event_name: s(client.event_name),
    event_date: client.event_date ? formatDate(client.event_date) : '',
    event_city: s(client.event_city),
    event_location: s(client.event_location),
    fee: feeSet ? formatCurrency(client.fee) : '',
    travel_fee: travelEmpty ? '' : (travelIsPureNumber ? formatCurrency(Number(travelClean)) : travelRaw),
    total_program_fee: feeSet ? formatCurrency(totalProgramFee) : '',
    deposit_due: feeSet ? formatCurrency(depositAmt) : '',
    balance_due: feeSet ? formatCurrency(balanceAmt) : '',
    business_name: s(business.name) || 'MT Global Strategies',
    business_address: s(business.address),
    date: dateStr,
  }
  const emptyFields = new Set(Object.entries(mergeData).filter(([, v]) => v === '').map(([k]) => k))
  const referencesEmpty = (text: string) => referencedFields(text).some(k => emptyFields.has(k))

  // One consistent rhythm: a small gap after every body block, a slightly
  // larger gap above a major (rule:true) section heading, and a tight gap
  // below any heading — so section breaks read as deliberate, not as stray
  // double paragraph breaks.
  const BLOCK_GAP = 8
  const SECTION_ABOVE = 8
  const HEADING_BELOW = 5

  // Book fee & logistics — heading + clause from the contract's book-order
  // fields; renders nothing when there's no order. The Client buys the books
  // directly from the vendor, so this never affects the total program fee.
  // Reached both from a `book_section` marker (new contracts) and from the
  // legacy hardcoded "Book fee & logistics" heading in older frozen snapshots.
  const renderBookSection = () => {
    const qty = Number(anyClient.book_quantity)
    if (!qty || qty <= 0) return
    const title = s(anyClient.book_title) || 'Bring Yourself'
    const vendor = s(anyClient.book_vendor)
    const qtyFmt = qty.toLocaleString('en-US')
    const clause = vendor
      ? `The Client will purchase ${qtyFmt} copies of ${title} directly from ${vendor}. Books will be shipped to the address provided by Client to ${vendor}.`
      : `The Client will purchase ${qtyFmt} copies of ${title}.`
    checkPage(CONTRACT_LINE_H + 8)
    doc.setFont(CONTRACT_FONT, 'bold')
    doc.setFontSize(CONTRACT_SIZE)
    doc.setTextColor(15, 14, 12)
    doc.text('Book fee & logistics:', CONTRACT_L, y)
    y += CONTRACT_LINE_H + HEADING_BELOW
    const lines = doc.splitTextToSize(s(clause), CONTRACT_W)
    checkPage(lines.length * CONTRACT_LINE_H + BLOCK_GAP)
    doc.setFont(CONTRACT_FONT, 'normal')
    doc.setTextColor(40, 38, 34)
    doc.text(lines, CONTRACT_L, y)
    y += lines.length * CONTRACT_LINE_H + BLOCK_GAP
  }
  const isLegacyBookHeading = (text: string) => /^book fee (&|and) logistics:?$/i.test(text.trim())
  const isLegacyBookParagraph = (text: string) => /^the client will purchase 50 copies of bring yourself/i.test(text.trim())

  for (const block of blocks) {
    if (block.type === 'heading') {
      // Older contracts hardcoded the book section as a "Book fee & logistics"
      // heading + "50 copies..." paragraph instead of a book_section marker.
      // Route the heading through the data-driven renderer (its paragraph is
      // skipped below) so the book toggle controls it in those contracts too.
      if (isLegacyBookHeading(block.text)) { renderBookSection(); continue }
      if (referencesEmpty(block.text)) continue
      if (block.rule) y += SECTION_ABOVE
      checkPage(CONTRACT_LINE_H + 8)
      doc.setFont(CONTRACT_FONT, 'bold')
      doc.setFontSize(CONTRACT_SIZE)
      doc.setTextColor(15, 14, 12)
      doc.text(substituteMergeFields(block.text, mergeData), CONTRACT_L, y)
      y += CONTRACT_LINE_H + HEADING_BELOW
    } else if (block.type === 'paragraph') {
      if (isLegacyBookParagraph(block.text)) continue // rendered by renderBookSection at its heading
      if (referencesEmpty(block.text)) continue
      const text = substituteMergeFields(block.text, mergeData)
      const lines = doc.splitTextToSize(text, CONTRACT_W)
      checkPage(lines.length * CONTRACT_LINE_H + BLOCK_GAP)
      doc.setFont(CONTRACT_FONT, 'normal')
      doc.setTextColor(40, 38, 34)
      doc.text(lines, CONTRACT_L, y)
      y += lines.length * CONTRACT_LINE_H + BLOCK_GAP
    } else if (block.type === 'key_value') {
      if (referencesEmpty(block.text)) continue
      checkPage(CONTRACT_LINE_H + BLOCK_GAP)
      doc.setFont(CONTRACT_FONT, 'bold')
      doc.setTextColor(...(block.emphasis === 'muted' ? [80, 78, 72] as const : [15, 14, 12] as const))
      doc.text(substituteMergeFields(block.text, mergeData), CONTRACT_L, y)
      y += CONTRACT_LINE_H + BLOCK_GAP
    } else if (block.type === 'bullet_list') {
      const items = block.items.filter(item => !referencesEmpty(item))
      if (!items.length) continue
      doc.setFont(CONTRACT_FONT, 'normal')
      doc.setTextColor(40, 38, 34)
      for (const item of items) {
        const text = substituteMergeFields(item, mergeData)
        const lineCount = doc.splitTextToSize(text, CONTRACT_W - 14).length
        checkPage(lineCount * CONTRACT_LINE_H + 6)
        y = addBullet(doc, text, CONTRACT_L, y, CONTRACT_W)
        y += 6
      }
      y += BLOCK_GAP
    } else if (block.type === 'line_list') {
      const items = block.items.filter(item => !referencesEmpty(item))
      if (!items.length) continue
      doc.setFont(CONTRACT_FONT, 'normal')
      doc.setTextColor(40, 38, 34)
      for (const item of items) {
        const text = substituteMergeFields(item, mergeData)
        const lines = doc.splitTextToSize(text, CONTRACT_W)
        checkPage(lines.length * CONTRACT_LINE_H + 2)
        doc.text(lines, CONTRACT_L, y)
        y += lines.length * CONTRACT_LINE_H + 2
      }
      y += BLOCK_GAP
    } else if (block.type === 'book_section') {
      renderBookSection()
    }
  }
  y += 8

  // ── Authorization ────────────────────────────────────────────────────────────
  checkPage(160)
  doc.setFont(CONTRACT_FONT, 'bold')
  doc.setFontSize(CONTRACT_SIZE)
  doc.setTextColor(15, 14, 12)
  doc.text('Authorization', CONTRACT_L, y)
  y += CONTRACT_LINE_H + 2
  doc.setFont(CONTRACT_FONT, 'normal')
  doc.setTextColor(40, 38, 34)
  doc.text('All parties agree with the terms set forth in this document.', CONTRACT_L, y)
  y += CONTRACT_LINE_H + 24

  // One signing block per party: a bold header naming the party (the client's
  // own organization is filled in, not left as a blank "Company" line), then a
  // signature line and a date line with plain labels beneath. No table, no caps.
  const sigLineW = 250, dateX = CONTRACT_L + 300, dateLineW = 120
  const signatureBlock = (partyHeader: string) => {
    checkPage(64)
    doc.setFont(CONTRACT_FONT, 'bold')
    doc.setFontSize(CONTRACT_SIZE)
    doc.setTextColor(15, 14, 12)
    doc.text(partyHeader, CONTRACT_L, y)
    y += CONTRACT_LINE_H + 16
    doc.setDrawColor(15, 14, 12)
    doc.setLineWidth(0.5)
    doc.line(CONTRACT_L, y, CONTRACT_L + sigLineW, y)
    doc.line(dateX, y, dateX + dateLineW, y)
    y += 13
    doc.setFont(CONTRACT_FONT, 'normal')
    doc.setFontSize(CONTRACT_SIZE)
    doc.setTextColor(80, 78, 72)
    doc.text('Name & title', CONTRACT_L, y)
    doc.text('Date', dateX, y)
    y += CONTRACT_LINE_H
  }

  const clientOrg = s(client.organization)
  signatureBlock(`Accepted on behalf of ${clientOrg || 'the Client'}:`)
  y += 24
  signatureBlock('Accepted on behalf of MT Global Strategies:')

  // Plain page numbers.
  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setFont(CONTRACT_FONT, 'normal')
    doc.setFontSize(9)
    doc.setTextColor(150, 148, 144)
    doc.text(`Page ${p} of ${pageCount}`, CONTRACT_R, 772, { align: 'right' })
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