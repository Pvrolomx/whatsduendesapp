import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Check if Vercel Blob is configured
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import('@vercel/blob')
      const blob = await put(file.name, file, { access: 'public' })
      return NextResponse.json({ 
        url: blob.url,
        filename: file.name,
        size: file.size,
        type: file.type
      })
    }
    
    // Fallback: return error with instructions
    return NextResponse.json({ 
      error: 'BLOB_READ_WRITE_TOKEN not configured',
      message: 'Configure Vercel Blob in dashboard to enable file uploads'
    }, { status: 503 })
    
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
