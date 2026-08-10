import { NextRequest, NextResponse } from 'next/server'
import { upsertContact, deleteContactRow } from '@/lib/db'
import { serverError } from '@/lib/error-log'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await req.json()
    await upsertContact({ ...body, id })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return serverError(err, req)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await deleteContactRow(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return serverError(err, req)
  }
}
