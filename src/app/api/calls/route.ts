import { NextRequest, NextResponse } from 'next/server'
import { upsertCall } from '@/lib/db'
import { serverError } from '@/lib/error-log'

export async function PUT(req: NextRequest) {
  try {
    const call = await req.json()
    await upsertCall(call)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return serverError(err, req)
  }
}
