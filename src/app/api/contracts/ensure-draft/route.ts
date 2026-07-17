import { NextRequest, NextResponse } from 'next/server'
import { ensureDraftContract } from '@/lib/contracts'

export async function POST(req: NextRequest) {
  try {
    const input = await req.json()
    const contract = await ensureDraftContract(input)
    return NextResponse.json(contract)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
