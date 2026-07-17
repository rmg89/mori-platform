import { NextRequest, NextResponse } from 'next/server'
import { fetchContracts, createContract } from '@/lib/contracts'
import type { ContractStatus } from '@/types'

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const result = await fetchContracts({
      status: (sp.get('status') as ContractStatus) ?? undefined,
      search: sp.get('search') ?? undefined,
      offset: Number(sp.get('offset') ?? 0),
      limit: Number(sp.get('limit') ?? 50),
    })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const input = await req.json()
    const contract = await createContract(input)
    return NextResponse.json(contract)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
