import { NextRequest, NextResponse } from 'next/server'
import { fetchCompanies, insertCompanyRow } from '@/lib/db'

export async function GET() {
  const companies = await fetchCompanies()
  return NextResponse.json(companies)
}

export async function POST(req: NextRequest) {
  try {
    const input = await req.json()
    const company = await insertCompanyRow(input)
    return NextResponse.json(company)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
