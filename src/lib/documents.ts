// Document generation using jsPDF
// Templates are data-merge only — no AI, deterministic output
// TODO: Replace with more robust templating (e.g., docx → PDF) once templates are finalized

import { Client } from '@/types'
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
  addField(doc, 'Primary Contact', `${client.first_name} ${client.last_name}`, R, y)
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
  doc.text(`${client.first_name} ${client.last_name}, ${client.organization}`, 330, y)
  y += 14
  doc.text('Date: ___________________', 50, y)
  doc.text('Date: ___________________', 330, y)

  addFooter(doc, 1)
  return doc.output('blob')
}

// ─── Advance Sheet ────────────────────────────────────────────────────────────

export function generateAdvanceSheet(client: Client): Blob {
  const doc = createDoc()
  addHeader(doc, 'Advance Sheet / Event Briefing')

  let y = 110
  const L = 50, R = 330

  doc.setFontSize(10)
  doc.setTextColor(60, 58, 54)
  const note = `This advance sheet is prepared for Mori Taheripour and event staff for the engagement listed below. Please review all details and confirm any changes at least 72 hours prior to the event.`
  const noteLines = doc.splitTextToSize(note, 512)
  doc.text(noteLines, 50, y)
  y += noteLines.length * 14 + 20

  const section = (title: string) => {
    doc.setDrawColor(201, 168, 76)
    doc.setLineWidth(0.5)
    doc.line(50, y, 562, y)
    y += 16
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 14, 12)
    doc.text(title, 50, y)
    y += 18
  }

  section('EVENT OVERVIEW')
  addField(doc, 'Event Name', client.event_name || '—', L, y)
  addField(doc, 'Date', formatDate(client.event_date), R, y)
  y += 40
  addField(doc, 'Organization', client.organization, L, y)
  addField(doc, 'Format', client.event_format?.replace('_', '-') || '—', R, y)
  y += 40
  addField(doc, 'Venue', client.event_location || '—', L, y)
  addField(doc, 'City', client.event_city || '—', R, y)
  y += 40
  addField(doc, 'Audience Size', client.audience_size?.toString() || '—', L, y)
  addField(doc, 'Session Length', client.session_length ? `${client.session_length} minutes` : '—', R, y)
  y += 50

  section('PRESENTATION')
  addField(doc, 'Topic / Title', client.topic || '—', L, y)
  y += 40
  addField(doc, 'Speaker Notes / Special Focus', client.notes || 'None specified', L, y)
  y += 50

  section('CONTACT ON SITE')
  addField(doc, 'Primary Contact', `${client.first_name} ${client.last_name}`, L, y)
  addField(doc, 'Email', client.email, R, y)
  y += 40
  addField(doc, 'Phone', client.phone || '—', L, y)
  addField(doc, 'Title', client.title || '—', R, y)
  y += 50

  section('TECHNICAL & LOGISTICS')
  addField(doc, 'AV Requirements', client.av_needs || 'Standard setup', L, y)
  y += 40
  addField(doc, 'Special Requirements', client.special_requirements || 'None', L, y)
  y += 40
  addField(doc, 'Travel Covered', client.travel_covered ? 'Yes — Client arranges' : 'No — Speaker arranges', L, y)
  addField(doc, 'Hotel Covered', client.hotel_covered ? 'Yes — Client arranges' : 'No — Speaker arranges', R, y)
  y += 50

  section('CHECKLIST')
  const checks = [
    '☐  Confirm final headcount with organizer',
    '☐  Send speaker bio + headshot to organizer',
    '☐  Confirm AV setup and test clicker/slides',
    '☐  Confirm arrival time and green room location',
    '☐  Confirm recording/photography permissions',
    '☐  Confirm intro speaker name and pronunciation',
  ]
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(30, 29, 25)
  for (const c of checks) { doc.text(c, 60, y); y += 18 }

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
  doc.text(`${client.first_name} ${client.last_name}`, 50, y); y += 14
  if (client.title) { doc.text(client.title, 50, y); y += 14 }
  doc.text(client.organization, 50, y); y += 14
  doc.text(client.email, 50, y); y += 30

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
