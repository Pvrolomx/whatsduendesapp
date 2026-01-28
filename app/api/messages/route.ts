import { NextResponse } from 'next/server'
import { sql, initDB } from '@/lib/db'

export async function GET(request: Request) {
  try {
    await initDB()
    const { searchParams } = new URL(request.url)
    const channel_id = searchParams.get('channel_id')
    const limit = parseInt(searchParams.get('limit') || '50')
    
    if (!channel_id) {
      return NextResponse.json({ error: 'channel_id required' }, { status: 400 })
    }
    
    const result = await sql`
      SELECT * FROM messages 
      WHERE channel_id = ${parseInt(channel_id)}
      ORDER BY created_at ASC
      LIMIT ${limit}
    `
    return NextResponse.json({ messages: result.rows })
  } catch (error: any) {
    console.error('Messages GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await initDB()
    const { channel_id, sender, content, attachments } = await request.json()
    
    if (!channel_id || !sender || !content) {
      return NextResponse.json({ error: 'channel_id, sender, content required' }, { status: 400 })
    }
    
    const result = await sql`
      INSERT INTO messages (channel_id, sender, content, attachments)
      VALUES (${channel_id}, ${sender}, ${content}, ${JSON.stringify(attachments)})
      RETURNING *
    `
    return NextResponse.json({ message: result.rows[0] })
  } catch (error: any) {
    console.error('Messages POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
