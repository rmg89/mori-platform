import { NextRequest, NextResponse } from 'next/server'
import { fetchInvoices, createInvoice } from '@/lib/invoices'
import type { InvoiceKind, InvoiceStatus } from '@/types'
import { serverError } from '@/lib/error-log'

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const result = await fetchInvoices({
      status: (sp.get('status') as InvoiceStatus) ?? undefined,
      type: (sp.get('type') as InvoiceKind) ?? undefined,
      offset: Number(sp.get('offset') ?? 0),
      limit: Number(sp.get('limit') ?? 50),
    })
    return NextResponse.json(result)
  } catch (err) {
    return serverError(err, req)
  }
}

export async function POST(req: NextRequest) {
  try {
    const input = await req.json()
    const invoice = await createInvoice(input)
    return NextResponse.json(invoice)
  } catch (err) {
    return serverError(err, req)
  }
}
