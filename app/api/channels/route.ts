import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { rows } = await sql`SELECT * FROM channels ORDER BY id DESC`
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

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const idParam = searchParams.get('id')
    const body = await request.json()
    
    if (!idParam) {
      return NextResponse.json({ error: 'Channel ID required in query param' }, { status: 400 })
    }
    
    const channelId = parseInt(idParam)
    const { name, description, dynamic_prompt } = body
    
    // Build dynamic update
    const updates: string[] = []
    const values: any[] = []
    
    if (name !== undefined) {
      updates.push('name')
      values.push(name)
    }
    if (description !== undefined) {
      updates.push('description')
      values.push(description)
    }
    if (dynamic_prompt !== undefined) {
      updates.push('dynamic_prompt')
      values.push(dynamic_prompt)
    }
    
    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }
    
    // Execute update based on what fields are provided
    let result
    if (dynamic_prompt !== undefined && updates.length === 1) {
      result = await sql`
        UPDATE channels 
        SET dynamic_prompt = ${dynamic_prompt}
        WHERE id = ${channelId}
        RETURNING *
      `
    } else if (name !== undefined && dynamic_prompt !== undefined) {
      result = await sql`
        UPDATE channels 
        SET name = ${name}, dynamic_prompt = ${dynamic_prompt}
        WHERE id = ${channelId}
        RETURNING *
      `
    } else if (name !== undefined) {
      result = await sql`
        UPDATE channels 
        SET name = ${name}
        WHERE id = ${channelId}
        RETURNING *
      `
    } else {
      result = await sql`
        UPDATE channels 
        SET dynamic_prompt = ${dynamic_prompt || null}
        WHERE id = ${channelId}
        RETURNING *
      `
    }
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }
    
    return NextResponse.json(result.rows[0])
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const idParam = searchParams.get('id')
    
    if (!idParam) {
      return NextResponse.json({ error: 'Channel ID required in query param (?id=X)' }, { status: 400 })
    }
    
    const channelId = parseInt(idParam)
    
    // Prevent deleting General channel (id=1)
    if (channelId === 1) {
      return NextResponse.json({ error: 'Cannot delete General channel' }, { status: 403 })
    }
    
    // First delete all messages in this channel
    await sql`DELETE FROM messages WHERE channel_id = ${channelId}`
    
    // Then delete the channel
    const { rows } = await sql`
      DELETE FROM channels 
      WHERE id = ${channelId}
      RETURNING *
    `
    
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }
    
    return NextResponse.json({ deleted: rows[0], messages_deleted: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
