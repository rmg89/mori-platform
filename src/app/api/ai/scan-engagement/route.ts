import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { scanEngagement, ScanType } from '@/lib/ai-scan'
import { serverError } from '@/lib/error-log'

export async function POST(req: NextRequest) {
  const { engagement_id, scan_type } = await req.json()

  try {
    const result = await scanEngagement(supabaseAdmin(), engagement_id, scan_type as ScanType)
    return NextResponse.json(result)
  } catch (err) {
    return serverError(err, req)
  }
}
