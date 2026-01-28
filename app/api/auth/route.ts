import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'duendes2026'
const AUTH_COOKIE = 'whatsduendes_auth'

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()
    
    if (password === AUTH_PASSWORD) {
      // Create auth token (simple hash)
      const token = Buffer.from(`${AUTH_PASSWORD}:${Date.now()}`).toString('base64')
      
      const response = NextResponse.json({ success: true })
      response.cookies.set(AUTH_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30 // 30 días
      })
      
      return response
    }
    
    return NextResponse.json({ success: false, error: 'Invalid password' }, { status: 401 })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function GET() {
  const cookieStore = cookies()
  const authCookie = cookieStore.get(AUTH_COOKIE)
  
  if (authCookie?.value) {
    return NextResponse.json({ authenticated: true })
  }
  
  return NextResponse.json({ authenticated: false })
}
