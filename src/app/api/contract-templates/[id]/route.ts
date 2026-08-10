import { NextRequest, NextResponse } from 'next/server'
import { fetchContractTemplateById, updateContractTemplate, deleteContractTemplate } from '@/lib/contract-templates'
import { serverError } from '@/lib/error-log'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const template = await fetchContractTemplateById(id)
    if (!template) return NextResponse.json({ error: 'template not found' }, { status: 404 })
    return NextResponse.json(template)
  } catch (err) {
    return serverError(err, req)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const patch = await req.json()
    const updated = await updateContractTemplate(id, patch)
    return NextResponse.json(updated)
  } catch (err) {
    return serverError(err, req)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await deleteContractTemplate(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return serverError(err, req)
  }
}
