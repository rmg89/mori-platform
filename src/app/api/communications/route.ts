import { NextRequest, NextResponse } from 'next/server'
import { insertComm } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const comm = await req.json()
    await insertComm(comm)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
