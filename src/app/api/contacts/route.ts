import { NextRequest, NextResponse } from 'next/server'
import { fetchUnassignedContacts, insertContact } from '@/lib/db'
import { serverError } from '@/lib/error-log'

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('unassigned') !== 'true') {
    return NextResponse.json({ error: 'unsupported query' }, { status: 400 })
  }
  try {
    const contacts = await fetchUnassignedContacts()
    return NextResponse.json(contacts)
  } catch (err) {
    return serverError(err, req)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { engagement_id, ...contact } = await req.json()
    const id = await insertContact(engagement_id ?? null, contact)
    if (!id) return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 })
    return NextResponse.json({ id })
  } catch (err) {
    return serverError(err, req)
  }
}
