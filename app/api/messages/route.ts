import { NextRequest, NextResponse } from 'next/server'
import { getMessages, createMessage } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const channelId = parseInt(searchParams.get('channel') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    
    const messages = await getMessages(channelId, limit)
    return NextResponse.json(messages)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { channel_id, sender, content, attachments } = body
    
    if (!channel_id || !sender || !content) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    
    const message = await createMessage(channel_id, sender, content, attachments || [])
    return NextResponse.json(message)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
