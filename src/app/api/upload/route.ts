import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withErrorLogging, logServerError } from '@/lib/error-log'

export const POST = withErrorLogging('POST /api/upload', async (req: NextRequest) => {
  const supabase = supabaseAdmin()
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const engagementId = formData.get('engagement_id') as string | null
  const folder = formData.get('folder') as string | null

  if (!file || !engagementId) {
    return NextResponse.json({ error: 'file and engagement_id required' }, { status: 400 })
  }

  const path = folder
    ? `${engagementId}/${folder}/${Date.now()}-${file.name}`
    : `${engagementId}/${Date.now()}-${file.name}`
  const bytes = await file.arrayBuffer()

  const { data, error } = await supabase.storage
    .from('materials')
    .upload(path, bytes, { contentType: file.type, upsert: false })

  if (error) {
    // Storage returns an error object rather than throwing, so the wrapper
    // never sees it — record it here or a failed upload logs nowhere.
    await logServerError({
      message: `Upload failed: ${error.message}`,
      route: '/api/upload',
      method: 'POST',
      action: 'POST /api/upload',
      context: { path, fileName: file.name, contentType: file.type, size: file.size },
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from('materials').getPublicUrl(data.path)

  return NextResponse.json({ url: publicUrl, name: file.name })
})
