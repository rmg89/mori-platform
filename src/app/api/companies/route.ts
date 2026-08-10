import { NextRequest, NextResponse } from 'next/server'
import { fetchCompanies, insertCompanyRow } from '@/lib/db'
import { serverError } from '@/lib/error-log'

export async function GET() {
  const companies = await fetchCompanies()
  return NextResponse.json(companies)
}

export async function POST(req: NextRequest) {
  try {
    const input = await req.json()
    const company = await insertCompanyRow(input)
    return NextResponse.json(company)
  } catch (err) {
    return serverError(err, req)
  }
}
