import { NextRequest, NextResponse } from 'next/server'
import { deleteContract } from '@/lib/contracts'
import { serverError } from '@/lib/error-log'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await deleteContract(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return serverError(err, req)
  }
}
