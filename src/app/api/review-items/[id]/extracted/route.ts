import { NextRequest, NextResponse } from 'next/server'
import { fetchReviewItemExtracted } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const extracted = await fetchReviewItemExtracted(id)
  return NextResponse.json(extracted)
}
