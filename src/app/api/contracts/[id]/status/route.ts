import { NextRequest, NextResponse } from 'next/server'
import { fetchContractById, setContractStatus } from '@/lib/contracts'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { status } = await req.json()
    const contract = await fetchContractById(id)
    if (!contract) return NextResponse.json({ error: 'contract not found' }, { status: 404 })
    await setContractStatus(contract, status)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
