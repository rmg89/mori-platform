import { NextRequest, NextResponse } from 'next/server'
import { fetchReviewItemExtracted } from '@/lib/db'
import { withErrorLogging } from '@/lib/error-log'

export const GET = withErrorLogging(
  'GET /api/review-items/:id/extracted',
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const extracted = await fetchReviewItemExtracted(id)
    return NextResponse.json(extracted)
  },
)
