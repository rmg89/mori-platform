import { NextRequest, NextResponse } from 'next/server'
import { fetchInvoiceById, setInvoiceStatus } from '@/lib/invoices'
import { serverError } from '@/lib/error-log'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { status } = await req.json()
    const invoice = await fetchInvoiceById(id)
    if (!invoice) return NextResponse.json({ error: 'invoice not found' }, { status: 404 })
    await setInvoiceStatus(invoice, status)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return serverError(err, req)
  }
}
