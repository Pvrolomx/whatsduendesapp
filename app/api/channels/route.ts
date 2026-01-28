import { NextResponse } from 'next/server'
import { getChannels } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const channels = await getChannels()
    return NextResponse.json(channels)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
