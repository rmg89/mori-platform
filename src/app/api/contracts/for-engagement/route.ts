import { NextRequest, NextResponse } from 'next/server'
import { fetchContractsForEngagement } from '@/lib/contracts'

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const engagementId = sp.get('engagement_id')
    if (!engagementId) {
      return NextResponse.json({ error: 'engagement_id required' }, { status: 400 })
    }
    const contracts = await fetchContractsForEngagement(engagementId)
    return NextResponse.json(contracts)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
