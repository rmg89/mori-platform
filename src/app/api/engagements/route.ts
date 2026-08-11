import { NextRequest, NextResponse } from 'next/server'
import { fetchAllEngagements, insertEngagementRow } from '@/lib/db'
import { serverError } from '@/lib/error-log'

export async function GET(req: NextRequest) {
  try {
    const engagements = await fetchAllEngagements(req.nextUrl.origin)
    return NextResponse.json(engagements)
  } catch (err) {
    return serverError(err, req)
  }
}

export async function POST(req: NextRequest) {
  try {
    const input = await req.json()
    const engagement = await insertEngagementRow(input)
    return NextResponse.json(engagement)
  } catch (err) {
    return serverError(err, req)
  }
}
