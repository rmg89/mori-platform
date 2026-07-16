import { NextRequest, NextResponse } from 'next/server'
import { upsertCall } from '@/lib/db'

export async function PUT(req: NextRequest) {
  try {
    const call = await req.json()
    await upsertCall(call)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
