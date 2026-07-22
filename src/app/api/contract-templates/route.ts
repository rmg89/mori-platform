import { NextRequest, NextResponse } from 'next/server'
import { fetchContractTemplates, createContractTemplate } from '@/lib/contract-templates'

export async function GET() {
  try {
    const templates = await fetchContractTemplates()
    return NextResponse.json(templates)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const input = await req.json()
    const template = await createContractTemplate(input)
    return NextResponse.json(template)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
