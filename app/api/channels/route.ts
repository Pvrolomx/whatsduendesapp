import { NextResponse } from 'next/server'
import { sql, initDB } from '@/lib/db'

export async function GET() {
  try {
    await initDB()
    const result = await sql`SELECT * FROM channels ORDER BY id ASC`
    return NextResponse.json({ channels: result.rows })
  } catch (error: any) {
    console.error('Channels GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await initDB()
    const { name } = await request.json()
    if (!name) {
      return NextResponse.json({ error: 'Name required' }, { status: 400 })
    }
    const result = await sql`
      INSERT INTO channels (name) VALUES (${name})
      RETURNING *
    `
    return NextResponse.json({ channel: result.rows[0] })
  } catch (error: any) {
    console.error('Channels POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
