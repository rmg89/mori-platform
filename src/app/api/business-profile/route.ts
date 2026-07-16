import { NextRequest, NextResponse } from 'next/server'
import { fetchBusinessProfile, updateBusinessProfile } from '@/lib/business'

export async function GET() {
  const profile = await fetchBusinessProfile()
  return NextResponse.json(profile)
}

export async function PUT(req: NextRequest) {
  try {
    const patch = await req.json()
    await updateBusinessProfile(patch)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
