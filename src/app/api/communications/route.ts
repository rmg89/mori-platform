import { NextRequest, NextResponse } from 'next/server'
import { insertComm } from '@/lib/db'
import { serverError } from '@/lib/error-log'

export async function POST(req: NextRequest) {
  try {
    const comm = await req.json()
    await insertComm(comm)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return serverError(err, req)
  }
}
