import { sql } from '@vercel/postgres'

export { sql }

// Initialize database tables
export async function initDB() {
  try {
    // Create channels table
    await sql`
      CREATE TABLE IF NOT EXISTS channels (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `
    
    // Create messages table
    await sql`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        channel_id INTEGER REFERENCES channels(id),
        sender VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        attachments JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `
    
    // Insert default channels if not exist
    const defaultChannels = ['General', 'CD6', 'CD7']
    for (const name of defaultChannels) {
      await sql`
        INSERT INTO channels (name) VALUES (${name})
        ON CONFLICT (name) DO NOTHING
      `
    }
    
    return { success: true }
  } catch (error) {
    console.error('DB Init Error:', error)
    return { success: false, error }
  }
}
