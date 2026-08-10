import { NextRequest, NextResponse } from 'next/server'
import { ensureDraftInvoice } from '@/lib/invoices'
import { serverError } from '@/lib/error-log'

export async function POST(req: NextRequest) {
  try {
    const input = await req.json()
    const invoice = await ensureDraftInvoice(input)
    return NextResponse.json(invoice)
  } catch (err) {
    return serverError(err, req)
  }
}
