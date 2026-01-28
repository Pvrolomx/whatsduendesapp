import { NextRequest } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const channelId = parseInt(searchParams.get('channel') || '1')
  
  const encoder = new TextEncoder()
  let lastId = 0
  
  const stream = new ReadableStream({
    async start(controller) {
      const { rows } = await sql`
        SELECT COALESCE(MAX(id), 0) as max_id FROM messages WHERE channel_id = ${channelId}
      `
      lastId = rows[0].max_id
      
      controller.enqueue(encoder.encode(`data: {"type":"connected","channel":${channelId}}\n\n`))
      
      const interval = setInterval(async () => {
        try {
          const { rows: newMessages } = await sql`
            SELECT * FROM messages 
            WHERE channel_id = ${channelId} AND id > ${lastId}
            ORDER BY id ASC
          `
          
          for (const msg of newMessages) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({type:"message", data: msg})}\n\n`))
            lastId = msg.id
          }
        } catch (error) {
          console.error('SSE error:', error)
        }
      }, 2000)
      
      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
      })
    }
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
