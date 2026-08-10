import { NextRequest, NextResponse } from 'next/server'
import { fetchInvoiceById, updateInvoiceSnapshot } from '@/lib/invoices'
import { serverError } from '@/lib/error-log'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const patch = await req.json()
    const invoice = await fetchInvoiceById(id)
    if (!invoice) return NextResponse.json({ error: 'invoice not found' }, { status: 404 })
    const updated = await updateInvoiceSnapshot(invoice, patch)
    return NextResponse.json(updated)
  } catch (err) {
    return serverError(err, req)
  }
}
