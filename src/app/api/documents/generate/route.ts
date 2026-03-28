import { NextRequest, NextResponse } from 'next/server'
import { MOCK_ENGAGEMENTS } from '@/lib/mock-data'

// TODO: Wire up jsPDF generation server-side and store in Supabase Storage
// For client-side generation (demo), documents.ts handles this directly in the browser
// This route is the production path: generate → upload to Supabase → return signed URL

export async function POST(req: NextRequest) {
  const { type, clientId } = await req.json()

  const client = MOCK_ENGAGEMENTS.find(c => c.id === clientId)
  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  // TODO:
  // 1. Import generateContract/generateAdvanceSheet/generateInvoice from documents.ts
  // 2. Generate PDF blob
  // 3. Upload to Supabase Storage: supabaseAdmin().storage.from('documents').upload(...)
  // 4. Return signed URL

  const invoiceNumber = `INV-${new Date().getFullYear()}-${String(MOCK_ENGAGEMENTS.indexOf(client) + 1).padStart(3, '0')}`

  return NextResponse.json({
    success: true,
    type,
    clientId,
    invoiceNumber,
    message: 'Document generation API ready — connect jsPDF + Supabase Storage to activate.',
  })
}
