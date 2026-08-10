import { NextResponse } from 'next/server'
import { fetchReviewItems } from '@/lib/db'
import { withErrorLogging } from '@/lib/error-log'

export const GET = withErrorLogging('GET /api/review-items', async () => {
  const items = await fetchReviewItems()
  return NextResponse.json(items)
})
