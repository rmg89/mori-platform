import { NextRequest, NextResponse } from 'next/server'
import { findLatestInvoice } from '@/lib/invoices'
import type { InvoiceKind } from '@/types'
import { serverError } from '@/lib/error-log'

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const engagementId = sp.get('engagement_id')
    const type = sp.get('type') as InvoiceKind | null
    if (!engagementId || !type) {
      return NextResponse.json({ error: 'engagement_id and type required' }, { status: 400 })
    }
    const invoice = await findLatestInvoice(engagementId, type)
    return NextResponse.json(invoice)
  } catch (err) {
    return serverError(err, req)
  }
}
