import { NextRequest, NextResponse } from 'next/server'
import { ensureDraftContract } from '@/lib/contracts'
import { serverError } from '@/lib/error-log'

export async function POST(req: NextRequest) {
  try {
    const input = await req.json()
    const contract = await ensureDraftContract(input)
    return NextResponse.json(contract)
  } catch (err) {
    return serverError(err, req)
  }
}
