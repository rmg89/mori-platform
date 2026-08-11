import { NextRequest, NextResponse } from 'next/server'
import { updateCommRow, deleteCommRow } from '@/lib/db'
import { serverError } from '@/lib/error-log'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const patch = await req.json()
    await updateCommRow(id, patch)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return serverError(err, req)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await deleteCommRow(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return serverError(err, req)
  }
}
