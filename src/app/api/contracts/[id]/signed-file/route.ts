import { NextRequest, NextResponse } from 'next/server'
import { fetchContractById, attachSignedContractFile } from '@/lib/contracts'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { fileUrl, fileName } = await req.json()
    const contract = await fetchContractById(id)
    if (!contract) return NextResponse.json({ error: 'contract not found' }, { status: 404 })
    const updated = await attachSignedContractFile(contract, fileUrl, fileName)
    return NextResponse.json(updated)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
