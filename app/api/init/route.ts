import { NextResponse } from 'next/server'
import { initDatabase } from '@/lib/db'

export async function GET() {
  const result = await initDatabase()
  return NextResponse.json(result)
}
