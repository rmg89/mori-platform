import { NextRequest, NextResponse } from 'next/server'
import { fetchContractTemplates, createContractTemplate } from '@/lib/contract-templates'
import { serverError } from '@/lib/error-log'

export async function GET(req: NextRequest) {
  try {
    const templates = await fetchContractTemplates()
    return NextResponse.json(templates)
  } catch (err) {
    return serverError(err, req)
  }
}

export async function POST(req: NextRequest) {
  try {
    const input = await req.json()
    const template = await createContractTemplate(input)
    return NextResponse.json(template)
  } catch (err) {
    return serverError(err, req)
  }
}
