import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { rows } = await sql`SELECT * FROM channels ORDER BY id`
    return NextResponse.json(rows)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json()
    
    if (!name) {
      return NextResponse.json({ error: 'Name required' }, { status: 400 })
    }
    
    // Check if exists
    const existing = await sql`SELECT * FROM channels WHERE name = ${name}`
    if (existing.rows.length > 0) {
      return NextResponse.json(existing.rows[0])
    }
    
    const { rows } = await sql`
      INSERT INTO channels (name) 
      VALUES (${name})
      RETURNING *
    `
    
    return NextResponse.json(rows[0])
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
