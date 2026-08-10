import { NextRequest, NextResponse } from 'next/server'
import { updateEngagementRow, deleteEngagementRow } from '@/lib/db'
import { serverError } from '@/lib/error-log'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const patch = await req.json()
    await updateEngagementRow(id, patch)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return serverError(err, req)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await deleteEngagementRow(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return serverError(err, req)
  }
}
