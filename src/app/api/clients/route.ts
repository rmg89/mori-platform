import { NextRequest, NextResponse } from 'next/server'
import { MOCK_ENGAGEMENTS } from "@/lib/mock-data"

// TODO: Replace mock data with Supabase queries
// import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  // TODO: const { data, error } = await supabaseAdmin().from('clients').select('*').order('updated_at', { ascending: false })
  return NextResponse.json({ clients: MOCK_ENGAGEMENTS })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  // TODO: const { data, error } = await supabaseAdmin().from('clients').insert(body).select().single()
  return NextResponse.json({ client: { id: 'new-id', ...body }, message: 'Connect Supabase to persist.' }, { status: 201 })
}
