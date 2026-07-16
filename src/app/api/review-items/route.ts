import { NextResponse } from 'next/server'
import { fetchReviewItems } from '@/lib/db'

export async function GET() {
  const items = await fetchReviewItems()
  return NextResponse.json(items)
}
