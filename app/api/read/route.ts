import { NextRequest, NextResponse } from 'next/server'
import { markAsRead } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { channel_id, reader } = await request.json()
    
    if (!channel_id || !reader) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    
    await markAsRead(channel_id, reader)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
