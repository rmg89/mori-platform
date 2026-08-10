import { NextRequest, NextResponse } from 'next/server'
import { fetchContractById, setContractStatus } from '@/lib/contracts'
import type { ContractStatus } from '@/types'
import { serverError } from '@/lib/error-log'

const VALID_STATUSES: ContractStatus[] = ['draft', 'finalized', 'sent', 'signed']

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { status } = await req.json()
    // Reject an unknown status up front — setContractStatus derives its stage
    // timestamps from the status's position in the pipeline, so an invalid value
    // would persist as-is and silently null every finalized/sent/signed stamp.
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `invalid status: ${status}` }, { status: 400 })
    }
    const contract = await fetchContractById(id)
    if (!contract) return NextResponse.json({ error: 'contract not found' }, { status: 404 })
    await setContractStatus(contract, status)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return serverError(err, req)
  }
}
