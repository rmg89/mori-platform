import { NextRequest, NextResponse } from 'next/server'
import { insertBriefingNoteRow } from '@/lib/db'
import { serverError } from '@/lib/error-log'

export async function POST(req: NextRequest) {
  try {
    const note = await req.json()
    await insertBriefingNoteRow(note)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return serverError(err, req)
  }
}
