import { NextRequest, NextResponse } from 'next/server'
import { findLatestContract } from '@/lib/contracts'
import { serverError } from '@/lib/error-log'

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const engagementId = sp.get('engagement_id')
    if (!engagementId) {
      return NextResponse.json({ error: 'engagement_id required' }, { status: 400 })
    }
    const contract = await findLatestContract(engagementId)
    return NextResponse.json(contract)
  } catch (err) {
    return serverError(err, req)
  }
}
