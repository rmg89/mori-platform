import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { scanEngagement, ScanType } from '@/lib/ai-scan'

export async function POST(req: NextRequest) {
  const { engagement_id, scan_type } = await req.json()

  try {
    const result = await scanEngagement(supabaseAdmin(), engagement_id, scan_type as ScanType)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('scan-engagement error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
