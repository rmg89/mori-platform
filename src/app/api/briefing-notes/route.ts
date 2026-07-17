import { NextRequest, NextResponse } from 'next/server'
import { insertBriefingNoteRow } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const note = await req.json()
    await insertBriefingNoteRow(note)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
