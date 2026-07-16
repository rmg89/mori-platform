import { NextRequest, NextResponse } from 'next/server'
import { ensureDraftInvoice } from '@/lib/invoices'

export async function POST(req: NextRequest) {
  try {
    const input = await req.json()
    const invoice = await ensureDraftInvoice(input)
    return NextResponse.json(invoice)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
