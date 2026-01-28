import { sql } from '@vercel/postgres'

export async function initDatabase() {
  try {
    // Create tables if not exist
    await sql`
      CREATE TABLE IF NOT EXISTS channels (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `
    
    await sql`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        channel_id INTEGER REFERENCES channels(id) ON DELETE CASCADE,
        sender VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        attachments JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `
    
    await sql`
      CREATE TABLE IF NOT EXISTS files (
        id SERIAL PRIMARY KEY,
        message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
        blob_url TEXT NOT NULL,
        filename VARCHAR(255),
        mimetype VARCHAR(100),
        size INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `
    
    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC)`
    
    // Insert default channels if empty
    const { rows } = await sql`SELECT COUNT(*) as count FROM channels`
    if (rows[0].count === '0') {
      await sql`INSERT INTO channels (name, description) VALUES ('General', 'Canal general')`
      await sql`INSERT INTO channels (name, description) VALUES ('CD6', 'Canal CD6')`
      await sql`INSERT INTO channels (name, description) VALUES ('CD7', 'Canal CD7')`
    }
    
    return { success: true }
  } catch (error) {
    console.error('DB init error:', error)
    return { success: false, error }
  }
}

export async function getChannels() {
  const { rows } = await sql`SELECT * FROM channels ORDER BY id`
  return rows
}

export async function getMessages(channelId: number, limit = 50) {
  const { rows } = await sql`
    SELECT * FROM messages 
    WHERE channel_id = ${channelId} 
    ORDER BY created_at DESC 
    LIMIT ${limit}
  `
  return rows.reverse()
}

export async function createMessage(channelId: number, sender: string, content: string, attachments: any[] = []) {
  const { rows } = await sql`
    INSERT INTO messages (channel_id, sender, content, attachments)
    VALUES (${channelId}, ${sender}, ${content}, ${JSON.stringify(attachments)})
    RETURNING *
  `
  return rows[0]
}
