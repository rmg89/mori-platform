import { NextRequest, NextResponse } from 'next/server'
import { fetchUnassignedContacts, insertContact } from '@/lib/db'

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('unassigned') !== 'true') {
    return NextResponse.json({ error: 'unsupported query' }, { status: 400 })
  }
  try {
    const contacts = await fetchUnassignedContacts()
    return NextResponse.json(contacts)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { engagement_id, ...contact } = await req.json()
  const id = await insertContact(engagement_id ?? null, contact)
  if (!id) return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 })
  return NextResponse.json({ id })
}
