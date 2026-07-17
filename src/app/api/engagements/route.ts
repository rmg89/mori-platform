import { NextRequest, NextResponse } from 'next/server'
import { fetchAllEngagements, insertEngagementRow } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const engagements = await fetchAllEngagements(req.nextUrl.origin)
    return NextResponse.json(engagements)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const input = await req.json()
    const engagement = await insertEngagementRow(input)
    return NextResponse.json(engagement)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
