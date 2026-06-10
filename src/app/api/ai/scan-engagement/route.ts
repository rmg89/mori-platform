import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { scanEngagement, ScanType } from '@/lib/ai-scan'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { engagement_id, scan_type } = await req.json()

  try {
    const result = await scanEngagement(supabase, engagement_id, scan_type as ScanType)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('scan-engagement error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
